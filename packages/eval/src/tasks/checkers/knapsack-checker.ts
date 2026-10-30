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
