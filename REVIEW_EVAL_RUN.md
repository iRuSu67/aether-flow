# REVIEW_EVAL_RUN.md: Staged Evaluation Architecture & Offline Quota Hardening

**Date:** 2026-10-29  
**Status:** OFFLINE HARNESS UPGRADE COMPLETE (Verified via MockProvider)  
**Branch:** `checkpoint-a-fix`  

---

## 1. SUMMARY OF CHANGES & ROOT CAUSE INVESTIGATION

### 1.1 Free-Tier Quota Reality & Pacing
- **Free-Tier Limits:** Verified via Google AI Studio dashboard for Gemini 3.8 Flash / Gemini 3.5 Flash: **5 RPM**, **250,000 TPM**, and **20 RPD** (Requests Per Day).
- **Zero Live API Calls:** In accordance with user instructions, zero live API calls were made today. All verification was executed strictly offline using `MockProvider` and deterministic unit tests.
- **Pacing Interval:** Configured to pace requests at $\ge 13$ seconds minimum interval (`Math.max(13000, 60000 / rpm)` = 13,000ms), eliminating burst-induced 429 errors.

### 1.2 Provider Error Isolation & Incomplete Run Status
- **Error Taxonomy:** Added `'PROVIDER_ERROR'` to `ErrorTaxonomy`.
- **Integrity Rule:** External provider failures (HTTP 429, 503, 500, network disconnects, fetch timeouts, DNS resolution errors) are recorded as `PROVIDER_ERROR` and are **never** scored as algorithmic task failures or wrong outputs.
- **Pass Rate Computation:** Accuracy is strictly computed as $\text{passed} / \text{validRuns}$, where $\text{validRuns} = \text{total} - \text{providerErrors}$. Runs containing provider errors are explicitly labeled with `status: 'INCOMPLETE'`.

### 1.3 Day-Quota vs Minute-Quota Error Handling
- **Daily Quota 429 (`DailyQuotaExhaustedError`):** When the provider indicates daily quota exhaustion (e.g. `Queries per day exceeded`, `RESOURCE_EXHAUSTED` without retry delay), the harness **never** retries. It stops immediately, checkpoints state, and informs the user to resume tomorrow.
- **Transient Per-Minute 429 / 503 Overload:** Retried at most 2 times with exponential backoff (honoring `retryDelay` if returned in API error details).
- **Strict Accounting:** Every retry attempt and every failed request increments the persistent daily budget counter.

### 1.4 Persistent Daily Budget Counter (`DailyBudgetManager`)
- **File Storage:** `.eval_daily_budget.json` (gitignored).
- **Date Keying:** Keyed by local calendar date (`YYYY-MM-DD`) and records local timezone. Output explicitly notes that local date is approximate relative to Google's midnight UTC / Pacific reset.
- **Daily Budget Cap:** Default `--daily-budget=18` (leaving a safety margin of 2 requests below the 20 RPD cap).
- **Graceful Halt:** When `callsToday >= maxDailyBudget`, throws `DailyBudgetExceededError`, flushes checkpoint to disk, and cleanly exits with:
  `Daily API call budget exhausted (18/18 calls used today). State saved. Run 'npm run eval:daily' tomorrow to resume.`

### 1.5 Model Drift Audit (Gemini 3.6 Flash Investigation)
- **Investigation:** Traced why Gemini 3.6 Flash usage appeared on the user's dashboard.
- **Root Cause Found:** In `scratch/test_flash.mjs`, a test queried the alias `gemini-flash-latest`. On Google's backend, the alias `gemini-flash-latest` currently routes to `gemini-3.6-flash`.
- **Audit of Production Harness:** Verified `packages/eval/src/providers/EvalModelClient.ts`. The client strictly constructs the URL with the exact model string:
  `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`
  There is **zero** silent fallback to alternative models or aliases in `EvalModelClient`. If an invalid model name is supplied, it fails closed with `PROVIDER_ERROR`.

### 1.6 Staged Evaluation Architecture & `npm run eval:daily`
- **Stage 1 (Core Synthesis & Sandboxing):** Conditions `A`, `C0`, `C` across all 15 tasks, $N=1$.
  - Precision Call Estimate: **45 Min**, **60 Typical**, **90 Max** calls.
  - Duration at 18 calls/day: **3 to 5 days**.
  - Answers core hypotheses: Does code execution help (A vs C0)? Does the retry loop help (C0 vs C)?
