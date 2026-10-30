# REVIEW_B_3: Deterministic Checkers & Reference Solutions Source Code

This document provides the full, unedited source code for the 5 domain checkers and reference solutions implementing feasibility and optimality validation instead of naive string matching.

---

## 1. `packages/eval/src/tasks/checkers/knapsack-checker.ts`
```typescript
import { CheckerResult } from '../../types.js';

export interface KnapsackItem {
  id: number;
  value: number;
  weight: number;
  volume: number;
}

export interface KnapsackInput {
  items: KnapsackItem[];
  maxWeight: number;
  maxVolume: number;
}

export interface KnapsackOutput {
  selectedIds: number[];
  totalValue: number;
}

export function solveKnapsackReference(input: KnapsackInput): KnapsackOutput {
  const { items, maxWeight: W, maxVolume: V } = input;
  const n = items.length;

  // 3D DP array flattened or 2D DP for (W, V)
  // dp[w][v] = max value with weight <= w and volume <= v
  const dp: number[][] = Array.from({ length: W + 1 }, () => Array(V + 1).fill(0));
  // Keep track of item subsets using bitsets / sets
  const picked: boolean[][][] = Array.from({ length: n }, () =>
    Array.from({ length: W + 1 }, () => Array(V + 1).fill(false))
  );

  for (let i = 0; i < n; i++) {
    const { weight: w_i, volume: v_i, value: val_i } = items[i];
    for (let w = W; w >= w_i; w--) {
      for (let v = V; v >= v_i; v--) {
        if (dp[w - w_i][v - v_i] + val_i > dp[w][v]) {
          dp[w][v] = dp[w - w_i][v - v_i] + val_i;
          picked[i][w][v] = true;
        }
      }
    }
  }

  // Backtrace
  const selectedIds: number[] = [];
  let curW = W;
  let curV = V;

  for (let i = n - 1; i >= 0; i--) {
    if (picked[i][curW][curV]) {
      selectedIds.push(items[i].id);
      curW -= items[i].weight;
      curV -= items[i].volume;
    }
  }

  selectedIds.sort((a, b) => a - b);
  return {
    selectedIds,
    totalValue: dp[W][V],
  };
}

export function checkKnapsack(candidateOutput: unknown, input: unknown): CheckerResult {
  const kInput = input as KnapsackInput;
  const optimalSolution = solveKnapsackReference(kInput);

  if (!candidateOutput || typeof candidateOutput !== 'object') {
    return { pass: false, reason: 'Expected object { selectedIds, totalValue }' };
  }

  const cand = candidateOutput as KnapsackOutput;
  if (!Array.isArray(cand.selectedIds)) {
    return { pass: false, reason: 'Candidate missing selectedIds array' };
  }

  if (typeof cand.totalValue !== 'number') {
    return { pass: false, reason: 'Candidate missing numeric totalValue' };
  }

  // 1. Check Feasibility
  const seenIds = new Set<number>();
  let sumWeight = 0;
  let sumVolume = 0;
  let sumValue = 0;

  for (const id of cand.selectedIds) {
    if (seenIds.has(id)) {
      return { pass: false, reason: `Duplicate item id ${id} selected` };
    }
    seenIds.add(id);

    const item = kInput.items.find((it) => it.id === id);
    if (!item) {
      return { pass: false, reason: `Selected non-existent item id ${id}` };
    }

    sumWeight += item.weight;
    sumVolume += item.volume;
    sumValue += item.value;
  }

  if (sumWeight > kInput.maxWeight) {
    return {
      pass: false,
      reason: `Weight limit exceeded: total weight is ${sumWeight}, max allowed is ${kInput.maxWeight}`,
    };
  }

  if (sumVolume > kInput.maxVolume) {
    return {
      pass: false,
      reason: `Volume limit exceeded: total volume is ${sumVolume}, max allowed is ${kInput.maxVolume}`,
    };
  }

  if (sumValue !== cand.totalValue) {
    return {
      pass: false,
      reason: `Reported totalValue (${cand.totalValue}) does not match sum of selected items (${sumValue})`,
    };
  }

  // 2. Check Optimality
  if (sumValue !== optimalSolution.totalValue) {
    return {
      pass: false,
      reason: `Sub-optimal selection: candidate achieved value ${sumValue}, optimal maximum is ${optimalSolution.totalValue}`,
    };
  }

  return { pass: true };
}
```

---

## 2. `packages/eval/src/tasks/checkers/levenshtein-checker.ts`
```typescript
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
```

---

