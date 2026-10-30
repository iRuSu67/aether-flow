# REVIEW_B_2: Core Evaluation Harness & Execution Engine Source Code

This document provides the full, unedited source code for the core evaluation harness, model client, Condition D dynamic tool reuse manager, and TypeScript interface contracts.

---

## 1. `packages/eval/src/types.ts`
```typescript
export type TaskFamilyId =
  | 'family1_markdown_table'
  | 'family2_levenshtein_alignment'
  | 'family3_dijkstra_turns'
  | 'family4_csv_pivot'
  | 'family5_knapsack_dual';

export interface NegativeCase {
  name: string;
  output: unknown;
  expectedFailureReason: string;
}

export interface CheckerResult {
  pass: boolean;
  reason?: string;
}

export type CheckerFunction = (candidateOutput: unknown, input: unknown) => CheckerResult;

export interface BenchmarkTask {
  id: string;
  familyId: TaskFamilyId;
  variant: 'a' | 'b' | 'c';
  title: string;
  domain: string;
  prompt: string;
  input: unknown;
  referenceSolution: (input: unknown) => unknown;
  negativeCases: NegativeCase[];
  checker: CheckerFunction;
}

export type ConditionId = 'A' | 'B' | 'C0' | 'C' | 'D';

export type ErrorTaxonomy =
  | 'SYNTAX_ERROR'
  | 'POLICY_BLOCKED'
  | 'RUNTIME_ERROR'
  | 'TIMEOUT'
  | 'WRONG_OUTPUT'
  | 'SUCCESS';

export interface TokenUsage {
  promptTokens: number;
  thinkingTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface TaskRunResult {
  taskId: string;
  familyId: TaskFamilyId;
  variant?: 'a' | 'b' | 'c';
  condition: ConditionId;
  runIndex: number;
  pass: boolean;
  retries: number;
  errorTaxonomy: ErrorTaxonomy;
  errorDetails?: string;
  latencyMs: number;
  tokens: TokenUsage;
  reused: boolean;
  astBlocked: boolean;
  rawOutput?: unknown;
}

export interface EvalOptions {
  provider: 'mock' | 'gemini' | 'ollama';
  model: string;
  rpm: number;
  tpm: number;
  rpd: number;
  maxCalls: number;
  runs: number;
  thinkingBudget: number;
  limitTasks?: number;
  taskIds?: string[];
  resume?: boolean;
  checkpointFile?: string;
  cacheDir?: string;
}

export interface CallEstimates {
  minCalls: number;
  typicalCalls: number;
  maxCalls: number;
  perCondition: Record<ConditionId, { min: number; typical: number; max: number }>;
}

export interface EvalSummary {
  totalRuns: number;
  totalPassed: number;
  passRate: number;
  wilsonCI: [number, number];
  conditionStats: Record<
    ConditionId,
    {
      total: number;
      passed: number;
      passRate: number;
      wilsonCI: [number, number];
      avgLatencyMs: number;
      avgTotalTokens: number;
      avgThinkingTokens: number;
      errorCounts: Record<ErrorTaxonomy, number>;
      astFalseRejections: number;
    }
  >;
  familyReuseRates: Record<TaskFamilyId, { eligible: number; hits: number; hitRate: number }>;
  overallReuseRate: number;
  apiCallsMade: number;
  cacheHits: number;
}
```

---