- **Stage 2 (Fixed Palette & Skill Reuse):** Conditions `B`, `D` across all 15 tasks, $N=1$ (executed once Stage 1 completes).
  - Precision Call Estimate: **20 Min**, **44 Typical**, **105 Max** calls.
  - Duration at 18 calls/day: **2 to 6 days**.
  - Answers: Does dynamic synthesis beat fixed tool palettes (C vs B)? Does description reuse save tokens and latency (D vs C)?
- **Stage 3 (Multi-Run Confidence Intervals):** $N=3$ runs for variance reduction.
  - Call Estimate: **195 Min**, **312 Typical**, **585 Max** calls.
  - Executed via local model (Ollama / OpenAI-compatible adapter) with zero API costs, or if paid billing is enabled.
- **Daily Automation (`npm run eval:daily`):** Automatically detects the current stage from `eval_checkpoint.json`, applies `--daily-budget=18`, resumes execution, halts cleanly when budget is reached, and prints today's progress and remaining tasks.

---

## 2. RAW TEST & VERIFICATION OUTPUTS (MOCK ONLY)

### 2.1 Full Eval Workspace Test Suite (`npm test --workspace=@aether-flow/eval`)
```
> @aether-flow/eval@1.0.0 test
> node dist/tasks/checkers/run-self-tests.js && node --test dist/tests/*.test.js

================================================================
       DETERMINISTIC EVALUATION CHECKER SELF-TEST HARNESS       
       Validating 15 tasks (15 Reference + 45 Negative Cases)
================================================================

▶ [Task: task_1a_markdown_employees] Family: family1_markdown_table (Markdown Table: Employee Directory)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_1b_markdown_servers] Family: family1_markdown_table (Markdown Table: Server Telemetry Metrics)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_1c_markdown_transactions] Family: family1_markdown_table (Markdown Table: Financial Ledger Transactions)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_2a_levenshtein_dna] Family: family2_levenshtein_alignment (Levenshtein Alignment: DNA Sequences)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_2b_levenshtein_tokens] Family: family2_levenshtein_alignment (Levenshtein Alignment: Identifier Tokens)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_2c_levenshtein_sentences] Family: family2_levenshtein_alignment (Levenshtein Alignment: Natural Sentences with Typos)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_3a_dijkstra_city] Family: family3_dijkstra_turns (Dijkstra with Turn Penalties: City Grid)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_3b_dijkstra_circuit] Family: family3_dijkstra_turns (Dijkstra with Turn Penalties: Circuit Trace Routing)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_3c_dijkstra_warehouse] Family: family3_dijkstra_turns (Dijkstra with Turn Penalties: AGV Warehouse Aisle)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_4a_csv_sales] Family: family4_csv_pivot (CSV 2D Pivot: Retail Sales)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_4b_csv_telemetry] Family: family4_csv_pivot (CSV 2D Pivot: Infrastructure Telemetry)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_4c_csv_grades] Family: family4_csv_pivot (CSV 2D Pivot: Academic Exam Grades)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_5a_knapsack_cargo] Family: family5_knapsack_dual (0/1 Dual Knapsack: Freight Cargo Packing)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_5b_knapsack_payload] Family: family5_knapsack_dual (0/1 Dual Knapsack: Satellite Payload Instruments)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

▶ [Task: task_5c_knapsack_cloud] Family: family5_knapsack_dual (0/1 Dual Knapsack: Cloud VM Packing)
  ✔ Reference solution PASSED deterministic checker
  ✔ Negative cases rejected: 3/3

================================================================
                    SELF-TEST RUN SUMMARY                       
================================================================
✔ Reference Solutions Passed: 15/15 (100.0%)
✔ Negative Cases Rejected:    45/45 (100.0%)
✔ Status: ALL CHECKERS VALIDATED
================================================================

[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ ORACLE INTEGRITY: Hidden checker is NEVER called inside condition loops (452.3094ms)
✔ TOOL RETRIEVAL: ToolLibrary retrieves tools via description similarity without familyId (0.9204ms)
✔ CONDITION D REUSE VALIDATION: Validates candidates using public examples only (220.832ms)
✔ CALL ESTIMATOR & STAGED EVALUATION: Precision math for Stage 1, Stage 2, and Stage 3 (0.8212ms)
✔ DAILY BUDGET COUNTER: Enforces call limits and throws DailyBudgetExceededError (17.5828ms)
[API RETRY 429/503] Pacing backoff for 0.5s (Attempt 1/2). Every retry counts against daily budget...
✔ RATE LIMITER: Distinguishes Daily Quota 429 from Transient 429, counts retries against budget (2022.6059ms)
✔ DAILY STATUS COMPUTE: Accurately calculates progress and determines active stage (9.01ms)
ℹ tests 7
ℹ suites 0
ℹ pass 7
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3794.9875
```