## 3. `packages/eval/src/tasks/checkers/dijkstra-checker.ts`
```typescript
import { CheckerResult } from '../../types.js';

export type CompassDir = 'N' | 'S' | 'E' | 'W';

export interface DirectedEdge {
  from: string;
  to: string;
  weight: number;
  direction: CompassDir;
}

export interface TurnPenalties {
  straight: number;
  right: number;
  left: number;
  uTurn: number;
}

export interface DijkstraInput {
  nodes: string[];
  edges: DirectedEdge[];
  start: string;
  end: string;
  turnPenalties: TurnPenalties;
}

export interface DijkstraOutput {
  path: string[];
  totalCost: number;
}

function getTurnType(d1: CompassDir, d2: CompassDir): 'straight' | 'right' | 'left' | 'uTurn' {
  if (d1 === d2) return 'straight';
  const dirs: CompassDir[] = ['N', 'E', 'S', 'W'];
  const i1 = dirs.indexOf(d1);
  const i2 = dirs.indexOf(d2);
  const diff = (i2 - i1 + 4) % 4;
  if (diff === 1) return 'right';
  if (diff === 2) return 'uTurn';
  return 'left';
}

export function solveDijkstraReference(input: DijkstraInput): DijkstraOutput {
  const { edges, start, end, turnPenalties } = input;

  // Build adjacency
  const adj = new Map<string, DirectedEdge[]>();
  for (const edge of edges) {
    if (!adj.has(edge.from)) adj.set(edge.from, []);
    adj.get(edge.from)!.push(edge);
  }

  // State: `${node}|${inDir || 'NONE'}` -> { cost, path }
  type StateKey = string;
  const dist = new Map<StateKey, number>();
  const parent = new Map<StateKey, { prevKey: StateKey | null; node: string }>();

  // Priority Queue: array-based min-heap or sorted array
  interface PQItem {
    node: string;
    inDir: CompassDir | null;
    cost: number;
    key: StateKey;
  }
  const pq: PQItem[] = [];

  const startKey = `${start}|NONE`;
  dist.set(startKey, 0);
  parent.set(startKey, { prevKey: null, node: start });
  pq.push({ node: start, inDir: null, cost: 0, key: startKey });

  let bestEndCost = Infinity;
  let bestEndKey: StateKey | null = null;

  while (pq.length > 0) {
    pq.sort((a, b) => a.cost - b.cost);
    const curr = pq.shift()!;

    if (curr.cost > (dist.get(curr.key) ?? Infinity)) continue;

    if (curr.node === end) {
      if (curr.cost < bestEndCost) {
        bestEndCost = curr.cost;
        bestEndKey = curr.key;
      }
      continue;
    }

    const nextEdges = adj.get(curr.node) || [];
    for (const edge of nextEdges) {
      let turnPenalty = 0;
      if (curr.inDir !== null) {
        const turn = getTurnType(curr.inDir, edge.direction);
        turnPenalty = turnPenalties[turn];
      }

      const nextCost = curr.cost + edge.weight + turnPenalty;
      const nextKey = `${edge.to}|${edge.direction}`;

      if (nextCost < (dist.get(nextKey) ?? Infinity)) {
        dist.set(nextKey, nextCost);
        parent.set(nextKey, { prevKey: curr.key, node: edge.to });
        pq.push({ node: edge.to, inDir: edge.direction, cost: nextCost, key: nextKey });
      }
    }
  }

  if (bestEndKey === null) {
    return { path: [], totalCost: -1 };
  }

  // Reconstruct path
  const path: string[] = [];
  let curK: StateKey | null = bestEndKey;
  while (curK !== null) {
    const p = parent.get(curK);
    if (!p) break;
    path.push(p.node);
    curK = p.prevKey;
  }
  path.reverse();

  return { path, totalCost: bestEndCost };
}

export function checkDijkstraPath(candidateOutput: unknown, input: unknown): CheckerResult {
  const dInput = input as DijkstraInput;
  const refSolution = solveDijkstraReference(dInput);

  if (!candidateOutput || typeof candidateOutput !== 'object') {
    return { pass: false, reason: 'Expected object { path, totalCost }' };
  }

  const cand = candidateOutput as DijkstraOutput;
  if (!Array.isArray(cand.path)) {
    return { pass: false, reason: 'Candidate missing path array' };
  }

  if (typeof cand.totalCost !== 'number') {
    return { pass: false, reason: 'Candidate missing numeric totalCost' };
  }

  // Check endpoints
  if (cand.path.length === 0 || cand.path[0] !== dInput.start) {
    return { pass: false, reason: `Path must start at ${dInput.start}` };
  }
  if (cand.path[cand.path.length - 1] !== dInput.end) {
    return { pass: false, reason: `Path must end at ${dInput.end}` };
  }

  // Verify path edges & compute exact cost
  let calculatedCost = 0;
  let prevDir: CompassDir | null = null;

  for (let i = 0; i < cand.path.length - 1; i++) {
    const u = cand.path[i];
    const v = cand.path[i + 1];

    const matchingEdge = dInput.edges.find((e) => e.from === u && e.to === v);
    if (!matchingEdge) {
      return { pass: false, reason: `No directed edge exists from '${u}' to '${v}'` };
    }

    let turnPenalty = 0;
    if (prevDir !== null) {
      const turn = getTurnType(prevDir, matchingEdge.direction);
      turnPenalty = dInput.turnPenalties[turn];
    }

    calculatedCost += matchingEdge.weight + turnPenalty;
    prevDir = matchingEdge.direction;
  }

  if (calculatedCost !== cand.totalCost) {
    return {
      pass: false,
      reason: `Reported cost (${cand.totalCost}) does not match true traversed cost (${calculatedCost})`,
    };
  }

  if (calculatedCost !== refSolution.totalCost) {
    return {
      pass: false,
      reason: `Sub-optimal path: candidate cost is ${calculatedCost}, optimal minimum is ${refSolution.totalCost}`,
    };
  }

  return { pass: true };
}
```

