import { CheckerResult } from '../../types.js';

export interface CSVPivotInput {
  csv: string;
  rowField: string;
  colField: string;
  sumField: string;
  avgField: string;
}

export type PivotCell = { sum: number; avg: number };
export type PivotTable = Record<string, Record<string, PivotCell>>;

export function solveCSVPivotReference(input: CSVPivotInput): PivotTable {
  const lines = input.csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return {};

  const headers = lines[0].split(',').map((h) => h.trim());
  const rIdx = headers.indexOf(input.rowField);
  const cIdx = headers.indexOf(input.colField);
  const sIdx = headers.indexOf(input.sumField);
  const aIdx = headers.indexOf(input.avgField);

  if (rIdx < 0 || cIdx < 0 || sIdx < 0 || aIdx < 0) {
    throw new Error('CSV missing required header fields');
  }

  // Accumulate
  interface Acc {
    sumVal: number;
    avgSum: number;
    avgCount: number;
  }
  const map = new Map<string, Map<string, Acc>>();

  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < headers.length) continue;

    const rKey = parts[rIdx];
    const cKey = parts[cIdx];
    const sVal = Number(parts[sIdx]) || 0;
    const aVal = Number(parts[aIdx]) || 0;

    if (!map.has(rKey)) map.set(rKey, new Map());
    const rowMap = map.get(rKey)!;

    if (!rowMap.has(cKey)) {
      rowMap.set(cKey, { sumVal: 0, avgSum: 0, avgCount: 0 });
    }
    const acc = rowMap.get(cKey)!;
    acc.sumVal += sVal;
    acc.avgSum += aVal;
    acc.avgCount += 1;
  }

  const result: PivotTable = {};
  for (const [rKey, colMap] of map.entries()) {
    result[rKey] = {};
    for (const [cKey, acc] of colMap.entries()) {
      const avg = acc.avgCount > 0 ? Number((acc.avgSum / acc.avgCount).toFixed(2)) : 0;
      const sum = Number(acc.sumVal.toFixed(2));
      result[rKey][cKey] = { sum, avg };
    }
  }
  return result;
}

export function checkCSVPivot(candidateOutput: unknown, input: unknown): CheckerResult {
  const pInput = input as CSVPivotInput;
  const expected = solveCSVPivotReference(pInput);

  if (!candidateOutput || typeof candidateOutput !== 'object' || Array.isArray(candidateOutput)) {
    return { pass: false, reason: 'Expected candidate output to be a 2D nested map object' };
  }

  const cand = candidateOutput as Record<string, Record<string, { sum: number; avg: number }>>;
  const expRowKeys = Object.keys(expected).sort();
  const candRowKeys = Object.keys(cand).sort();

  if (expRowKeys.length !== candRowKeys.length) {
    return {
      pass: false,
      reason: `Row keys count mismatch: expected ${expRowKeys.length}, got ${candRowKeys.length}`,
    };
  }

  for (const rKey of expRowKeys) {
    if (!cand[rKey] || typeof cand[rKey] !== 'object') {
      return { pass: false, reason: `Missing row key '${rKey}' in candidate output` };
    }

    const expColKeys = Object.keys(expected[rKey]).sort();
    const candColKeys = Object.keys(cand[rKey]).sort();

    if (expColKeys.length !== candColKeys.length) {
      return {
        pass: false,
        reason: `Row '${rKey}' column count mismatch: expected ${expColKeys.length}, got ${candColKeys.length}`,
      };
    }

    for (const cKey of expColKeys) {
      const expCell = expected[rKey][cKey];
      const candCell = cand[rKey][cKey];

      if (!candCell || typeof candCell !== 'object') {
        return { pass: false, reason: `Cell [${rKey}][${cKey}] missing or invalid in candidate output` };
      }

      // Check sum tolerance
      if (typeof candCell.sum !== 'number' || Math.abs(candCell.sum - expCell.sum) > 0.05) {
        return {
          pass: false,
          reason: `Cell [${rKey}][${cKey}] sum mismatch: expected ${expCell.sum}, got ${candCell.sum}`,
        };
      }

      // Check avg tolerance
      if (typeof candCell.avg !== 'number' || Math.abs(candCell.avg - expCell.avg) > 0.05) {
        return {
          pass: false,
          reason: `Cell [${rKey}][${cKey}] avg mismatch: expected ${expCell.avg}, got ${candCell.avg}`,
        };
      }
    }
  }

  return { pass: true };
}
