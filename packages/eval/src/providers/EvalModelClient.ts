import { ResponseCache } from '../cache/ResponseCache.js';
import { RateLimiter } from '../limiter/RateLimiter.js';
import { TokenUsage } from '../types.js';
import { loadEnv } from '../utils/env.js';
import {
  ProviderError,
  isHarnessStopError,
  analyzeStructuredQuotaError,
  saveRedactedErrorBody,
} from '../utils/errors.js';
import { DEFAULT_EVAL_MODEL, getModelProfile } from '../config/models.js';

export { ProviderError };

export interface ModelRequest {
  systemPrompt: string;
  prompt: string;
  runIndex: number;
}

export interface ModelResponse {
  text: string;
  tokens: TokenUsage;
  fromCache: boolean;
}

export interface SmokeTestResult {
  httpStatus: number;
  statusText: string;
  model: string;
  thinkingLevel: string;
  tokenUsage: TokenUsage;
  responseShape: {
    candidatesCount: number;
    finishReason?: string;
    preview: string;
  };
}

export class EvalModelClient {
  private provider: 'mock' | 'gemini' | 'ollama' | 'openai';
  private model: string;
  private apiKey: string;
  private thinkingLevel: 'low' | 'medium' | 'high';
  private cache: ResponseCache;
  private limiter: RateLimiter;
  private openaiBaseUrl?: string;
  private allowLive: boolean;
  public readonly supportsThinking: boolean;
  public readonly maxOutputTokens: number;

  constructor(options: {
    provider: 'mock' | 'gemini' | 'ollama' | 'openai';
    model?: string;
    apiKey?: string;
    thinkingLevel?: 'low' | 'medium' | 'high';
    cache: ResponseCache;
    limiter: RateLimiter;
    openaiBaseUrl?: string;
    allowLive?: boolean;
  }) {
    loadEnv();
    this.provider = options.provider;
    this.model = options.model ?? DEFAULT_EVAL_MODEL;
    const profile = getModelProfile(this.model);
    this.supportsThinking = profile.supportsThinking;
    this.maxOutputTokens = profile.maxOutputTokens;
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.thinkingLevel = options.thinkingLevel ?? profile.defaultThinkingLevel;
    this.cache = options.cache;
    this.limiter = options.limiter;
    this.openaiBaseUrl = options.openaiBaseUrl || process.env.OPENAI_BASE_URL;
    this.allowLive = options.allowLive ?? false;
  }

  public getModelName(): string {
    return this.model;
  }

  public getProviderName(): string {
    return this.provider;
  }

