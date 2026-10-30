# REVIEW_EVAL_FIX2: Comprehensive Evaluation Hardening & Offline Verification

**Date:** 2026-10-30  
**Repository:** `aether-flow`  
**Branch:** `checkpoint-a-fix`  
**Status:** Verification Complete (All Tests Offline & Mock Fixtures Passed)

---

## 1. Executive Summary & Verification Matrix

In accordance with strict instructions, **ZERO live Gemini API calls were made**. All hardening mechanisms have been fully implemented, typed, and deterministically verified offline using unit tests, mock fixtures, and dry-run execution.

| Requirement | Implementation Summary | Offline Evidence / Test |
| :--- | :--- | :--- |
| **1. Typed ProviderError Detection** | Only errors thrown by `EvalModelClient` carrying an HTTP status or network flag become `ProviderError`. Sandbox and task errors containing `"500"`, `"network"`, `"abort"`, `"quota"`, or `"429"` are scored as `RUNTIME_ERROR` or `WRONG_OUTPUT` and **never** excluded. | `eval-integrity.test.ts`: `TYPED PROVIDER ERROR VS TASK ERROR` passed. |
| **2. Structured 429 Classification** | 429 errors are parsed via structured JSON error details (`ErrorInfo.metadata.quota_metric`, `quota_id`, `QuotaFailure.violations`, `RetryInfo.retryDelay`). Categorized as `DAILY`, `PER_MINUTE`, or `UNCLASSIFIED`. Unclassified retries at most once. Full redacted error saved to `eval_last_provider_error.json`. | `eval-integrity.test.ts`: 3 distinct fixture tests (`DAILY`, `PER-MINUTE`, `UNCLASSIFIED`) passed. |
| **3. Day Boundary & Casablanca Reset** | Daily budget is keyed strictly to `America/Los_Angeles` calendar date (`YYYY-MM-DD`). After a daily 429, `blockedUntil` (next Pacific midnight) is persisted. Reset time is converted and printed in `Africa/Casablanca` (08:00 AM GMT+1). | `eval-integrity.test.ts`: `PACIFIC DATE KEYING & RESET TIME IN CASABLANCA` passed; `DailyBudgetManager` enforces `isBlocked()`. |
| **4. Guard Live Calls Behind `--allow-live`** | Only the official evaluation harness can hit Gemini endpoints, strictly requiring `--allow-live`. All 10 legacy scratch scripts with raw API calls deleted. Documented that Google AI Studio playground & Antigravity consume the same quota pool. | `eval-integrity.test.ts`: `GUARD LIVE CALLS BEHIND --allow-live` passed; scratch scripts removed. |
| **5. Smoke Command (`npm run eval:smoke`)** | Implemented `client.executeSmokeCall()` and CLI flag `--smoke`. Added `"eval:smoke"` script in `package.json`. Validates exact response shape and token breakdown. **Not run** (0 live calls). | Verified via typecheck and offline harness wiring. |
| **6. Docs & Reporting Polish** | Fixed "Gemini 3.5" typo to "Gemini 3.6". Explicitly documented strict model segregation for Stage 3 (`local/ollama:<model>`), never pooled with Gemini. Updated `eval:daily` to print Pacific date, Casablanca time, and next reset. | `EVAL_DESIGN.md` updated; `dailyRunner.ts` verified in mock run. |

---

## 2. Raw Unedited Test & Build Outputs

### A. TypeScript Typecheck (`npm run typecheck`)
```
> aether-flow-monorepo@1.0.0 typecheck
> tsc --noEmit
```
*(Clean compilation with exit code 0)*

---

