/**
 * ASTVerifier
 * Static code analysis, vulnerability scanning, and safety verification
 * for dynamically synthesized JavaScript tools prior to sandbox execution.
 */

export interface VerificationReport {
  isSafe: boolean;
  warnings: string[];
  bannedPatternsDetected: string[];
  complexityScore: number;
}

export class ASTVerifier {
  private bannedTokens = [
    'process.exit',
    'process.kill',
    'process.env',
    'child_process',
    '__proto__',
    'prototype',
    'require(',
    'import(',
    'eval(',
    'new Function',
    'globalThis',
    'global.',
    'window.',
    'document.',
    'fetch(', // Only allow fetch via sandbox injected handlers if authorized
  ];

  private infiniteLoopPatterns = [
    /while\s*\(\s*true\s*\)/i,
    /while\s*\(\s*1\s*\)/i,
    /for\s*\(\s*;\s*;\s*\)/i,
  ];

  /**
   * Statically verify synthesized JavaScript code before sandbox ingestion
   */
  public verify(code: string): VerificationReport {
    const warnings: string[] = [];
    const bannedDetected: string[] = [];

    // 1. Check banned tokens
    for (const token of this.bannedTokens) {
      if (code.includes(token)) {
        bannedDetected.push(`BANNED_TOKEN: ${token}`);
      }
    }

    // 2. Check infinite loops
    for (const loopPattern of this.infiniteLoopPatterns) {
      if (loopPattern.test(code)) {
        bannedDetected.push(`POTENTIAL_INFINITE_LOOP: ${loopPattern.source}`);
      }
    }

    // 3. Check for export signature
    if (!code.includes('export default') && !code.includes('function execute') && !code.includes('return')) {
      warnings.push('MISSING_EXECUTION_SIGNATURE: Code does not appear to export an execute function');
    }

    // 4. Calculate complexity heuristic (cyclomatic depth estimation)
    const branches = (code.match(/\b(if|else|for|while|switch|case|catch)\b/g) || []).length;
    const complexityScore = branches + 1;

    if (complexityScore > 25) {
      warnings.push(`HIGH_CYCLOMATIC_COMPLEXITY: Score ${complexityScore} exceeds standard threshold`);
    }

    const isSafe = bannedDetected.length === 0;

    return {
      isSafe,
      warnings,
      bannedPatternsDetected: bannedDetected,
      complexityScore,
    };
  }
}
