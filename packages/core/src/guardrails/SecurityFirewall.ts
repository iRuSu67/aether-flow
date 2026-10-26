/**
 * SecurityFirewall & Guardrails
 * Real-time defense layer protecting multi-agent swarms against prompt injections,
 * jailbreaks, recursive token exhaustion, and sensitive data leakage.
 */

export interface FirewallAuditResult {
  allowed: boolean;
  sanitizedInput: string;
  flaggedRules: string[];
  riskScore: number; // 0.0 (safe) to 1.0 (malicious)
}

export interface BudgetState {
  totalTokensUsed: number;
  maxTokenBudget: number;
  estimatedCostUSD: number;
}

export class SecurityFirewall {
  private injectionPatterns: RegExp[] = [
    /ignore (all )?previous instructions/i,
    /disregard (all )?prior rules/i,
    /you are now in developer mode/i,
    /system override/i,
    /reveal your system prompt/i,
    /act as an unrestricted/i,
    /bypass safety filter/i,
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /drop\s+table/i,
    /rm\s+-rf\s+\//i,
  ];

  private piiPatterns: Array<{ name: string; regex: RegExp; mask: string }> = [
    { name: 'EMAIL', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, mask: '[REDACTED_EMAIL]' },
    { name: 'IPV4', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, mask: '[REDACTED_IP]' },
    { name: 'API_KEY', regex: /(?:sk-[a-zA-Z0-9]{20,}|AIza[0-9A-Za-z-_]{35})/g, mask: '[REDACTED_API_KEY]' },
  ];

  private budget: BudgetState;

  constructor(maxTokenBudget = 1_000_000) {
    this.budget = {
      totalTokensUsed: 0,
      maxTokenBudget,
      estimatedCostUSD: 0,
    };
  }

  /**
   * Audit incoming prompt or tool parameter for adversarial payloads
   */
  public auditInput(input: string): FirewallAuditResult {
    const flaggedRules: string[] = [];
    let riskScore = 0.0;

    for (const pattern of this.injectionPatterns) {
      if (pattern.test(input)) {
        flaggedRules.push(`INJECTION_DETECTED: ${pattern.source}`);
        riskScore += 0.4;
      }
    }

    // Mask PII
    let sanitized = input;
    for (const pii of this.piiPatterns) {
      if (pii.regex.test(sanitized)) {
        sanitized = sanitized.replace(pii.regex, pii.mask);
        flaggedRules.push(`PII_MASKED: ${pii.name}`);
        riskScore += 0.1;
      }
    }

    riskScore = Math.min(riskScore, 1.0);
    const allowed = riskScore < 0.7;

    return {
      allowed,
      sanitizedInput: sanitized,
      flaggedRules,
      riskScore: Number(riskScore.toFixed(2)),
    };
  }

  /**
   * Track token usage and enforce budgetary guardrails
   */
  public recordTokenUsage(tokens: number, costPer1k = 0.002): boolean {
    this.budget.totalTokensUsed += tokens;
    this.budget.estimatedCostUSD += (tokens / 1000) * costPer1k;

    if (this.budget.totalTokensUsed >= this.budget.maxTokenBudget) {
      console.warn(`[SecurityFirewall] Token budget exhausted: ${this.budget.totalTokensUsed}/${this.budget.maxTokenBudget}`);
      return false; // Budget breach
    }
    return true;
  }

  public getBudget(): BudgetState {
    return { ...this.budget };
  }
}