## 2. `packages/eval/src/harness/EvalHarness.ts`
```typescript
import { Sandbox, ASTVerifier } from '@aether-flow/core';
import {
  BenchmarkTask,
  EvalOptions,
  EvalSummary,
  TaskRunResult,
  ConditionId,
  CallEstimates,
  TaskFamilyId,
  ErrorTaxonomy,
} from '../types.js';
import { ALL_TASKS } from '../tasks/registry.js';
import { ResponseCache } from '../cache/ResponseCache.js';
import { RateLimiter } from '../limiter/RateLimiter.js';
import { CheckpointManager } from '../checkpoints/CheckpointManager.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { runConditionA } from '../conditions/ConditionA.js';
import { runConditionB } from '../conditions/ConditionB.js';
import { runConditionC0 } from '../conditions/ConditionC0.js';
import { runConditionC } from '../conditions/ConditionC.js';
import { runConditionD, ToolLibrary } from '../conditions/ConditionD.js';

export function computeWilsonScoreCI(successes: number, total: number, z = 1.96): [number, number] {
  if (total === 0) return [0, 0];
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  const lower = Math.max(0, (center - spread) / denominator);
  const upper = Math.min(1, (center + spread) / denominator);
  return [Number((lower * 100).toFixed(1)), Number((upper * 100).toFixed(1))];
}

export class EvalHarness {
  private options: EvalOptions;
  private cache: ResponseCache;
  private limiter: RateLimiter;
  private checkpoint: CheckpointManager;
  private client: EvalModelClient;
  private sandbox!: Sandbox;
  private astVerifier: ASTVerifier;
  private library: ToolLibrary;

  constructor(options: Partial<EvalOptions> = {}) {
    this.options = {
      provider: options.provider ?? 'mock',
      model: options.model ?? 'gemini-2.5-flash',
      rpm: options.rpm ?? 15,
      tpm: options.tpm ?? 1000000,
      rpd: options.rpd ?? 1500,
      maxCalls: options.maxCalls ?? 50,
      runs: options.runs ?? 1,
      thinkingBudget: options.thinkingBudget ?? 1024,
      limitTasks: options.limitTasks,
      taskIds: options.taskIds,
      resume: options.resume ?? false,
      checkpointFile: options.checkpointFile ?? 'eval_checkpoint.json',
      cacheDir: options.cacheDir ?? '.eval_cache',
    };

    this.cache = new ResponseCache(this.options.cacheDir);
    this.limiter = new RateLimiter({
      rpm: this.options.rpm,
      tpm: this.options.tpm,
      rpd: this.options.rpd,
      maxCalls: this.options.maxCalls,
    });
    this.checkpoint = new CheckpointManager(this.options.checkpointFile);
    this.client = new EvalModelClient({
      provider: this.options.provider,
      model: this.options.model,
      thinkingBudget: this.options.thinkingBudget,
      cache: this.cache,
      limiter: this.limiter,
    });
    this.astVerifier = new ASTVerifier();
    this.library = new ToolLibrary();
  }

  public validateSecurityPrerequisites(): void {
    // Security Enforcement (Item 9): Untrusted code MUST execute in Docker with fail-closed checks
    if (!Sandbox.isDockerAvailable()) {
      throw new Error(
        'SECURITY ENFORCEMENT: Docker is required for dynamic tool evaluation (Conditions C0, C, D). Docker engine is not available on this host. Execution refused.'
      );
    }
    this.sandbox = new Sandbox({
      mode: 'docker',
      unsafeDevMode: false,
      timeoutMs: 8000,
      maxMemoryMb: 64,
      maxOutputBytes: 128 * 1024,
    });
  }

  public getSelectedTasks(): BenchmarkTask[] {
    let tasks = [...ALL_TASKS];
    if (this.options.taskIds && this.options.taskIds.length > 0) {
      tasks = tasks.filter((t) => this.options.taskIds!.includes(t.id));
    }
    if (this.options.limitTasks && this.options.limitTasks > 0) {
      tasks = tasks.slice(0, this.options.limitTasks);
    }
    return tasks;
  }

  public estimateApiCalls(tasks: BenchmarkTask[]): CallEstimates {
    const T = tasks.length;
    const N = this.options.runs;

    // Conditions: A (1), B (1-3, typ 2), C0 (1), C (1-4, typ 2), D (1-4 on v1, 0-4 on v2/v3, typ 1)
    const perCondition: Record<ConditionId, { min: number; typical: number; max: number }> = {
      A: { min: T * N * 1, typical: T * N * 1, max: T * N * 1 },
      B: { min: T * N * 1, typical: T * N * 2, max: T * N * 3 },
      C0: { min: T * N * 1, typical: T * N * 1, max: T * N * 1 },
      C: { min: T * N * 1, typical: T * N * 2, max: T * N * 4 },
      D: { min: Math.ceil(T / 3) * N * 1, typical: T * N * 1, max: T * N * 4 },
    };

    let minCalls = 0;
    let typicalCalls = 0;
    let maxCalls = 0;

    for (const cond of Object.keys(perCondition) as ConditionId[]) {
      minCalls += perCondition[cond].min;
      typicalCalls += perCondition[cond].typical;
      maxCalls += perCondition[cond].max;
    }

    return { minCalls, typicalCalls, maxCalls, perCondition };
  }

  public async run(): Promise<{ summary: EvalSummary; results: TaskRunResult[] }> {
    this.validateSecurityPrerequisites();
    const tasks = this.getSelectedTasks();
    const results: TaskRunResult[] = [];
    const conditions: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];

    console.log('================================================================');
    console.log('            AETHERFLOW EVALUATION BENCHMARK HARNESS             ');
    console.log(`  Provider: ${this.options.provider.toUpperCase()} | Model: ${this.options.model}`);
    console.log(`  Tasks: ${tasks.length} | Conditions: ${conditions.join(', ')} | Runs: ${this.options.runs}`);
    console.log(`  Rate Limits: ${this.options.rpm} RPM | ${this.options.rpd} RPD | Max Calls Cap: ${this.options.maxCalls}`);

    const estimates = this.estimateApiCalls(tasks);
    console.log(`  Estimated API Calls: Min: ${estimates.minCalls} | Typical: ${estimates.typicalCalls} | Max: ${estimates.maxCalls}`);
    console.log('================================================================\n');

    for (let r = 0; r < this.options.runs; r++) {
      console.log(`\n▶ [RUN REPETITION ${r + 1}/${this.options.runs}] (Resetting Condition D Tool Library)`);
      this.library.reset();

      for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
        const task = tasks[tIdx];
        console.log(`  [Task ${tIdx + 1}/${tasks.length}] ${task.id} (${task.title})`);

        for (const cond of conditions) {
          // Check resume
          if (this.options.resume && this.checkpoint.isCompleted(task.id, cond, r)) {
            console.log(`    ↳ Condition ${cond}: Cached in checkpoint, skipping`);
            continue;
          }

          let runRes: TaskRunResult;

          switch (cond) {
            case 'A':
              runRes = await runConditionA(task, r, this.client);
              break;
            case 'B':
              runRes = await runConditionB(task, r, this.client);
              break;
            case 'C0':
              runRes = await runConditionC0(task, r, this.client, this.sandbox, this.astVerifier);
              break;
            case 'C':
              runRes = await runConditionC(task, r, this.client, this.sandbox, this.astVerifier);
              break;
            case 'D':
              runRes = await runConditionD(task, r, this.client, this.sandbox, this.astVerifier, this.library);
              break;
          }

          runRes.variant = task.variant;
          results.push(runRes);
          this.checkpoint.record(runRes);

          const statusIcon = runRes.pass ? '✔ PASS' : '❌ FAIL';
          const reuseStr = runRes.reused ? ' [REUSE HIT]' : '';
          const retryStr = runRes.retries > 0 ? ` (retries: ${runRes.retries})` : '';
          console.log(
            `    ↳ Condition ${cond.padEnd(2)}: ${statusIcon}${reuseStr}${retryStr} | ${runRes.latencyMs.toFixed(0)}ms | Tax: ${runRes.errorTaxonomy} | Tokens: ${runRes.tokens.totalTokens}`
          );
        }
      }
    }

    const summary = this.computeSummary(results);
    return { summary, results };
  }

  public computeSummary(results: TaskRunResult[]): EvalSummary {
    const totalRuns = results.length;
    const totalPassed = results.filter((r) => r.pass).length;
    const passRate = totalRuns > 0 ? Number(((totalPassed / totalRuns) * 100).toFixed(1)) : 0;
    const wilsonCI = computeWilsonScoreCI(totalPassed, totalRuns);

    const conditions: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];
    const conditionStats = {} as EvalSummary['conditionStats'];

    for (const cond of conditions) {
      const condResults = results.filter((r) => r.condition === cond);
      const total = condResults.length;
      const passed = condResults.filter((r) => r.pass).length;
      const cPassRate = total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0;
      const cWilson = computeWilsonScoreCI(passed, total);

      const avgLatencyMs =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.latencyMs, 0) / total).toFixed(0)) : 0;
      const avgTotalTokens =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.tokens.totalTokens, 0) / total).toFixed(0)) : 0;
      const avgThinkingTokens =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.tokens.thinkingTokens, 0) / total).toFixed(0)) : 0;

      const errorCounts: Record<ErrorTaxonomy, number> = {
        SYNTAX_ERROR: 0,
        POLICY_BLOCKED: 0,
        RUNTIME_ERROR: 0,
        TIMEOUT: 0,
        WRONG_OUTPUT: 0,
        SUCCESS: 0,
      };

      let astFalseRejections = 0;
      for (const r of condResults) {
        errorCounts[r.errorTaxonomy] = (errorCounts[r.errorTaxonomy] || 0) + 1;
        if (r.astBlocked) astFalseRejections++;
      }

      conditionStats[cond] = {
        total,
        passed,
        passRate: cPassRate,
        wilsonCI: cWilson,
        avgLatencyMs,
        avgTotalTokens,
        avgThinkingTokens,
        errorCounts,
        astFalseRejections,
      };
    }

    // Condition D Family reuse rates
    const dResults = results.filter((r) => r.condition === 'D');
    const familyReuseRates = {} as EvalSummary['familyReuseRates'];
    const families: TaskFamilyId[] = [
      'family1_markdown_table',
      'family2_levenshtein_alignment',
      'family3_dijkstra_turns',
      'family4_csv_pivot',
      'family5_knapsack_dual',
    ];

    let totalEligible = 0;
    let totalHits = 0;

    for (const fam of families) {
      // Eligible variants for reuse in Condition D are 'b' and 'c' (variant 'a' synthesizes the baseline tool)
      const famVariants = dResults.filter((r) => r.familyId === fam && (r.variant === 'b' || r.variant === 'c'));
      const eligible = famVariants.length;
      const hits = famVariants.filter((r) => r.reused).length;
      const hitRate = eligible > 0 ? Number(((hits / eligible) * 100).toFixed(1)) : 0;

      familyReuseRates[fam] = { eligible, hits, hitRate };
      totalEligible += eligible;
      totalHits += hits;
    }

    const overallReuseRate = totalEligible > 0 ? Number(((totalHits / totalEligible) * 100).toFixed(1)) : 0;

    return {
      totalRuns,
      totalPassed,
      passRate,
      wilsonCI,
      conditionStats,
      familyReuseRates,
      overallReuseRate,
      apiCallsMade: this.limiter.apiCallsMade,
      cacheHits: this.cache.hits,
    };
  }
}
```

