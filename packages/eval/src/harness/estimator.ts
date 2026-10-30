import { CallEstimates, ConditionId } from '../types.js';
import { DEFAULT_EVAL_MODEL, getModelProfile } from '../config/models.js';

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

export interface ModelRunPlanEstimate {
  model: string;
  planName: string;
  isMainRun: boolean;
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
  minPacingMs: number;
  pacingNotes: string;
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
 * Estimates the Main Benchmark Run with the lightweight model (gemini-3.5-flash-lite).
 * Runs all conditions (A, B, C0, C, D) with N=3 on 450 calls/day budget.
 */
export function estimateMainRun(
  taskCount = 15,
  runs = 3,
  dailyBudget = 450
): ModelRunPlanEstimate {
  const conditions: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];
  const calls = estimateApiCalls(taskCount, runs, conditions);
  const profile = getModelProfile(DEFAULT_EVAL_MODEL);

  return {
    model: DEFAULT_EVAL_MODEL,
    planName: 'Main Benchmark Evaluation (Full N=3 Multi-Condition Run)',
    isMainRun: true,
    conditions,
    tasks: taskCount,
    runs,
    minCalls: calls.minCalls,
    typicalCalls: calls.typicalCalls,
    maxCalls: calls.maxCalls,
    dailyBudget,
    minDays: Math.ceil(calls.minCalls / dailyBudget), // 195 / 450 = 1 day
    typicalDays: Math.ceil(calls.typicalCalls / dailyBudget), // 312 / 450 = 1 day
    maxDays: Math.ceil(calls.maxCalls / dailyBudget), // 585 / 450 = 2 days
    minPacingMs: profile.minPacingMs,
    pacingNotes: `Paced at ~4.5s intervals (15 RPM / 250K TPM limits).`,
    description: `Complete multi-condition benchmark (A, B, C0, C, D) with N=3, completing in 1 to 2 days on free tier.`,
  };
}

/**
 * Estimates an optional spot-check run on Gemini 3.8 Flash (strict 20 RPD / 18 daily budget).
 */
export function estimateSpotCheck38(
  taskCount = 3, // 1 representative family
  runs = 1,
  dailyBudget = 18
): ModelRunPlanEstimate {
  const conditions: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];
  const calls = estimateApiCalls(taskCount, runs, conditions);
  const profile = getModelProfile('gemini-3.8-flash');

  return {
    model: 'gemini-3.8-flash',
    planName: 'Optional Spot-Check Run: Gemini 3.8 Flash (Reasoning Model)',
    isMainRun: false,
    conditions,
    tasks: taskCount,
    runs,
    minCalls: calls.minCalls,
    typicalCalls: calls.typicalCalls,
    maxCalls: calls.maxCalls,
    dailyBudget,
    minDays: Math.ceil(calls.minCalls / dailyBudget),
    typicalDays: Math.ceil(calls.typicalCalls / dailyBudget),
    maxDays: Math.ceil(calls.maxCalls / dailyBudget),
    minPacingMs: profile.minPacingMs,
    pacingNotes: `Paced at 13.0s minimum intervals (5 RPM / 20 RPD limits).`,
    description: `Focused spot-check on 1 task family to cross-reference reasoning model behavior under separate quota.`,
  };
}

/**
 * Estimates an optional run on Gemma 4 (26B/31B) with TPM-aware pacing.
 */
export function estimateGemmaRun(
  model = 'gemma-4-26b',
  taskCount = 15,
  runs = 3,
  dailyBudget = 10000
): ModelRunPlanEstimate {
  const conditions: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];
  const calls = estimateApiCalls(taskCount, runs, conditions);
  const profile = getModelProfile(model);

  return {
    model,
    planName: `Optional Open-Weight Run: ${model.toUpperCase()} (TPM-Aware)`,
    isMainRun: false,
    conditions,
    tasks: taskCount,
    runs,
    minCalls: calls.minCalls,
    typicalCalls: calls.typicalCalls,
    maxCalls: calls.maxCalls,
    dailyBudget,
    minDays: 1,
    typicalDays: 1,
    maxDays: 1,
    minPacingMs: profile.minPacingMs,
    pacingNotes: `TPM-aware pacing at >= 7.5s (strictly respects 16,000 TPM limit with 30 RPM / 14.4K RPD).`,
    description: `Open-weight model evaluation with thinkingConfig disabled and TPM-aware pacing.`,
  };
}

/**
 * Computes precise estimates and daily durations for the staged evaluation plan.
 * Maintained for backward compatibility and multi-stage execution.
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