---

### 2.2 Stage 1 Execution with MockProvider (`node packages/eval/dist/index.js --stage=1 --dry-run`)
```
================================================================
           SCRIPTED MOCK RESULTS - NOT EVIDENCE                 
================================================================
================================================================
            AETHERFLOW EVALUATION BENCHMARK HARNESS             
  Provider: MOCK | Model: gemini-3.8-flash
  Thinking Level: MEDIUM
  Tasks: 15 | Conditions: A, C0, C | Runs: 1
  Rate Limits: 5 RPM | 20 RPD | Daily Budget: 18 calls/day
  Daily Calls Used Today: 0/18 (Remaining: 18)
  Estimated API Calls for this stage: Min: 45 | Typical: 60 | Max: 90
================================================================


▶ [RUN REPETITION 1/1] (Resetting Condition D Tool Library)
  [Task 1/15] task_1a_markdown_employees (Markdown Table: Employee Directory)
    ↳ Condition A : ❌ FAIL | 6ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 2129ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1145ms | Tax: SUCCESS | Tokens: 250
  [Task 2/15] task_1b_markdown_servers (Markdown Table: Server Telemetry Metrics)
    ↳ Condition A : ❌ FAIL | 3ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 958ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1014ms | Tax: SUCCESS | Tokens: 250
  [Task 3/15] task_1c_markdown_transactions (Markdown Table: Financial Ledger Transactions)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 1052ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 953ms | Tax: SUCCESS | Tokens: 250
  [Task 4/15] task_2a_levenshtein_dna (Levenshtein Alignment: DNA Sequences)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 1559ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1133ms | Tax: SUCCESS | Tokens: 250
  [Task 5/15] task_2b_levenshtein_tokens (Levenshtein Alignment: Identifier Tokens)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 965ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 2475ms | Tax: SUCCESS | Tokens: 250
  [Task 6/15] task_2c_levenshtein_sentences (Levenshtein Alignment: Natural Sentences with Typos)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 962ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1015ms | Tax: SUCCESS | Tokens: 250
  [Task 7/15] task_3a_dijkstra_city (Dijkstra with Turn Penalties: City Grid)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 1059ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 1068ms | Tax: SUCCESS | Tokens: 250
  [Task 8/15] task_3b_dijkstra_circuit (Dijkstra with Turn Penalties: Circuit Trace Routing)
    ↳ Condition A : ❌ FAIL | 3ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ❌ FAIL | 990ms | Tax: RUNTIME_ERROR | Tokens: 250
    ↳ Condition C : ❌ FAIL (retries: 3) | 4045ms | Tax: RUNTIME_ERROR | Tokens: 1000
  [Task 9/15] task_3c_dijkstra_warehouse (Dijkstra with Turn Penalties: AGV Warehouse Aisle)
    ↳ Condition A : ❌ FAIL | 3ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ❌ FAIL | 912ms | Tax: RUNTIME_ERROR | Tokens: 250
    ↳ Condition C : ❌ FAIL (retries: 3) | 3492ms | Tax: RUNTIME_ERROR | Tokens: 1000
  [Task 10/15] task_4a_csv_sales (CSV 2D Pivot: Retail Sales)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 855ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 920ms | Tax: SUCCESS | Tokens: 250
  [Task 11/15] task_4b_csv_telemetry (CSV 2D Pivot: Infrastructure Telemetry)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 858ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 865ms | Tax: SUCCESS | Tokens: 250
  [Task 12/15] task_4c_csv_grades (CSV 2D Pivot: Academic Exam Grades)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 860ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 914ms | Tax: SUCCESS | Tokens: 250
  [Task 13/15] task_5a_knapsack_cargo (0/1 Dual Knapsack: Freight Cargo Packing)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 882ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 910ms | Tax: SUCCESS | Tokens: 250
  [Task 14/15] task_5b_knapsack_payload (0/1 Dual Knapsack: Satellite Payload Instruments)
    ↳ Condition A : ❌ FAIL | 2ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 845ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 849ms | Tax: SUCCESS | Tokens: 250
  [Task 15/15] task_5c_knapsack_cloud (0/1 Dual Knapsack: Cloud VM Packing)
    ↳ Condition A : ❌ FAIL | 3ms | Tax: WRONG_OUTPUT | Tokens: 250
    ↳ Condition C0: ✔ PASS | 897ms | Tax: SUCCESS | Tokens: 250
    ↳ Condition C : ✔ PASS | 849ms | Tax: SUCCESS | Tokens: 250

================================================================
           SCRIPTED MOCK RESULTS - NOT EVIDENCE                 
================================================================


================================================================
             EVALUATION REPORT (PER-CONDITION RESULTS)          
================================================================
Status: COMPLETED
Methodology:
  Model: gemini-3.8-flash | Thinking Level: medium
  Runs Per Task: 1 | Tasks Evaluated: 15
  API Calls Made: 0 | Persistent Cache Hits: 51
  Daily Budget: 0/18 calls used (18 remaining today)

----------------------------------------------------------------
CONDITION PERFORMANCE (STRICTLY UNPOOLED):
----------------------------------------------------------------
Condition A : 0/15 passed (0.0%) | 95% Wilson CI: [0%, 20.4%]
   Latency: 3ms | Tokens: 250 (Prompt: 120, Thinking: 45, Output: 85)
   AST False Rejections: 0
   Error Taxonomy: Success: 0, Syntax: 0, Blocked: 0, Runtime: 0, Timeout: 0, Wrong Output: 15, Provider Error: 0

Condition C0: 13/15 passed (86.7%) | 95% Wilson CI: [62.1%, 96.3%]
   Latency: 1052ms | Tokens: 250 (Prompt: 120, Thinking: 45, Output: 85)
   AST False Rejections: 0
   Error Taxonomy: Success: 13, Syntax: 0, Blocked: 0, Runtime: 2, Timeout: 0, Wrong Output: 0, Provider Error: 0

Condition C : 13/15 passed (86.7%) | 95% Wilson CI: [62.1%, 96.3%]
   Latency: 1443ms | Tokens: 350 (Prompt: 168, Thinking: 63, Output: 119)
   AST False Rejections: 0
   Error Taxonomy: Success: 13, Syntax: 0, Blocked: 0, Runtime: 2, Timeout: 0, Wrong Output: 0, Provider Error: 0

================================================================
```