### B. Evaluation Integrity Test Suite (`npm test --workspace=@aether-flow/eval`)
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
✔ ORACLE INTEGRITY: Hidden checker is NEVER called inside condition loops (581.7593ms)
✔ TOOL RETRIEVAL: ToolLibrary retrieves tools via description similarity without familyId (0.8592ms)
[SECURITY WARNING] Running Sandbox in insecure subprocess mode. OS-level network isolation is disabled!
✔ CONDITION D REUSE VALIDATION: Validates candidates using public examples only (248.5434ms)
✔ CALL ESTIMATOR & STAGED EVALUATION: Precision math for Stage 1, Stage 2, and Stage 3 (1.7276ms)
✔ DAILY BUDGET COUNTER: Enforces call limits and throws DailyBudgetExceededError (70.1644ms)
[API RETRY (PER-MINUTE 429)] Backing off for 0.5s (Attempt 1/2). Every retry counts against daily budget...
✔ TYPED PROVIDER ERROR VS TASK ERROR: Errors in sandbox code containing "500", "network", "abort", "quota", "429" are scored as normal task failures and NOT excluded (583.56ms)
✔ STRUCTURED 429 FIXTURE - DAILY QUOTA: Identifies daily metric, sets blockedUntil to Pacific midnight, stops with 0 retries (25.4743ms)
[API RETRY (UNCLASSIFIED 429)] Cannot classify quota metric. Retrying at most once after 0.0s (Attempt 1/1)...
✔ STRUCTURED 429 FIXTURE - PER-MINUTE: Identifies per-minute metric, parses retryDelay, retries up to 2 times, counts all retries (1022.5662ms)
✔ STRUCTURED 429 FIXTURE - UNCLASSIFIED: Retries at most once, does NOT block the day (1011.605ms)
✔ ERROR REDACTION: saveRedactedErrorBody sanitizes API keys and tokens (4.9403ms)
✔ PACIFIC DATE KEYING & RESET TIME IN CASABLANCA: Verifies midnight alignment in America/Los_Angeles and conversion to Africa/Casablanca (3.1136ms)
✔ GUARD LIVE CALLS BEHIND --allow-live: Refuses live calls without explicit flag (3.5563ms)
✔ DAILY STATUS COMPUTE: Accurately calculates progress and determines active stage (15.8679ms)
ℹ tests 13
ℹ suites 0
ℹ pass 13
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 4960.3332
```

---

### C. Daily Runner Output Display (`node packages/eval/dist/index.js --daily --provider=mock`)
```
================================================================
            AETHERFLOW DAILY STAGED EVALUATION RUNNER           
================================================================
Pacific Date:     2026-10-29 (Google AI Studio reset boundary)
Casablanca Time:  Oct 30, 2026, 02:52:15 AM GMT+1
Calls Used Today: 0/18 (Remaining Budget: 18)
Next Quota Reset: Oct 30, 2026, 08:00:00 AM GMT+1 (Oct 30, 2026, 12:00:00 AM PDT)
Current Target:   Stage 1: Core Synthesis & Sandboxing (A, C0, C)
Stage Progress:   0/45 task-condition pairs completed (45 remaining)
================================================================
...
================================================================
                    TODAY'S RUN SUMMARY                         
================================================================
Pacific Date:     2026-10-29
Casablanca Time:  Oct 30, 2026, 02:53:10 AM GMT+1
Calls Used Today: 0/18 (Calls made this session: 0)
Remaining Budget: 18
Next Quota Reset: Oct 30, 2026, 08:00:00 AM GMT+1 (Oct 30, 2026, 12:00:00 AM PDT)
Stage Progress:   0/30 completed (30 remaining)
Remaining work: 30 items left in Stage 2: Fixed Palette & Dynamic Reuse (B, D)
Run 'npm run eval:daily' again tomorrow after Oct 30, 2026, 08:00:00 AM GMT+1 to continue.
================================================================
```

---

## 3. Hostile Self-Review (10 Concrete Weaknesses & Resolution)

1. **Weakness:** In `saveRedactedErrorBody`, query parameter sanitization (`key=[a-zA-Z0-9_\-]+`) executed before Google's `AIza` regex, which replaced query keys with `key=[REDACTED]` rather than `key=[REDACTED_API_KEY]`.
   - **Resolution:** Fixed regex in `packages/eval/src/utils/errors.ts` to replace with `key=[REDACTED_API_KEY]` and sanitized Bearer tokens with `Bearer [REDACTED_TOKEN]`. Tested via dedicated unit test.
2. **Weakness:** Unclassified 429 errors without `retryDelay` defaulted to 15 seconds backoff, which could block unit tests for 15s.
   - **Resolution:** Added `retryDelay: "0.01s"` in the unclassified fixture for fast test execution, while production keeps the safe 15s backoff.
3. **Weakness:** Substring matching in previous condition handlers (`err.message.includes('429')`) could inadvertently classify model-generated code errors as provider errors.
   - **Resolution:** Rewrote condition catch blocks in `ConditionA.ts`, `ConditionB.ts`, `ConditionC0.ts`, `ConditionC.ts`, and `ConditionD.ts` to strictly check `err instanceof ProviderError`. Sandbox runtime errors remain `RUNTIME_ERROR` even if their message contains `"429"` or `"quota"`.
4. **Weakness:** Previous timezone calculation used host local date, causing day boundary mismatch with Google AI Studio.
   - **Resolution:** Keyed the daily budget explicitly to `Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' })`. Added `getNextPacificMidnight()` to calculate exact Pacific reset boundary.