---

## 3. `packages/eval/src/providers/EvalModelClient.ts`
```typescript
import { ResponseCache } from '../cache/ResponseCache.js';
import { RateLimiter } from '../limiter/RateLimiter.js';
import { TokenUsage } from '../types.js';

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
  private provider: 'mock' | 'gemini' | 'ollama';
  private model: string;
  private apiKey: string;
  private thinkingBudget: number;
  private cache: ResponseCache;
  private limiter: RateLimiter;

  constructor(options: {
    provider: 'mock' | 'gemini' | 'ollama';
    model: string;
    apiKey?: string;
    thinkingBudget?: number;
    cache: ResponseCache;
    limiter: RateLimiter;
  }) {
    this.provider = options.provider;
    this.model = options.model;
    this.apiKey = options.apiKey || process.env.GEMINI_API_KEY || '';
    this.thinkingBudget = options.thinkingBudget ?? 1024;
    this.cache = options.cache;
    this.limiter = options.limiter;
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
      this.thinkingBudget,
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

        const contents = [
          {
            role: 'user',
            parts: [
              {
                text: request.systemPrompt
                  ? `${request.systemPrompt}\n\nTask:\n${request.prompt}`
                  : request.prompt,
              },
            ],
          },
        ];

        // Traditional temperature/top_p/top_k are deprecated and omitted per Gemini 2.5/3.x specs.
        const bodyPayload: Record<string, unknown> = {
          contents,
          generationConfig: {
            maxOutputTokens: 2048,
          },
        };

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`Gemini API Error (${response.status}): ${errText}`);
        }

        const data = (await response.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
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

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
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
      });
    }

    // 4. Ollama Provider (Zero-Cost Local Option)
    if (this.provider === 'ollama') {
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
        throw new Error(`Ollama Error (${res.status}): ${await res.text()}`);
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
```

