import { ResponseCache } from '../cache/ResponseCache.js';
import { RateLimiter } from '../limiter/RateLimiter.js';
import { TokenUsage } from '../types.js';
import { loadEnv } from '../utils/env.js';
import { ProviderError, isHarnessStopError } from '../utils/errors.js';

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

export class EvalModelClient {
  private provider: 'mock' | 'gemini' | 'ollama' | 'openai';
  private model: string;
  private apiKey: string;
  private thinkingLevel: 'low' | 'medium' | 'high';
  private cache: ResponseCache;
  private limiter: RateLimiter;
  private openaiBaseUrl?: string;

  constructor(options: {
    provider: 'mock' | 'gemini' | 'ollama' | 'openai';
    model: string;
    apiKey?: string;
    thinkingLevel?: 'low' | 'medium' | 'high';
    cache: ResponseCache;
    limiter: RateLimiter;
    openaiBaseUrl?: string;
  }) {
    loadEnv();
    this.provider = options.provider;
    this.model = options.model;
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.thinkingLevel = options.thinkingLevel ?? 'medium';
    this.cache = options.cache;
    this.limiter = options.limiter;
    this.openaiBaseUrl = options.openaiBaseUrl || process.env.OPENAI_BASE_URL;
  }

  public getModelName(): string {
    return this.model;
  }

  public getProviderName(): string {
    return this.provider;
  }