5. **Weakness:** Previous runner had no mechanism to refuse calls after a daily 429 occurred until manually reset.
   - **Resolution:** Added `blockedUntil` field in `DailyBudgetRecord`. When a structured daily 429 occurs, `blockedUntil` is set to the next Pacific midnight, and `checkBudgetOrThrow()` refuses any subsequent calls with an informative error.
6. **Weakness:** Scratch scripts in the workspace (`test_flash.mjs`, `test_gemini.mjs`) had unmetered live API call logic that previously consumed quota.
   - **Resolution:** Deleted all 10 unmetered scratch scripts. Live calls are strictly guarded behind `allowLive: boolean` in `EvalModelClient`.
7. **Weakness:** `EvalModelClient` lacked a single-call verification command to validate live response shape before starting long daily runs.
   - **Resolution:** Added `executeSmokeCall()` to `EvalModelClient` and wired `npm run eval:smoke` to dispatch exactly 1 prompt (`"Respond with OK"`) with token breakdown logging.
8. **Weakness:** Documentation contained "Gemini 3.5 Flash", while Google dashboard reported Gemini 3.6 Flash.
   - **Resolution:** Corrected typo in `EVAL_DESIGN.md` and explained the root cause: early scratch scripts called `gemini-flash-latest`, which Google resolves to Gemini 3.6 Flash. The official harness exclusively pins `gemini-3.8-flash`.
9. **Weakness:** Potential confusion if Stage 3 local Ollama results were ever combined with Gemini free-tier data.
   - **Resolution:** Explicitly mandated in `EVAL_DESIGN.md` that Stage 3 results must be reported under `local/ollama:<model>` and strictly segregated from Gemini benchmarks.
10. **Weakness:** Network latency or socket hangup during live calls was untyped.
    - **Resolution:** Wrapped fetch in `AbortController` (35s timeout) and converted any network/connection failure directly to `ProviderError` with `isNetworkError: true`, preserving harness integrity.

---

## 4. Full Source Code of Core Updated Files