---

## 4. `packages/eval/src/conditions/ConditionD.ts`
```typescript
import { ASTVerifier, Sandbox } from '@aether-flow/core';
import { BenchmarkTask, TaskRunResult, TaskFamilyId } from '../types.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { runConditionC } from './ConditionC.js';

export class ToolLibrary {
  private library = new Map<TaskFamilyId, string>();

  public reset(): void {
    this.library.clear();
  }

  public get(familyId: TaskFamilyId): string | undefined {
    return this.library.get(familyId);
  }

  public set(familyId: TaskFamilyId, code: string): void {
    this.library.set(familyId, code);
  }

  public has(familyId: TaskFamilyId): boolean {
    return this.library.has(familyId);
  }
}

export async function runConditionD(
  task: BenchmarkTask,
  runIndex: number,
  client: EvalModelClient,
  sandbox: Sandbox,
  astVerifier: ASTVerifier,
  library: ToolLibrary
): Promise<TaskRunResult> {
  const startTime = performance.now();

  // 1. Check if tool library has an existing synthesized tool for this family
  if (library.has(task.familyId)) {
    const existingCode = library.get(task.familyId)!;

    // Run existing tool against new variant input in Docker Sandbox
    const execRes = await sandbox.execute(existingCode, task.input as Record<string, unknown>);
    if (execRes.success) {
      const check = task.checker(execRes.result, task.input);
      if (check.pass) {
        const latencyMs = performance.now() - startTime;
        // Successful reuse! Zero LLM synthesis calls needed
        return {
          taskId: task.id,
          familyId: task.familyId,
          condition: 'D',
          runIndex,
          pass: true,
          retries: 0,
          errorTaxonomy: 'SUCCESS',
          latencyMs,
          tokens: { promptTokens: 0, thinkingTokens: 0, outputTokens: 0, totalTokens: 0 },
          reused: true,
          astBlocked: false,
          rawOutput: execRes.result,
        };
      }
    }
    // If existing tool threw or failed checker, record miss and fall back to JIT synthesis
  }

  // 2. Synthesize via Condition C loop on library miss or failure
  const cResult = await runConditionC(task, runIndex, client, sandbox, astVerifier);

  // If synthesis passed, index tool in library for subsequent variants in this family
  if (cResult.pass && cResult.finalCode) {
    library.set(task.familyId, cResult.finalCode);
  }

  return {
    ...cResult,
    condition: 'D',
    reused: false,
  };
}
```
