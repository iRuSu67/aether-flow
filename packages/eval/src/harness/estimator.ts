import { CallEstimates, ConditionId } from '../types.js';

export interface StageEstimate {
  stage: number;
  name: string;
  conditions: ConditionId[];
  tasks: number;
  runs: number;
  minCalls: number;
  typicalCalls: number;
  maxCalls: number;
  dailyBudget: number;
  minDays: number;
  typicalDays: number;
  maxDays: number;
  description: string;
}

/**
 * Single authoritative source of truth for API call estimation.
 * Computes exact min, typical, and max API call counts for a given number of tasks and run repetitions.
 */
export function estimateApiCalls(
  taskCount: number,
  runs: number,
  conditions: ConditionId[] = ['A', 'B', 'C0', 'C', 'D']
): CallEstimates {
  const T = taskCount;
  const N = runs;

  const initialVariantCount = Math.ceil(T / 3);
  const reuseEligibleCount = Math.max(0, T - initialVariantCount);

  // Condition D min: all 'a' variants need 1 call, all eligible variants reuse successfully (0 calls)
  const dMin = initialVariantCount * N * 1;
  // Condition D typical: 'a' variants take ~2 calls, eligible variants have ~80% reuse hit rate (0 calls) and ~20% miss (take ~2 calls)
  const dTyp = Math.round((initialVariantCount * 2 + reuseEligibleCount * 0.2 * 2) * N);
  // Condition D max: all variants miss/fail and exhaust all 3 retry attempts (4 total calls)
  const dMax = T * N * 4;

  const perCondition: Record<ConditionId, { min: number; typical: number; max: number }> = {
    A: { min: T * N * 1, typical: T * N * 1, max: T * N * 1 },
    B: { min: T * N * 1, typical: T * N * 2, max: T * N * 3 },
    C0: { min: T * N * 1, typical: T * N * 1, max: T * N * 1 },
    C: { min: T * N * 1, typical: T * N * 2, max: T * N * 4 },
    D: { min: dMin, typical: dTyp, max: dMax },
  };

  let minCalls = 0;
  let typicalCalls = 0;
  let maxCalls = 0;

  for (const cond of conditions) {
    minCalls += perCondition[cond].min;
    typicalCalls += perCondition[cond].typical;
    maxCalls += perCondition[cond].max;
  }

  return { minCalls, typicalCalls, maxCalls, perCondition };
}

/**
 * Computes precise estimates and daily durations for the staged evaluation plan.
 */
export function estimateStagedEvaluation(taskCount = 15, dailyBudget = 18): StageEstimate[] {
  // Stage 1: Conditions A, C0, C with N=1
  const s1Conds: ConditionId[] = ['A', 'C0', 'C'];
  const s1 = estimateApiCalls(taskCount, 1, s1Conds);

  // Stage 2: Conditions B, D with N=1
  const s2Conds: ConditionId[] = ['B', 'D'];
  const s2 = estimateApiCalls(taskCount, 1, s2Conds);

  // Stage 3: Extra runs (N=3) for variance / local model
  const s3Conds: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];
  const s3 = estimateApiCalls(taskCount, 3, s3Conds);

  return [
    {
      stage: 1,
      name: 'Stage 1: Core Synthesis & Sandboxing (A, C0, C)',
      conditions: s1Conds,
      tasks: taskCount,
      runs: 1,
      minCalls: s1.minCalls,
      typicalCalls: s1.typicalCalls,
      maxCalls: s1.maxCalls,
      dailyBudget,
      minDays: Math.ceil(s1.minCalls / dailyBudget),
      typicalDays: Math.ceil(s1.typicalCalls / dailyBudget),
      maxDays: Math.ceil(s1.maxCalls / dailyBudget),
      description: 'Answers core questions: Does code execution help (A vs C0)? Does retry loop help (C0 vs C)?',
    },
    {
      stage: 2,
      name: 'Stage 2: Fixed Palette & Dynamic Reuse (B, D)',
      conditions: s2Conds,
      tasks: taskCount,
      runs: 1,
      minCalls: s2.minCalls,
      typicalCalls: s2.typicalCalls,
      maxCalls: s2.maxCalls,
      dailyBudget,
      minDays: Math.ceil(s2.minCalls / dailyBudget),
      typicalDays: Math.ceil(s2.typicalCalls / dailyBudget),
      maxDays: Math.ceil(s2.maxCalls / dailyBudget),
      description: 'Answers: Does dynamic synthesis beat fixed tool palette (C vs B)? Does description reuse save calls (D vs C)?',
    },
    {
      stage: 3,
      name: 'Stage 3: Multi-Run Confidence Intervals (N=3, Local / Unmetered)',
      conditions: s3Conds,
      tasks: taskCount,
      runs: 3,
      minCalls: s3.minCalls,
      typicalCalls: s3.typicalCalls,
      maxCalls: s3.maxCalls,
      dailyBudget: 0,
      minDays: 1,
      typicalDays: 1,
      maxDays: 1,
      description: 'Variance reduction and confidence intervals; executed via Ollama local adapter or unmetered tier.',
    },
  ];
}