  public async complete(request: ModelRequest): Promise<ModelResponse> {
    const cacheKey = this.cache.makeKey(
      this.provider,
      this.model,
      request.systemPrompt,
      request.prompt,
      this.thinkingLevel,
      request.runIndex
    );

    // 1. Check persistent disk cache
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        text: cached.text,
        tokens: cached.tokens,
        fromCache: true,
      };
    }

    // 2. Mock Provider for Dry-Run
    if (this.provider === 'mock') {
      const mockResult = this.generateMockResponse(request);
      this.cache.set(cacheKey, mockResult.text, mockResult.tokens);
      return {
        text: mockResult.text,
        tokens: mockResult.tokens,
        fromCache: false,
      };
    }

    // 3. Gemini API Provider
    if (this.provider === 'gemini') {
      if (!this.allowLive) {
        throw new Error(
          'SAFETY / QUOTA GUARD: Live Gemini API calls are blocked unless --allow-live is explicitly passed. (Using the key also consumes quota in Google AI Studio playground and Antigravity). Use MockProvider (--dry-run) for offline tests, or pass --allow-live to run live.'
        );
      }

      if (!this.apiKey) {
        throw new Error(
          'GEMINI_API_KEY is not set in environment or .env. Please provide a valid Gemini API key to run live evaluation.'
        );
      }

      return await this.limiter.executeWithRetry(async () => {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const generationConfig: Record<string, unknown> = {
          maxOutputTokens: Math.min(this.maxOutputTokens || 65536, 8192),
        };

        if (this.supportsThinking) {
          generationConfig.thinkingConfig = {
            thinkingLevel: this.thinkingLevel,
          };
        }

        const bodyPayload: Record<string, unknown> = {
          contents: [
            {
              role: 'user',
              parts: [{ text: request.prompt }],
            },
          ],
          generationConfig,
        };

        if (request.systemPrompt) {
          bodyPayload.systemInstruction = {
            parts: [{ text: request.systemPrompt }],
          };
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 35000);

        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(bodyPayload),
            signal: controller.signal,
          });

          if (!response.ok) {
            const errText = await response.text();
            let parsedBody: unknown;
            try {
              parsedBody = JSON.parse(errText);
            } catch {
              parsedBody = errText;
            }
            saveRedactedErrorBody(parsedBody, 'eval_last_provider_error.json');
            const quotaAnalysis =
              response.status === 429 ? analyzeStructuredQuotaError(parsedBody) : undefined;
            throw new ProviderError(
              `Gemini API Error (${response.status}): ${errText}`,
              {
                httpStatus: response.status,
                rawErrorBody: parsedBody,
                quotaAnalysis,
                isNetworkError: false,
              }
            );
          }

          const data = (await response.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string; thought?: boolean }> };
              finishReason?: string;
            }>;
            usageMetadata?: {
              promptTokenCount?: number;
              candidatesTokenCount?: number;
              totalTokenCount?: number;
              thoughtsTokenCount?: number;
              candidatesTokenDetails?: Array<{
                thinkingTokenCount?: number;
              }>;
            };
          };

          const parts = data.candidates?.[0]?.content?.parts || [];
          const nonThinkingParts = parts.filter((p) => !p.thought);
          const text = (nonThinkingParts.length > 0 ? nonThinkingParts : parts)
            .map((p) => p.text || '')
            .join('\n')
            .trim();

          const promptTokens = data.usageMetadata?.promptTokenCount || 0;
          const thinkingTokens =
            data.usageMetadata?.thoughtsTokenCount ??
            data.usageMetadata?.candidatesTokenDetails?.[0]?.thinkingTokenCount ??
            0;
          const totalCandidates = data.usageMetadata?.candidatesTokenCount || 0;
          const outputTokens = Math.max(0, totalCandidates - thinkingTokens);
          const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + totalCandidates;

          const tokens: TokenUsage = {
            promptTokens,
            thinkingTokens,
            outputTokens,
            totalTokens,
          };

          this.cache.set(cacheKey, text, tokens);
          return { text, tokens, fromCache: false };
        } catch (err: unknown) {
          if (isHarnessStopError(err)) throw err;
          if (err instanceof ProviderError) throw err;
          throw new ProviderError(
            `Gemini Network Connection Failed [model=${this.model}]: ${err instanceof Error ? err.message : String(err)}`,
            {
              isNetworkError: true,
              originalError: err,
            }
          );
        } finally {
          clearTimeout(timeout);
        }
      });
    }

    // 4. Ollama Provider (Zero-Cost Local Option)
    if (this.provider === 'ollama') {
      try {
        const endpoint = 'http://127.0.0.1:11434/api/generate';
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: this.model,
            prompt: request.systemPrompt ? `${request.systemPrompt}\n\n${request.prompt}` : request.prompt,
            stream: false,
          }),
        });
        if (!res.ok) {
          const errText = await res.text();
          throw new ProviderError(`Ollama Error (${res.status}): ${errText}`, {
            httpStatus: res.status,
            rawErrorBody: errText,
            isNetworkError: false,
          });
        }
        const data = (await res.json()) as { response?: string; prompt_eval_count?: number; eval_count?: number };
        const text = data.response || '';
        const tokens: TokenUsage = {
          promptTokens: data.prompt_eval_count || 0,
          thinkingTokens: 0,
          outputTokens: data.eval_count || 0,
          totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
        };
        this.cache.set(cacheKey, text, tokens);
        return { text, tokens, fromCache: false };
      } catch (err: unknown) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(
          `Ollama connection failed [model=${this.model}]: ${err instanceof Error ? err.message : String(err)}`,
          {
            isNetworkError: true,
            originalError: err,
          }
        );
      }
    }

    // 5. OpenAI-Compatible Provider (e.g. LocalAI, LM Studio, vLLM, Ollama /v1)
    if (this.provider === 'openai') {
      const baseUrl = this.openaiBaseUrl || process.env.OPENAI_BASE_URL || 'http://localhost:11434/v1';
      const endpoint = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
      const apiKey = this.apiKey || process.env.OPENAI_API_KEY || 'dummy-key';

      const messages: Array<{ role: string; content: string }> = [];
      if (request.systemPrompt) {
        messages.push({ role: 'system', content: request.systemPrompt });
      }
      messages.push({ role: 'user', content: request.prompt });

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages,
            max_tokens: 4096,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new ProviderError(`OpenAI-Compatible API Error (${response.status}): ${errText}`, {
            httpStatus: response.status,
            rawErrorBody: errText,
            isNetworkError: false,
          });
        }

        const data = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
        };

        const text = data.choices?.[0]?.message?.content || '';
        const promptTokens = data.usage?.prompt_tokens || 0;
        const outputTokens = data.usage?.completion_tokens || 0;
        const totalTokens = data.usage?.total_tokens || promptTokens + outputTokens;

        const tokens: TokenUsage = {
          promptTokens,
          thinkingTokens: 0,
          outputTokens,
          totalTokens,
        };

        this.cache.set(cacheKey, text, tokens);
        return { text, tokens, fromCache: false };
      } catch (err: unknown) {
        if (err instanceof ProviderError) throw err;
        throw new ProviderError(
          `OpenAI-compatible call failed [model=${this.model}]: ${err instanceof Error ? err.message : String(err)}`,
          {
            isNetworkError: true,
            originalError: err,
          }
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(`Unsupported provider: ${this.provider}`);
  }

  /**
   * Executes exactly ONE smoke call to verify live model availability and schema shape.
   */
  public async executeSmokeCall(): Promise<SmokeTestResult> {
    if (!this.allowLive) {
      throw new Error('Must pass --allow-live to run live smoke test.');
    }
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not set in environment or .env.');
    }

    // Acquire rate limit slot and increment daily budget
    await this.limiter.acquire();

    const generationConfig: Record<string, unknown> = {};
    if (this.supportsThinking) {
      generationConfig.thinkingConfig = {
        thinkingLevel: this.thinkingLevel,
      };
    }

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: 'Respond with OK' }] }],
        generationConfig,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(errText);
      } catch {
        parsedBody = errText;
      }
      saveRedactedErrorBody(parsedBody, 'eval_last_provider_error.json');
      const quotaAnalysis =
        response.status === 429 ? analyzeStructuredQuotaError(parsedBody) : undefined;
      throw new ProviderError(`Gemini Smoke Test Error (${response.status}): ${errText}`, {
        httpStatus: response.status,
        rawErrorBody: parsedBody,
        quotaAnalysis,
        isNetworkError: false,
      });
    }

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string; thought?: boolean }> };
        finishReason?: string;
      }>;
      usageMetadata?: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        totalTokenCount?: number;
        thoughtsTokenCount?: number;
      };
    };

    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    const text = parts.map((p) => p.text || '').join('\n').trim();
    const promptTokens = data.usageMetadata?.promptTokenCount || 0;
    const thinkingTokens = data.usageMetadata?.thoughtsTokenCount || 0;
    const totalCandidates = data.usageMetadata?.candidatesTokenCount || 0;
    const outputTokens = Math.max(0, totalCandidates - thinkingTokens);
    const totalTokens = data.usageMetadata?.totalTokenCount || promptTokens + totalCandidates;

    return {
      httpStatus: response.status,
      statusText: response.statusText,
      model: this.model,
      thinkingLevel: this.supportsThinking ? this.thinkingLevel : 'none (unsupported)',
      tokenUsage: { promptTokens, thinkingTokens, outputTokens, totalTokens },
      responseShape: {
        candidatesCount: data.candidates?.length || 0,
        finishReason: candidate?.finishReason,
        preview: text.slice(0, 100),
      },
    };
  }

  /**
   * Deterministic mock generator used for dry-run plumbing tests.
   */
  private generateMockResponse(request: ModelRequest): { text: string; tokens: TokenUsage } {
    const prompt = request.prompt;
    let text = '';

    if (request.systemPrompt.includes('DIRECT_ANSWER_CONDITION_A')) {
      // Simulate direct JSON extraction
      if (prompt.includes('Employee Directory')) {
        text = JSON.stringify([
          { Name: 'Alice Smith', Role: 'Lead Engineer', Salary: 145000, Active: true, Notes: 'Full-time | Remote' },
          { Name: 'Bob Jones', Role: 'Designer', Salary: 95000, Active: false, Notes: 'On leave' },
          { Name: 'Charlie Brown', Role: 'Product Manager', Salary: 120000, Active: true, Notes: 'Core | Platform' },
        ]);
      } else {
        // Condition A fails on difficult multi-step tasks when answering directly without computation
        text = JSON.stringify({ error: 'Direct generation approximation failed' });
      }
    } else if (request.systemPrompt.includes('FIXED_TOOL_USE_CONDITION_B')) {
      // Condition B tool use
      if (prompt.includes('Employee Directory')) {
        text = '```tool_call\n{"tool": "array_sort", "args": {"array": []}}\n```';
      } else {
        text = '```json\n{"result": "unsupported_by_fixed_palette"}\n```';
      }
    } else {
      // Condition C0, C, D: generate full JS code
      if (prompt.includes('Employee Directory') || prompt.includes('Markdown Table')) {
        text = '```javascript\nexport default async function execute(args) {\n  const input = args.table;\n  const lines = input.trim().split("\\n").filter(l => l.trim().length > 0);\n  const headers = lines[0].split("|").map(h => h.trim()).filter(Boolean);\n  const rows = [];\n  for (let i = 2; i < lines.length; i++) {\n    const cells = lines[i].split("|").map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);\n    const obj = {};\n    headers.forEach((h, idx) => {\n      let val = cells[idx];\n      if (val === "true") val = true;\n      else if (val === "false") val = false;\n      else if (/^\\d+$/.test(val)) val = Number(val);\n      obj[h] = val;\n    });\n    rows.push(obj);\n  }\n  return rows;\n}\n```';
      } else if (prompt.includes('Levenshtein') || prompt.includes('alignment')) {
        text = '```javascript\nexport default async function execute(args) {\n  const s1 = args.seq1;\n  const s2 = args.seq2;\n  const m = s1.length, n = s2.length;\n  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));\n  for (let i = 0; i <= m; i++) dp[i][0] = i;\n  for (let j = 0; j <= n; j++) dp[0][j] = j;\n  for (let i = 1; i <= m; i++) {\n    for (let j = 1; j <= n; j++) {\n      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];\n      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);\n    }\n  }\n  return { distance: dp[m][n], operations: [] };\n}\n```';
      } else if (prompt.includes('Pivot') || prompt.includes('CSV')) {
        text = '```javascript\nexport default async function execute(args) {\n  const rows = args.data;\n  const pivot = {};\n  for (const r of rows) {\n    if (!pivot[r.Region]) pivot[r.Region] = {};\n    pivot[r.Region][r.Category] = (pivot[r.Region][r.Category] || 0) + r.Sales;\n  }\n  return pivot;\n}\n```';
      } else if (prompt.includes('Knapsack') || prompt.includes('cargo')) {
        text = '```javascript\nexport default async function execute(args) {\n  return { max_value: 120, selected_items: ["item_1", "item_3"], total_weight: 45, total_volume: 30 };\n}\n```';
      } else {
        text = '```javascript\nexport default async function execute(args) {\n  throw new Error("Task algorithm not implemented in mock generator");\n}\n```';
      }
    }

    const tokens: TokenUsage = {
      promptTokens: 120,
      thinkingTokens: 45,
      outputTokens: 85,
      totalTokens: 250,
    };

    return { text, tokens };
  }
}
