import { CheckerResult } from '../../types.js';

export interface LevenshteinInput {
  source: string;
  target: string;
}

export type EditOp = 'keep' | 'insert' | 'delete' | 'substitute';

export interface EditOperation {
  op: EditOp;
  char?: string;
}

export interface LevenshteinOutput {
  editDistance: number;
  operations: EditOperation[];
}

export function computeLevenshteinDP(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

export function solveLevenshteinReference(input: LevenshteinInput): LevenshteinOutput {
  const s1 = input.source;
  const s2 = input.target;
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  // Backtrace
  const ops: EditOperation[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && s1[i - 1] === s2[j - 1]) {
      ops.push({ op: 'keep', char: s1[i - 1] });
      i--;
      j--;
    } else if (i > 0 && j > 0 && dp[i][j] === dp[i - 1][j - 1] + 1) {
      ops.push({ op: 'substitute', char: s2[j - 1] });
      i--;
      j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      ops.push({ op: 'insert', char: s2[j - 1] });
      j--;
    } else {
      ops.push({ op: 'delete', char: s1[i - 1] });
      i--;
    }
  }

  ops.reverse();
  return {
    editDistance: dp[m][n],
    operations: ops,
  };
}

export function checkLevenshteinAlignment(candidateOutput: unknown, input: unknown): CheckerResult {
  const { source, target } = input as LevenshteinInput;
  const optimalDist = computeLevenshteinDP(source, target);

  if (!candidateOutput || typeof candidateOutput !== 'object') {
    return { pass: false, reason: 'Candidate output must be an object { editDistance, operations }' };
  }

  const cand = candidateOutput as LevenshteinOutput;
  if (typeof cand.editDistance !== 'number') {
    return { pass: false, reason: 'Candidate missing numeric editDistance' };
  }

  if (!Array.isArray(cand.operations)) {
    return { pass: false, reason: 'Candidate missing operations array' };
  }

  // 1. Check Optimality
  let nonKeepCount = 0;
  for (const op of cand.operations) {
    if (op.op !== 'keep') nonKeepCount++;
  }

  if (cand.editDistance !== optimalDist) {
    return {
      pass: false,
      reason: `Sub-optimal or incorrect editDistance: expected ${optimalDist}, got ${cand.editDistance}`,
    };
  }

  if (nonKeepCount !== optimalDist) {
    return {
      pass: false,
      reason: `Operation count mismatch: script has ${nonKeepCount} non-keep ops, expected ${optimalDist}`,
    };
  }

  // 2. Check Feasibility: apply operations to source, must produce target
  let sIdx = 0;
  let reconstructed = '';

  for (let oIdx = 0; oIdx < cand.operations.length; oIdx++) {
    const step = cand.operations[oIdx];
    switch (step.op) {
      case 'keep':
        if (sIdx >= source.length || source[sIdx] !== step.char) {
          return {
            pass: false,
            reason: `Invalid 'keep' at op ${oIdx}: source[${sIdx}] is '${source[sIdx]}', step specifies '${step.char}'`,
          };
        }
        reconstructed += step.char;
        sIdx++;
        break;
      case 'delete':
        if (sIdx >= source.length) {
          return { pass: false, reason: `Invalid 'delete' at op ${oIdx}: source index out of bounds` };
        }
        sIdx++;
        break;
      case 'insert':
        if (!step.char) {
          return { pass: false, reason: `Invalid 'insert' at op ${oIdx}: missing char` };
        }
        reconstructed += step.char;
        break;
      case 'substitute':
        if (sIdx >= source.length || !step.char) {
          return { pass: false, reason: `Invalid 'substitute' at op ${oIdx}: missing char or source out of bounds` };
        }
        reconstructed += step.char;
        sIdx++;
        break;
      default:
        return { pass: false, reason: `Unknown op: ${(step as any).op}` };
    }
  }

  if (sIdx !== source.length) {
    return {
      pass: false,
      reason: `Edit script did not consume entire source string (consumed ${sIdx}/${source.length})`,
    };
  }

  if (reconstructed !== target) {
    return {
      pass: false,
      reason: `Edit script failed to reconstruct target: produced '${reconstructed}', expected '${target}'`,
    };
  }

  return { pass: true };
}
