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