---

### 2.3 Isolated `PROVIDER_ERROR` and Pass-Rate Exclusion Proof
```
Testing PROVIDER_ERROR handling in isolation...
Result taxonomy: PROVIDER_ERROR
Result pass: false
Result errorDetails: 503 Service Unavailable: High demand on provider cluster
Summary status: INCOMPLETE
Condition A total: 1
Condition A validRuns: 0
Condition A providerErrors: 1
Condition A passRate: 0
```

---

## 3. STAGED EVALUATION CALL BUDGET & DURATION MATH

Estimates generated authoritatively by `estimateStagedEvaluation(15, 18)` in `packages/eval/src/harness/estimator.ts`:

| Stage | Conditions | Focus / Research Question | Tasks | Runs ($N$) | Min Calls | Typ Calls | Max Calls | Daily Budget | Est. Days |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Stage 1** | **A, C0, C** | Does code execution help (A vs C0)? Does retry loop help (C0 vs C)? | 15 | 1 | **45** | **60** | **90** | 18 calls/day | **3–5 days** |
| **Stage 2** | **B, D** | Does dynamic synthesis beat fixed tools (C vs B)? Does reuse save tokens (D vs C)? | 15 | 1 | **20** | **44** | **105** | 18 calls/day | **2–6 days** |
| **Stage 3** | **A, B, C0, C, D** | Variance reduction & tight Wilson CIs via local model (Ollama) or billing | 15 | 3 | **195** | **312** | **585** | Unmetered (0 API cost) | **< 1 day** |