### A. `packages/eval/src/utils/errors.ts`
```typescript
import fs from 'node:fs';
import path from 'node:path';

export class DailyBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyBudgetExceededError';
  }
}

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class DailyQuotaExhaustedError extends Error {
  public readonly resetTimeCasablanca?: string;
  public readonly blockedUntil?: string;
  constructor(message: string, options?: { resetTimeCasablanca?: string; blockedUntil?: string }) {
    super(message);
    this.name = 'DailyQuotaExhaustedError';
    this.resetTimeCasablanca = options?.resetTimeCasablanca;
    this.blockedUntil = options?.blockedUntil;
  }
}

export type QuotaExhaustionType = 'DAILY' | 'PER_MINUTE' | 'UNCLASSIFIED';

export interface StructuredQuotaAnalysis {
  type: QuotaExhaustionType;
  metric?: string;
  quotaId?: string;
  retryDelayMs?: number;
  reason?: string;
  details?: unknown[];
}

/**
 * Analyzes structured JSON error details returned by Google Gemini / Cloud APIs.
 * Categorizes 429 errors into DAILY (RPD), PER_MINUTE (RPM), or UNCLASSIFIED.
 */
export function analyzeStructuredQuotaError(rawBody: unknown): StructuredQuotaAnalysis {
  let bodyObj: any = rawBody;
  if (typeof rawBody === 'string') {
    try {
      bodyObj = JSON.parse(rawBody);
    } catch {
      return { type: 'UNCLASSIFIED' };
    }
  }

  const errObj = bodyObj?.error;
  if (!errObj) {
    return { type: 'UNCLASSIFIED' };
  }

  const details: any[] = Array.isArray(errObj.details) ? errObj.details : [];
  let metric: string | undefined;
  let quotaId: string | undefined;
  let retryDelayMs: number | undefined;

  for (const item of details) {
    // 1. Inspect RetryInfo for retryDelay (e.g. "13.45s")
    if (
      item['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' &&
      typeof item.retryDelay === 'string'
    ) {
      const match = item.retryDelay.match(/^([\d.]+)s$/);
      if (match) {
        retryDelayMs = Math.ceil(parseFloat(match[1]) * 1000);
      }
    }

    // 2. Inspect ErrorInfo for metadata quota_metric and quota_id
    if (
      item['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo' &&
      item.metadata &&
      typeof item.metadata === 'object'
    ) {
      if (item.metadata.quota_metric) metric = String(item.metadata.quota_metric);
      if (item.metadata.quota_id) quotaId = String(item.metadata.quota_id);
      if (item.metadata.quota_location) {
        const l = String(item.metadata.quota_location).match(/quotaId\/(.+)/);
        if (l) quotaId = l[1];
      }
    }

    // 3. Inspect QuotaFailure violations
    if (
      item['@type'] === 'type.googleapis.com/google.rpc.QuotaFailure' &&
      Array.isArray(item.violations)
    ) {
      for (const v of item.violations) {
        if (v.subject) {
          const m = String(v.subject).match(/metric:(.+)/);
          if (m) metric = m[1];
          const q = String(v.subject).match(/quotaId:(.+)/);
          if (q) quotaId = q[1];
        }
      }
    }
  }

  const combined = `${metric || ''} ${quotaId || ''}`.toLowerCase();

  // Daily quota indicators in structured metadata
  if (
    combined.includes('per_day') ||
    combined.includes('perday') ||
    combined.includes('daily') ||
    combined.includes('requests_per_day')
  ) {
    return {
      type: 'DAILY',
      metric,
      quotaId,
      retryDelayMs,
      reason: 'Structured metadata quota_metric/quota_id indicates per-day limit exceeded',
      details,
    };
  }

  // Per-minute quota indicators in structured metadata
  if (
    combined.includes('per_minute') ||
    combined.includes('perminute') ||
    combined.includes('requests_per_minute')
  ) {
    return {
      type: 'PER_MINUTE',
      metric,
      quotaId,
      retryDelayMs,
      reason: 'Structured metadata quota_metric/quota_id indicates per-minute limit exceeded',
      details,
    };
  }

  // Check QuotaFailure violations text if metadata was missing
  for (const item of details) {
    if (Array.isArray(item.violations)) {
      for (const v of item.violations) {
        const desc = String(v.description || '').toLowerCase();
        if (desc.includes('perday') || desc.includes('per day') || desc.includes('requestsperday')) {
          return {
            type: 'DAILY',
            metric,
            quotaId,
            retryDelayMs,
            reason: `QuotaFailure violation: ${v.description}`,
            details,
          };
        }
        if (desc.includes('perminute') || desc.includes('per minute') || desc.includes('requestsperminute')) {
          return {
            type: 'PER_MINUTE',
            metric,
            quotaId,
            retryDelayMs,
            reason: `QuotaFailure violation: ${v.description}`,
            details,
          };
        }
      }
    }
  }

  return { type: 'UNCLASSIFIED', metric, quotaId, retryDelayMs, details };
}

/**
 * Saves redacted raw API error response body to disk for debugging.
 * Redacts any query parameter API keys or Authorization headers.
 */
export function saveRedactedErrorBody(rawBody: unknown, filename = 'eval_last_provider_error.json'): void {
  try {
    let str = typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody, null, 2);
    // Redact query parameter keys
    str = str.replace(/([?&]key=)[a-zA-Z0-9_\-]+/gi, '$1[REDACTED_API_KEY]');
    str = str.replace(/key=[a-zA-Z0-9_\-]+/gi, 'key=[REDACTED_API_KEY]');
    // Redact Google AI Studio API key pattern (AIza...)
    str = str.replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_API_KEY]');
    // Redact Bearer tokens
    str = str.replace(/Bearer\s+[a-zA-Z0-9_\-\.]+/gi, 'Bearer [REDACTED_TOKEN]');

    fs.writeFileSync(path.resolve(process.cwd(), filename), str, 'utf8');
  } catch {
    // Non-fatal
  }
}

/**
 * Strongly typed error representing failures originating strictly from the model provider.
 * NEVER instantiated by sandbox execution, AST checks, or ground truth checkers.
 */
export class ProviderError extends Error {
  public readonly httpStatus?: number;
  public readonly isNetworkError: boolean;
  public readonly rawErrorBody?: unknown;
  public readonly quotaAnalysis?: StructuredQuotaAnalysis;
  public readonly originalError?: unknown;

  constructor(
    message: string,
    options?: {
      httpStatus?: number;
      isNetworkError?: boolean;
      rawErrorBody?: unknown;
      quotaAnalysis?: StructuredQuotaAnalysis;
      originalError?: unknown;
    }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.httpStatus = options?.httpStatus;
    this.isNetworkError = options?.isNetworkError ?? false;
    this.rawErrorBody = options?.rawErrorBody;
    this.quotaAnalysis = options?.quotaAnalysis;
    this.originalError = options?.originalError;
  }
}

export function isHarnessStopError(err: unknown): boolean {
  return (
    err instanceof DailyBudgetExceededError ||
    err instanceof DailyQuotaExhaustedError ||
    err instanceof BudgetExceededError
  );
}
```

