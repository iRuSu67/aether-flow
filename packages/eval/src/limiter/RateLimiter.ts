import {
  DailyBudgetManager,
  DailyBudgetExceededError,
  DailyQuotaExhaustedError,
} from './DailyBudgetManager.js';
import {
  ProviderError,
  analyzeStructuredQuotaError,
  saveRedactedErrorBody,
  BudgetExceededError,
  StructuredQuotaAnalysis,
} from '../utils/errors.js';

export { DailyBudgetExceededError, DailyQuotaExhaustedError, BudgetExceededError };

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
  private savedFirstError = false;

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

    // 2. Check persistent daily budget & blocked state (Pacific date boundary)
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

  public async executeWithRetry<T>(fn: () => Promise<T>): Promise<T> {
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

        // Save first real provider error body (redacted)
        if (!this.savedFirstError && err instanceof ProviderError && err.rawErrorBody) {
          this.savedFirstError = true;
          saveRedactedErrorBody(err.rawErrorBody, 'eval_last_provider_error.json');
        }

        // Analyze quota error if it's a 429
        if (err instanceof ProviderError && err.httpStatus === 429) {
          const quotaAnalysis: StructuredQuotaAnalysis =
            err.quotaAnalysis ?? analyzeStructuredQuotaError(err.rawErrorBody);

          // 1. Structured DAILY Quota Exhausted: NEVER retry, persist blockedUntil
          if (quotaAnalysis.type === 'DAILY') {
            const nextMidnight = this.dailyBudget.getNextResetTime();
            this.dailyBudget.setBlockedUntil(nextMidnight);
            const reset = this.dailyBudget.getNextResetDisplay('Africa/Casablanca');
            throw new DailyQuotaExhaustedError(
              `[DAILY QUOTA EXHAUSTED] Provider returned structured per-day quota exhaustion (${quotaAnalysis.reason}). Blocked until next Pacific midnight (${reset.casablanca} Casablanca time / ${reset.pacific} Pacific). Stopping immediately without retries.`,
              { resetTimeCasablanca: reset.casablanca, blockedUntil: nextMidnight.toISOString() }
            );
          }

          // 2. Structured PER_MINUTE Quota Limit: Retry up to 2 times
          if (quotaAnalysis.type === 'PER_MINUTE') {
            const maxRetries = 2;
            if (attempt < maxRetries) {
              attempt++;
              const baseDelay = quotaAnalysis.retryDelayMs ?? Math.max(13000, Math.pow(2, attempt) * 10000);
              const jitter = Math.floor(Math.random() * 2000);
              const backoffMs = baseDelay + jitter;
              console.warn(
                `[API RETRY (PER-MINUTE 429)] Backing off for ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt}/${maxRetries}). Every retry counts against daily budget...`
              );
              await new Promise((resolve) => setTimeout(resolve, backoffMs));
              continue;
            }
            throw err;
          }

          // 3. UNCLASSIFIED 429: Retry at most ONCE after retryDelay, then stop (do NOT mark day exhausted)
          const maxUnclassifiedRetries = 1;
          if (attempt < maxUnclassifiedRetries) {
            attempt++;
            const backoffMs = quotaAnalysis.retryDelayMs ?? 15000;
            console.warn(
              `[API RETRY (UNCLASSIFIED 429)] Cannot classify quota metric. Retrying at most once after ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt}/1)...`
            );
            await new Promise((resolve) => setTimeout(resolve, backoffMs));
            continue;
          }
          throw err;
        }

        // Transient 503 / High demand overload: retry up to 2 times
        const isTransient503 =
          err instanceof ProviderError && (err.httpStatus === 503 || err.isNetworkError);

        if (isTransient503 && attempt < 2) {
          attempt++;
          const backoffMs = Math.max(13000, Math.pow(2, attempt) * 10000);
          console.warn(
            `[API RETRY (503/NETWORK)] Backing off for ${(backoffMs / 1000).toFixed(1)}s (Attempt ${attempt}/2). Every retry counts against daily budget...`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          continue;
        }

        throw err;
      }
    }
  }
}
