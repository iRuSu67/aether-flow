import fs from 'node:fs';
import path from 'node:path';

export class BudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceededError';
  }
}

export class DailyBudgetExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyBudgetExceededError';
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
  let retryDelayMs: number | undefined;
  let metric: string | undefined;
  let quotaId: string | undefined;

  for (const item of details) {
    // 1. RetryInfo (standard google.rpc.RetryInfo)
    if (item.retryDelay) {
      const match = String(item.retryDelay).match(/(\d+(?:\.\d+)?)\s*s/i);
      if (match) {
        retryDelayMs = Math.ceil(parseFloat(match[1]) * 1000);
      }
    }

    // 2. ErrorInfo metadata (standard google.rpc.ErrorInfo)
    if (item.metadata) {
      if (item.metadata.quota_metric) metric = String(item.metadata.quota_metric);
      if (item.metadata.quota_id) quotaId = String(item.metadata.quota_id);
    }

    // 3. QuotaFailure violations (standard google.rpc.QuotaFailure)
    if (Array.isArray(item.violations)) {
      for (const v of item.violations) {
        if (v.description) {
          const desc = String(v.description);
          if (!metric && desc.includes('quota metric')) {
            const m = desc.match(/quota metric '([^']+)'/i);
            if (m) metric = m[1];
          }
          if (!quotaId && desc.includes('limit')) {
            const l = desc.match(/limit '([^']+)'/i);
            if (l) quotaId = l[1];
          }
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
            reason: 'QuotaFailure violation description indicates per-day limit',
            details,
          };
        }
        if (desc.includes('perminute') || desc.includes('per minute') || desc.includes('requestsperminute')) {
          return {
            type: 'PER_MINUTE',
            metric,
            quotaId,
            retryDelayMs,
            reason: 'QuotaFailure violation description indicates per-minute limit',
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