---

### B. `packages/eval/src/limiter/DailyBudgetManager.ts`
```typescript
import fs from 'node:fs';
import path from 'node:path';
import {
  DailyBudgetExceededError,
  DailyQuotaExhaustedError,
} from '../utils/errors.js';

export { DailyBudgetExceededError, DailyQuotaExhaustedError };

export interface DailyBudgetRecord {
  datePacific: string;
  callsToday: number;
  maxDailyBudget: number;
  blockedUntil?: string; // ISO string if daily quota was exhausted by Google
  lastUpdated: string;
  note: string;
}

/**
 * Returns the current calendar date in America/Los_Angeles (Pacific Time) as YYYY-MM-DD.
 * Google AI Studio daily free-tier quotas reset at midnight Pacific Time.
 */
export function getPacificDateString(date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

/**
 * Computes the exact Date when the next midnight occurs in America/Los_Angeles.
 */
export function getNextPacificMidnight(now = new Date()): Date {
  const pacificDateStr = getPacificDateString(now);
  const [year, month, day] = pacificDateStr.split('-').map(Number);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const nextYear = tomorrow.getUTCFullYear();
  const nextMonth = String(tomorrow.getUTCMonth() + 1).padStart(2, '0');
  const nextDay = String(tomorrow.getUTCDate()).padStart(2, '0');
  const targetIsoDate = `${nextYear}-${nextMonth}-${nextDay}`;

  for (let h = 5; h <= 10; h++) {
    const candidate = new Date(Date.UTC(nextYear, Number(nextMonth) - 1, Number(nextDay), h, 0, 0, 0));
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(candidate);
    const hour = parts.find((p) => p.type === 'hour')?.value;
    const min = parts.find((p) => p.type === 'minute')?.value;
    const pDate = getPacificDateString(candidate);
    if (pDate === targetIsoDate && hour === '00' && min === '00') {
      return candidate;
    }
  }
  return new Date(Date.UTC(nextYear, Number(nextMonth) - 1, Number(nextDay), 7, 0, 0, 0));
}

/**
 * Formats a Date in a specific timezone for user-friendly display.
 */
export function formatInTimezone(date: Date, timeZone = 'Africa/Casablanca'): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  }).format(date);
}

export class DailyBudgetManager {
  private filePath: string;
  private maxDailyBudget: number;

  constructor(filePath = '.eval_daily_budget.json', maxDailyBudget = 18) {
    this.filePath = path.resolve(process.cwd(), filePath);
    this.maxDailyBudget = maxDailyBudget;
  }

  private readRecord(): DailyBudgetRecord {
    const todayPacific = getPacificDateString();
    if (fs.existsSync(this.filePath)) {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        const parsed = JSON.parse(raw) as DailyBudgetRecord;
        if (parsed && parsed.datePacific === todayPacific) {
          return parsed;
        }
      } catch {
        // Fall through on corrupt read
      }
    }

    // New Pacific day: reset call count
    const initial: DailyBudgetRecord = {
      datePacific: todayPacific,
      callsToday: 0,
      maxDailyBudget: this.maxDailyBudget,
      lastUpdated: new Date().toISOString(),
      note: 'Keyed strictly to America/Los_Angeles calendar date (Google AI Studio reset boundary).',
    };
    this.writeRecord(initial);
    return initial;
  }

  private writeRecord(record: DailyBudgetRecord): void {
    try {
      record.lastUpdated = new Date().toISOString();
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

  public getPacificDate(): string {
    return this.readRecord().datePacific;
  }

  public getBlockedUntil(): Date | null {
    const record = this.readRecord();
    if (record.blockedUntil) {
      const d = new Date(record.blockedUntil);
      if (!isNaN(d.getTime())) return d;
    }
    return null;
  }

  public isBlocked(now = new Date()): boolean {
    const blockedUntil = this.getBlockedUntil();
    if (!blockedUntil) return false;
    return now.getTime() < blockedUntil.getTime();
  }

  public setBlockedUntil(date: Date): void {
    const record = this.readRecord();
    record.blockedUntil = date.toISOString();
    this.writeRecord(record);
  }

  public getNextResetTime(): Date {
    return getNextPacificMidnight();
  }

  public getNextResetDisplay(userTimezone = 'Africa/Casablanca'): { casablanca: string; pacific: string } {
    const resetDate = this.getNextResetTime();
    return {
      casablanca: formatInTimezone(resetDate, userTimezone),
      pacific: formatInTimezone(resetDate, 'America/Los_Angeles'),
    };
  }

  public checkBudgetOrThrow(now = new Date()): void {
    const record = this.readRecord();

    // 1. Check if blocked by a previous daily-quota 429
    if (this.isBlocked(now)) {
      const reset = this.getNextResetDisplay('Africa/Casablanca');
      throw new DailyQuotaExhaustedError(
        `[DAILY QUOTA BLOCKED] Google API daily quota is exhausted. Blocked until next Pacific midnight (${reset.casablanca} Casablanca time / ${reset.pacific} Pacific). Refusing API calls until reset.`,
        { resetTimeCasablanca: reset.casablanca, blockedUntil: record.blockedUntil }
      );
    }

    // 2. Check if daily budget call count reached
    if (record.callsToday >= this.maxDailyBudget) {
      const reset = this.getNextResetDisplay('Africa/Casablanca');
      throw new DailyBudgetExceededError(
        `Daily API call budget reached (${record.callsToday}/${this.maxDailyBudget} calls used today on Pacific date ${record.datePacific}). Next reset at ${reset.casablanca} (Casablanca) / ${reset.pacific} (Pacific). State saved. Run 'npm run eval:daily' tomorrow to resume.`
      );
    }
  }

  public recordCall(): void {
    const record = this.readRecord();
    record.callsToday += 1;
    this.writeRecord(record);
  }
}
```

---

## 5. Git Status Summary

```
Changes to be committed on branch checkpoint-a-fix:
	modified:   .gitignore
	modified:   EVAL_DESIGN.md
	modified:   package.json
	modified:   packages/eval/src/conditions/ConditionA.ts
	modified:   packages/eval/src/conditions/ConditionB.ts
	modified:   packages/eval/src/conditions/ConditionC.ts
	modified:   packages/eval/src/conditions/ConditionC0.ts
	modified:   packages/eval/src/conditions/ConditionD.ts
	modified:   packages/eval/src/harness/EvalHarness.ts
	modified:   packages/eval/src/harness/dailyRunner.ts
	modified:   packages/eval/src/index.ts
	modified:   packages/eval/src/limiter/DailyBudgetManager.ts
	modified:   packages/eval/src/limiter/RateLimiter.ts
	modified:   packages/eval/src/providers/EvalModelClient.ts
	modified:   packages/eval/src/tests/eval-integrity.test.ts
	modified:   packages/eval/src/types.ts
	modified:   packages/eval/src/utils/errors.ts
```

All 6 requirements are fully satisfied and verified offline. Stopping per instructions.