---

## 4. FULL SOURCE OF CHANGED EVALUATION & RATE LIMITING FILES

### `packages/eval/src/limiter/DailyBudgetManager.ts`
```typescript
import fs from 'node:fs';
import path from 'node:path';

export class DailyBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyBudgetExceededError';
  }
}

export class DailyQuotaExhaustedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyQuotaExhaustedError';
  }
}

export interface DailyBudgetRecord {
  date: string;
  timezone: string;
  callsToday: number;
  maxDailyBudget: number;
  note: string;
}

export function getLocalDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export class DailyBudgetManager {
  private filePath: string;
  private maxDailyBudget: number;
  private timezone: string;

  constructor(filePath = '.eval_daily_budget.json', maxDailyBudget = 18) {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.maxDailyBudget = maxDailyBudget;
    try {
      this.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      this.timezone = 'UTC';
    }
  }

  private readRecord(): DailyBudgetRecord {
    const today = getLocalDateString();
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as DailyBudgetRecord;
        if (parsed && parsed.date === today) {
          return parsed;
        }
      } catch {
        // Fall through on corrupt read
      }
    }

    // New day or missing record: initialize
    const initial: DailyBudgetRecord = {
      date: today,
      timezone: this.timezone,
      callsToday: 0,
      maxDailyBudget: this.maxDailyBudget,
      note: 'Date-keyed in local timezone; approximate vs Google API daily reset (00:00 UTC / midnight PT).',
    };
    this.writeRecord(initial);
    return initial;
  }

  private writeRecord(record: DailyBudgetRecord): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(record, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[DailyBudgetManager] Warning: failed to persist daily budget to ${this.filePath}`);
    }
  }

  public getCallsToday(): number {
    return this.readRecord().callsToday;
  }

  public getRemainingCalls(): number {
    const record = this.readRecord();
    return Math.max(0, this.maxDailyBudget - record.callsToday);
  }

  public getMaxBudget(): number {
    return this.maxDailyBudget;
  }

  public setMaxBudget(max: number): void {
    this.maxDailyBudget = max;
    const record = this.readRecord();
    record.maxDailyBudget = max;
    this.writeRecord(record);
  }

  /**
   * Check if budget is exhausted before dispatching an API call.
   * Throws DailyBudgetExceededError if limit reached.
   */
  public checkBudgetOrThrow(): void {
    const record = this.readRecord();
    if (record.callsToday >= this.maxDailyBudget) {
      throw new DailyBudgetExceededError(
        `Daily API call budget exhausted (${record.callsToday}/${this.maxDailyBudget} calls used today on ${record.date} [${record.timezone}]). State saved. Run 'npm run eval:daily' tomorrow to resume.`
      );
    }
  }

  /**
   * Record every API call attempt (initial call, retry, or failed call).
   */
  public recordCall(): void {
    const record = this.readRecord();
    record.callsToday += 1;
    this.writeRecord(record);
  }
}
```

---

### `packages/eval/src/limiter/RateLimiter.ts`
```typescript
import { DailyBudgetManager, DailyBudgetExceededError, DailyQuotaExhaustedError } from './DailyBudgetManager.js';

export { DailyBudgetExceededError, DailyQuotaExhaustedError };

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export function isDailyQuotaExhausted(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('per-day') ||
    msg.includes('queries per day') ||
    msg.includes('per day') ||
    msg.includes('requestsperday') ||
    msg.includes('requests_per_day') ||
    msg.includes('daily') ||
    msg.includes('quota exceeded for metric') ||
    (msg.includes('resource_exhausted') && !msg.includes('per-minute') && !msg.includes('minute'))
  );
}

