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