---

## 4. `packages/eval/src/tasks/checkers/markdown-checker.ts`
```typescript
import { CheckerResult } from '../../types.js';

export interface MarkdownTableInput {
  markdown: string;
}

export type MarkdownTableRow = Record<string, string | number | boolean>;

export function parseMarkdownTableReference(input: MarkdownTableInput): MarkdownTableRow[] {
  const lines = input.markdown
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && l.endsWith('|'));

  if (lines.length < 3) return [];

  // Parse headers
  const headerLine = lines[0];
  const rawHeaders = splitTableLine(headerLine);

  const rows: MarkdownTableRow[] = [];
  for (let i = 2; i < lines.length; i++) {
    const rawCells = splitTableLine(lines[i]);
    const rowObj: MarkdownTableRow = {};
    for (let c = 0; c < rawHeaders.length; c++) {
      const colName = rawHeaders[c];
      const rawVal = rawCells[c] ?? '';
      rowObj[colName] = coerceVal(rawVal);
    }
    rows.push(rowObj);
  }
  return rows;
}

function splitTableLine(line: string): string[] {
  // Strip outer pipes
  const inner = line.replace(/^\|/, '').replace(/\|$/, '');
  // Split on pipe NOT preceded by backslash
  const parts: string[] = [];
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '|' && (i === 0 || inner[i - 1] !== '\\')) {
      parts.push(cur.replace(/\\\|/g, '|').trim());
      cur = '';
    } else {
      cur += inner[i];
    }
  }
  parts.push(cur.replace(/\\\|/g, '|').trim());
  return parts;
}

function coerceVal(val: string): string | number | boolean {
  if (val.toLowerCase() === 'true') return true;
  if (val.toLowerCase() === 'false') return false;
  if (/^-?\d+(\.\d+)?$/.test(val)) return Number(val);
  return val;
}

export function checkMarkdownTable(candidateOutput: unknown, input: unknown): CheckerResult {
  const tableInput = input as MarkdownTableInput;
  const expected = parseMarkdownTableReference(tableInput);

  if (!Array.isArray(candidateOutput)) {
    return { pass: false, reason: 'Expected candidate output to be an array of row objects' };
  }

  if (candidateOutput.length !== expected.length) {
    return {
      pass: false,
      reason: `Row count mismatch: expected ${expected.length}, got ${candidateOutput.length}`,
    };
  }

  for (let r = 0; r < expected.length; r++) {
    const expRow = expected[r];
    const candRow = candidateOutput[r] as Record<string, unknown>;
    if (!candRow || typeof candRow !== 'object') {
      return { pass: false, reason: `Row ${r} is not an object` };
    }

    const expKeys = Object.keys(expRow);
    const candKeys = Object.keys(candRow);

    if (expKeys.length !== candKeys.length) {
      return {
        pass: false,
        reason: `Row ${r} key count mismatch: expected [${expKeys.join(', ')}], got [${candKeys.join(', ')}]`,
      };
    }

    for (const key of expKeys) {
      if (String(candRow[key]) !== String(expRow[key])) {
        return {
          pass: false,
          reason: `Row ${r} key '${key}' mismatch: expected '${expRow[key]}', got '${candRow[key]}'`,
        };
      }
    }
  }

  return { pass: true };
}
```

---

## 5. `packages/eval/src/tasks/checkers/csv-pivot-checker.ts`
```typescript
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
```