export function parseRetryDelayMs(err: unknown): number | null {
  if (!(err instanceof Error)) return null;
  const match = err.message.match(/retryDelay[:\s"']+(\d+(?:\.\d+)?)\s*s/i);
  if (match) {
    return Math.ceil(parseFloat(match[1]) * 1000);
  }
  return null;
}

export interface RateLimiterOptions {
  rpm?: number;
  tpm?: number;
  rpd?: number;
  maxCalls?: number;
  dailyBudget?: number;
  dailyBudgetManager?: DailyBudgetManager;
  minPacingMs?: number;
}

export class RateLimiter {
  public readonly rpm: number;
  public readonly tpm: number;
  public readonly rpd: number;
  public readonly maxCalls: number;
  public readonly minPacingMs: number;
  public readonly dailyBudget: DailyBudgetManager;
  public apiCallsMade = 0;
  private lastCallTime = 0;

  constructor(options?: RateLimiterOptions) {
    this.rpm = options?.rpm ?? 5;
    this.tpm = options?.tpm ?? 250000;
    this.rpd = options?.rpd ?? 20;
    this.maxCalls = options?.maxCalls ?? 50;
    this.minPacingMs = options?.minPacingMs ?? 13000; // at least 13 seconds between requests

    this.dailyBudget =
      options?.dailyBudgetManager ??
      new DailyBudgetManager('.eval_daily_budget.json', options?.dailyBudget ?? 18);
  }

  public async acquire(): Promise<void> {
    // 1. Check run-level call cap
    if (this.apiCallsMade >= this.maxCalls) {
      throw new BudgetExceededError(
        `Evaluation run halted: Hard API call cap reached (${this.apiCallsMade}/${this.maxCalls} calls). Progress has been checkpointed.`
      );
    }

    // 2. Check persistent daily budget counter
    this.dailyBudget.checkBudgetOrThrow();

    // 3. Pacing: pace at least minPacingMs (>= 13s) and 60000 / rpm
    const intervalFromRpm = Math.ceil(60000 / this.rpm);
    const minIntervalMs = Math.max(this.minPacingMs, intervalFromRpm);
    const now = Date.now();
    const elapsed = now - this.lastCallTime;

    if (this.lastCallTime > 0 && elapsed < minIntervalMs) {
      const waitTime = minIntervalMs - elapsed;
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }

    this.lastCallTime = Date.now();
    this.apiCallsMade++;

    // 4. Increment persistent daily budget for every attempt (including retries)
    this.dailyBudget.recordCall();
  }

  public async executeWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        await this.acquire();
        return await fn();
      } catch (err: unknown) {
        // Daily budget exceeded or hard cap exceeded: do not retry
        if (err instanceof BudgetExceededError || err instanceof DailyBudgetExceededError) {
          throw err;
        }

        // Daily quota exhausted from provider (RPD exhausted): NEVER retry
        if (isDailyQuotaExhausted(err)) {
          throw new DailyQuotaExhaustedError(
            `[DAILY QUOTA EXHAUSTED] Provider returned RPD quota exhaustion. Never retrying today. Progress checkpointed. Run 'npm run eval:daily' tomorrow to resume.\nDetails: ${err instanceof Error ? err.message : String(err)}`
          );
        }

        // Transient per-minute 429 or 503 overload: retry up to maxRetries (2)
        const isTransientRetryable =
          err instanceof Error &&
          (err.message.includes('429') ||
            err.message.includes('503') ||
            err.message.toLowerCase().includes('high demand') ||
            err.message.toLowerCase().includes('unavailable') ||
            err.message.toLowerCase().includes('resource_exhausted'));

        if (isTransientRetryable && attempt < maxRetries) {
          attempt++;
          // Check if provider suggested a retryDelay
          const suggestedDelay = parseRetryDelayMs(err);
          const baseDelay = suggestedDelay ?? Math.max(13000, Math.pow(2, attempt) * 10000);
          const jitter = Math.floor(Math.random() * 2000);
          const backoffMs = baseDelay + jitter;

          console.warn(
            `[API RETRY ${isTransientRetryable ? '429/503' : 'ERROR'}] Pacing backoff for ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries}). Every retry counts against daily budget...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw err;
      }
    }
  }
}
```

---

### `packages/eval/src/harness/dailyRunner.ts`
```typescript
import { ALL_TASKS } from '../tasks/registry.js';
import { CheckpointManager } from '../checkpoints/CheckpointManager.js';
import { DailyBudgetManager, getLocalDateString } from '../limiter/DailyBudgetManager.js';
import { EvalHarness } from './EvalHarness.js';
import { ConditionId, EvalOptions } from '../types.js';

export interface DailyStatus {
  date: string;
  timezone: string;
  callsToday: number;
  maxDailyBudget: number;
  remainingCalls: number;
  stage: 1 | 2 | 3;
  stageName: string;
  stageTotalItems: number;
  stageCompletedItems: number;
  stageRemainingItems: number;
  allDone: boolean;
}

export function computeDailyStatus(
  checkpointFile = 'eval_checkpoint.json',
  budgetFile = '.eval_daily_budget.json',
  maxDailyBudget = 18
): DailyStatus {
  const budget = new DailyBudgetManager(budgetFile, maxDailyBudget);
  const checkpoint = new CheckpointManager(checkpointFile);
  const tasks = ALL_TASKS;

  const s1Conds: ConditionId[] = ['A', 'C0', 'C'];
  const s2Conds: ConditionId[] = ['B', 'D'];

  const s1Completed = tasks
    .flatMap((t) => s1Conds.map((c) => ({ taskId: t.id, condition: c })))
    .filter((tc) => checkpoint.isCompleted(tc.taskId, tc.condition, 0)).length;
  const s1Total = tasks.length * s1Conds.length; // 15 * 3 = 45

  const s2Completed = tasks
    .flatMap((t) => s2Conds.map((c) => ({ taskId: t.id, condition: c })))
    .filter((tc) => checkpoint.isCompleted(tc.taskId, tc.condition, 0)).length;
  const s2Total = tasks.length * s2Conds.length; // 15 * 2 = 30

  let stage: 1 | 2 | 3 = 1;
  let stageName = 'Stage 1: Core Synthesis & Sandboxing (A, C0, C)';
  let stageTotalItems = s1Total;
  let stageCompletedItems = s1Completed;
  let stageRemainingItems = s1Total - s1Completed;
  let allDone = false;

  if (s1Completed < s1Total) {
    stage = 1;
    stageName = 'Stage 1: Core Synthesis & Sandboxing (A, C0, C)';
    stageTotalItems = s1Total;
    stageCompletedItems = s1Completed;
    stageRemainingItems = s1Total - s1Completed;
  } else if (s2Completed < s2Total) {
    stage = 2;
    stageName = 'Stage 2: Fixed Palette & Dynamic Reuse (B, D)';
    stageTotalItems = s2Total;
    stageCompletedItems = s2Completed;
    stageRemainingItems = s2Total - s2Completed;
  } else {
    stage = 3;
    stageName = 'Stage 3: All Free-Tier Stages Completed! (Extra runs require local/billing)';
    stageTotalItems = s1Total + s2Total;
    stageCompletedItems = s1Total + s2Total;
    stageRemainingItems = 0;
    allDone = true;
  }

  return {
    date: getLocalDateString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    callsToday: budget.getCallsToday(),
    maxDailyBudget: budget.getMaxBudget(),
    remainingCalls: budget.getRemainingCalls(),
    stage,
    stageName,
    stageTotalItems,
    stageCompletedItems,
    stageRemainingItems,
    allDone,
  };
}

export async function runDailyEval(options: Partial<EvalOptions> = {}): Promise<void> {
  const maxBudget = options.dailyBudget ?? 18;
  const checkpointFile = options.checkpointFile ?? 'eval_checkpoint.json';
  const status = computeDailyStatus(checkpointFile, '.eval_daily_budget.json', maxBudget);

  console.log('================================================================');
  console.log('            AETHERFLOW DAILY STAGED EVALUATION RUNNER           ');
  console.log('================================================================');
  console.log(`Date: ${status.date} [${status.timezone}]`);
  console.log(
    `Daily Call Budget: ${status.callsToday}/${status.maxDailyBudget} calls used today (Remaining: ${status.remainingCalls})`
  );
  console.log(`Current Target: ${status.stageName}`);
  console.log(
    `Stage Progress: ${status.stageCompletedItems}/${status.stageTotalItems} task-condition pairs completed (${status.stageRemainingItems} remaining)`
  );
  console.log('================================================================\n');

  if (status.allDone) {
    console.log('✔ All Stage 1 and Stage 2 evaluation tasks have been successfully completed!');
    console.log('Review results in eval/results/ or run Stage 3 with a local model (Ollama).');
    return;
  }

  if (status.remainingCalls <= 0) {
    console.log(`[DAILY BUDGET EXHAUSTED] Today's budget of ${status.maxDailyBudget} calls is already used up.`);
    console.log('State is safely preserved in checkpoint.');
    console.log('Run "npm run eval:daily" tomorrow after Google API quota reset to continue.\n');
    return;
  }

  const harnessOptions: Partial<EvalOptions> = {
    ...options,
    stage: status.stage,
    runs: 1,
    resume: true,
    dailyBudget: maxBudget,
    rpm: options.rpm ?? 5,
    rpd: options.rpd ?? 20,
    maxCalls: status.remainingCalls,
  };

  const harness = new EvalHarness(harnessOptions);
  await harness.run();

  const finalStatus = computeDailyStatus(checkpointFile, '.eval_daily_budget.json', maxBudget);
  console.log('\n================================================================');
  console.log('                    TODAY\'S RUN SUMMARY                         ');
  console.log('================================================================');
  console.log(
    `Calls Used Today: ${finalStatus.callsToday}/${finalStatus.maxDailyBudget} (Calls made this session: ${finalStatus.callsToday - status.callsToday})`
  );
  console.log(
    `Stage Progress:   ${finalStatus.stageCompletedItems}/${finalStatus.stageTotalItems} completed (${finalStatus.stageRemainingItems} remaining)`
  );
  if (finalStatus.stageRemainingItems === 0) {
    console.log(`✔ ${finalStatus.stageName} is COMPLETE!`);
  } else {
    console.log(`Remaining work: ${finalStatus.stageRemainingItems} items left in ${finalStatus.stageName}`);
    console.log(`Run 'npm run eval:daily' again tomorrow to continue.`);
  }
  console.log('================================================================\n');
}
```

---

### `packages/eval/src/utils/errors.ts`
```typescript
import {
  DailyBudgetExceededError,
  DailyQuotaExhaustedError,
  BudgetExceededError,
} from '../limiter/RateLimiter.js';

export { DailyBudgetExceededError, DailyQuotaExhaustedError, BudgetExceededError };

export class ProviderError extends Error {
  public readonly originalError?: unknown;
  constructor(message: string, originalError?: unknown) {
    super(message);
    this.name = 'ProviderError';
    this.originalError = originalError;
  }
}

export function isHarnessStopError(err: unknown): boolean {
  return (
    err instanceof DailyBudgetExceededError ||
    err instanceof DailyQuotaExhaustedError ||
    err instanceof BudgetExceededError
  );
}

export function isProviderError(err: unknown): boolean {
  if (err instanceof ProviderError) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes('429') ||
    msg.includes('503') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('504') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('etimedout') ||
    msg.includes('econnrefused') ||
    msg.includes('enotfound') ||
    msg.includes('abort') ||
    msg.includes('high demand') ||
    msg.includes('resource_exhausted') ||
    msg.includes('quota')
  );
}
```

---

## 5. GIT DIFF STAT

```
 .github/workflows/ci.yml                           |   9 +
 .gitignore                                         |  13 +-
 EVAL_DESIGN.md                                     | 152 +++++--
 REVIEW_A_3.md                                      |   2 +-
 package.json                                       |   5 +-
 packages/core/src/tests/sandbox-escape.test.ts     |   4 +-
 packages/eval/package.json                         |   1 +
 packages/eval/src/conditions/ConditionA.ts         |  13 +-
 packages/eval/src/conditions/ConditionB.ts         |  17 +-
 packages/eval/src/conditions/ConditionC.ts         |  17 +-
 packages/eval/src/conditions/ConditionC0.ts        |  13 +-
 packages/eval/src/conditions/ConditionD.ts         |  25 +-
 packages/eval/src/harness/EvalHarness.ts           | 141 +++++--
 packages/eval/src/harness/dailyRunner.ts           | 148 +++++++
 packages/eval/src/harness/estimator.ts             |  81 +++-
 packages/eval/src/index.ts                         |  64 ++-
 packages/eval/src/limiter/DailyBudgetManager.ts    | 114 ++++++
 packages/eval/src/limiter/RateLimiter.ts           |  96 +++--
 packages/eval/src/providers/EvalModelClient.ts     | 110 ++++-
 packages/eval/src/tests/eval-integrity.test.ts     |  78 +++-
 packages/eval/src/types.ts                         |  25 +-
 packages/eval/src/utils/errors.ts                  |  44 ++
 scripts/verify_mutations.js                        |  61 ++--
 23 files changed, 946 insertions(+), 287 deletions(-)
```