  public async complete(request: ModelRequest): Promise<ModelResponse> {
    if (this.provider === 'gemini' && !this.apiKey) {
      throw new Error(
        'GEMINI_API_KEY is not set in environment or .env. Please provide a valid Gemini API key to run live evaluation.'
      );
    }

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
      if (!this.apiKey) {
        throw new Error(
          'GEMINI_API_KEY is not set in environment or .env. Please provide a valid Gemini API key to run live evaluation.'
        );
      }

      return await this.limiter.executeWithRetry(async () => {
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;

        const bodyPayload: Record<string, unknown> = {
          contents: [
            {
              role: 'user',
              parts: [{ text: request.prompt }],
            },
          ],
          generationConfig: {
            maxOutputTokens: 4096,
            thinkingConfig: {
              thinkingLevel: this.thinkingLevel,
            },
          },
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
            throw new Error(`Gemini API Error (${response.status}): ${errText}`);
          }

          const data = (await response.json()) as {
            candidates?: Array<{
              content?: { parts?: Array<{ text?: string; thought?: boolean }> };
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
          // Pick text from candidates; exclude parts explicitly marked as thinking trace if separated
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
          throw new ProviderError(
            `Gemini Provider Call Failed [model=${this.model}]: ${err instanceof Error ? err.message : String(err)}`,
            err
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
          throw new ProviderError(`Ollama Error (${res.status}): ${await res.text()}`);
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
          err
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
          throw new ProviderError(`OpenAI-Compatible API Error (${response.status}): ${errText}`);
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
          err
        );
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new Error(`Unsupported provider: ${this.provider}`);
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
        text = JSON.stringify({ answer: 'mock_direct' });
      }
    } else if (request.systemPrompt.includes('FIXED_TOOL_CONDITION_B')) {
      // Condition B ReAct tool use
      text = 'I will execute the tool.\n```tool_call\n{"tool": "math_calc", "args": {"expr": "1 + 1"}}\n```';
    } else {
      // Conditions C0, C, D: Synthesize tool code
      if (prompt.includes('markdown') || prompt.includes('Markdown')) {
        text = `\`\`\`javascript
export default async function execute(args) {
  const lines = args.markdown.split(/\\r?\\n/).map(l => l.trim()).filter(l => l.startsWith('|') && l.endsWith('|'));
  const inner = l => l.replace(/^\\|/, '').replace(/\\|$/, '');
  const splitCells = l => {
    const parts = [];
    let cur = '';
    const s = inner(l);
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '|' && (i === 0 || s[i-1] !== '\\\\')) {
        parts.push(cur.replace(/\\\\\\|/g, '|').trim());
        cur = '';
      } else {
        cur += s[i];
      }
    }
    parts.push(cur.replace(/\\\\\\|/g, '|').trim());
    return parts;
  };
  const headers = splitCells(lines[0]);
  const rows = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = splitCells(lines[i]);
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      let v = cells[c] || '';
      if (v.toLowerCase() === 'true') v = true;
      else if (v.toLowerCase() === 'false') v = false;
      else if (/^-?\\d+(\\.\\d+)?$/.test(v)) v = Number(v);
      obj[headers[c]] = v;
    }
    rows.push(obj);
  }
  return rows;
}
\`\`\``;
      } else if (prompt.includes('Levenshtein') || prompt.includes('edit distance')) {
        text = `\`\`\`javascript
export default async function execute(args) {
  const s1 = args.source;
  const s2 = args.target;
  const m = s1.length;
  const n = s2.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
      ops.push({ op: 'keep', char: s1[i - 1] });
      i--; j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ op: 'substitute', char: s2[j - 1] });
      i--; j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ op: 'insert', char: s2[j - 1] });
      j--;
    } else {
      ops.push({ op: 'delete', char: s1[i - 1] });
      i--;
    }
  }
  ops.reverse();
  return { editDistance: dp[m][n], operations: ops };
}
\`\`\``;
      } else if (prompt.includes('Dijkstra') || prompt.includes('street graph')) {
        text = `\`\`\`javascript
export default async function execute(args) {
  const { edges, start, end, turnPenalties } = args;
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e);
  }
  const getTurn = (d1, d2) => {
    if (d1 === d2) return 'straight';
    const dirs = ['N', 'E', 'S', 'W'];
    const diff = (dirs.indexOf(d2) - dirs.indexOf(d1) + 4) % 4;
    if (diff === 1) return 'right';
    if (diff === 2) return 'uTurn';
    return 'left';
  };
  const dist = new Map();
  const parent = new Map();
  const pq = [{ node: start, inDir: null, cost: 0, key: start + '|NONE' }];
  dist.set(start + '|NONE', 0);
  parent.set(start + '|NONE', { prevKey: null, node: start });
  let bestCost = Infinity, bestKey = null;
  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const cur = pq.shift();
    if (cur.cost > (dist.get(cur.key) || Infinity)) continue;
    if (cur.node === end) {
      if (cur.cost < bestCost) { bestCost = cur.cost; bestKey = cur.key; }
      continue;
    }
    for (const e of (adj.get(cur.node) || [])) {
      const penalty = cur.inDir ? turnPenalties[getTurn(cur.inDir, e.direction)] : 0;
      const nextCost = cur.cost + e.weight + penalty;
      const nextKey = e.to + '|' + e.direction;
      if (nextCost < (dist.get(nextKey) || Infinity)) {
        dist.set(nextKey, nextCost);
        parent.set(nextKey, { prevKey: cur.key, node: e.to });
        pq.push({ node: e.to, inDir: e.direction, cost: nextCost, key: nextKey });
      }
    }
  }
  const path = [];
  let k = bestKey;
  while (k) {
    const p = parent.get(k);
    if (!p) break;
    path.push(p.node);
    k = p.prevKey;
  }
  path.reverse();
  return { path, totalCost: bestCost };
}
\`\`\``;
      } else if (prompt.includes('pivot') || prompt.includes('Pivot')) {
        text = `\`\`\`javascript
export default async function execute(args) {
  const lines = args.csv.trim().split(/\\r?\\n/).filter(Boolean);
  const headers = lines[0].split(',').map(h => h.trim());
  const rIdx = headers.indexOf(args.rowField);
  const cIdx = headers.indexOf(args.colField);
  const sIdx = headers.indexOf(args.sumField);
  const aIdx = headers.indexOf(args.avgField);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map(p => p.trim());
    const rKey = parts[rIdx], cKey = parts[cIdx];
    const sVal = Number(parts[sIdx]) || 0, aVal = Number(parts[aIdx]) || 0;
    if (!map.has(rKey)) map.set(rKey, new Map());
    const rMap = map.get(rKey);
    if (!rMap.has(cKey)) rMap.set(cKey, { sumVal: 0, avgSum: 0, count: 0 });
    const acc = rMap.get(cKey);
    acc.sumVal += sVal; acc.avgSum += aVal; acc.count++;
  }
  const res = {};
  for (const [rKey, colMap] of map.entries()) {
    res[rKey] = {};
    for (const [cKey, acc] of colMap.entries()) {
      res[rKey][cKey] = {
        sum: Number(acc.sumVal.toFixed(2)),
        avg: acc.count > 0 ? Number((acc.avgSum / acc.count).toFixed(2)) : 0
      };
    }
  }
  return res;
}
\`\`\``;
      } else {
        // Knapsack
        text = `\`\`\`javascript
export default async function execute(args) {
  const { items, maxWeight: W, maxVolume: V } = args;
  const n = items.length;
  const dp = Array.from({ length: W + 1 }, () => Array(V + 1).fill(0));
  const picked = Array.from({ length: n }, () => Array.from({ length: W + 1 }, () => Array(V + 1).fill(false)));
  for (let i = 0; i < n; i++) {
    const { weight: w_i, volume: v_i, value: val_i } = items[i];
    for (let w = W; w >= w_i; w--) {
      for (let v = V; v >= v_i; v--) {
        if (dp[w - w_i][v - v_i] + val_i > dp[w][v]) {
          dp[w][v] = dp[w - w_i][v - v_i] + val_i;
          picked[i][w][v] = true;
        }
      }
    }
  }
  const selectedIds = [];
  let curW = W, curV = V;
  for (let i = n - 1; i >= 0; i--) {
    if (picked[i][curW][curV]) {
      selectedIds.push(items[i].id);
      curW -= items[i].weight;
      curV -= items[i].volume;
    }
  }
  selectedIds.sort((a, b) => a - b);
  return { selectedIds, totalValue: dp[W][V] };
}
\`\`\``;
      }
    }

    return {
      text,
      tokens: {
        promptTokens: 120,
        thinkingTokens: 45,
        outputTokens: 85,
        totalTokens: 250,
      },
    };
  }
}
