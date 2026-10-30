import { ALL_TASKS } from '../tasks/registry.js';
import { CheckpointManager } from '../checkpoints/CheckpointManager.js';
import { DailyBudgetManager, formatInTimezone } from '../limiter/DailyBudgetManager.js';
import { EvalHarness } from './EvalHarness.js';
import { ConditionId, EvalOptions } from '../types.js';
import { DEFAULT_EVAL_MODEL, getModelProfile } from '../config/models.js';

export interface DailyStatus {
  model: string;
  datePacific: string;
  timeCasablanca: string;
  callsToday: number;
  maxDailyBudget: number;
  remainingCalls: number;
  nextResetCasablanca: string;
  nextResetPacific: string;
  isBlocked: boolean;
  blockedUntil?: string | null;
  stage: number;
  stageName: string;
  stageTotalItems: number;
  stageCompletedItems: number;
  stageRemainingItems: number;
  allDone: boolean;
}

export function computeDailyStatus(
  checkpointFile = 'eval_checkpoint.json',
  budgetFile = '.eval_daily_budget.json',
  maxDailyBudget?: number,
  model = DEFAULT_EVAL_MODEL,
  runs = 3
): DailyStatus {
  const profile = getModelProfile(model);
  const budget = new DailyBudgetManager(budgetFile, maxDailyBudget ?? profile.defaultDailyBudget, model);
  const checkpoint = new CheckpointManager(checkpointFile);
  const tasks = ALL_TASKS;
  const now = new Date();

  let stage = 1;
  let stageName = '';
  let stageTotalItems = 0;
  let stageCompletedItems = 0;
  let stageRemainingItems = 0;
  let allDone = false;

  if (model === 'gemini-3.8-flash') {
    // Stage-based execution for low-quota reasoning model (20 RPD / 18 daily budget)
    const s1Conds: ConditionId[] = ['A', 'C0', 'C'];
    const s2Conds: ConditionId[] = ['B', 'D'];

    const s1Completed = tasks
      .flatMap((t) => s1Conds.map((c) => ({ taskId: t.id, condition: c })))
      .filter((tc) => checkpoint.isCompleted(tc.taskId, tc.condition, 0)).length;
    const s1Total = tasks.length * s1Conds.length; // 45

    const s2Completed = tasks
      .flatMap((t) => s2Conds.map((c) => ({ taskId: t.id, condition: c })))
      .filter((tc) => checkpoint.isCompleted(tc.taskId, tc.condition, 0)).length;
    const s2Total = tasks.length * s2Conds.length; // 30

    if (s1Completed < s1Total) {
      stage = 1;
      stageName = 'Stage 1: Core Synthesis & Sandboxing (A, C0, C | N=1)';
      stageTotalItems = s1Total;
      stageCompletedItems = s1Completed;
      stageRemainingItems = s1Total - s1Completed;
    } else if (s2Completed < s2Total) {
      stage = 2;
      stageName = 'Stage 2: Fixed Palette & Dynamic Reuse (B, D | N=1)';
      stageTotalItems = s2Total;
      stageCompletedItems = s2Completed;
      stageRemainingItems = s2Total - s2Completed;
    } else {
      stage = 3;
      stageName = 'Stage 3: All Free-Tier Stages Completed! (Extra runs require local/billing)';
      stageTotalItems = s1Total + s2Total;
      stageCompletedItems = s1Total + s2Total;
      stageRemainingItems = 0;
      allDone = true;
    }
  } else {
    // Main Run: Full Multi-Condition Evaluation (A, B, C0, C, D) with N=3 runs per task
    const allConds: ConditionId[] = ['A', 'B', 'C0', 'C', 'D'];
    stageTotalItems = tasks.length * allConds.length * runs; // 15 * 5 * 3 = 225

    let completed = 0;
    for (let r = 0; r < runs; r++) {
      for (const t of tasks) {
        for (const c of allConds) {
          if (checkpoint.isCompleted(t.id, c, r)) {
            completed++;
          }
        }
      }
    }

    stage = 1;
    stageName = `Main Benchmark Run: Full Multi-Condition Evaluation (A, B, C0, C, D | N=${runs})`;
    stageCompletedItems = completed;
    stageRemainingItems = Math.max(0, stageTotalItems - completed);
    allDone = (stageRemainingItems === 0);
  }

  const resetDisplay = budget.getNextResetDisplay('Africa/Casablanca');
  const timeCasablanca = formatInTimezone(now, 'Africa/Casablanca');
  const datePacific = budget.getPacificDate();
  const isBlocked = budget.isBlocked(now);
  const blockedUntil = budget.getBlockedUntil()?.toISOString() ?? null;

  return {
    model,
    datePacific,
    timeCasablanca,
    callsToday: budget.getCallsToday(),
    maxDailyBudget: budget.getMaxBudget(),
    remainingCalls: budget.getRemainingCalls(),
    nextResetCasablanca: resetDisplay.casablanca,
    nextResetPacific: resetDisplay.pacific,
    isBlocked,
    blockedUntil,
    stage,
    stageName,
    stageTotalItems,
    stageCompletedItems,
    stageRemainingItems,
    allDone,
  };
}

export async function runDailyEval(options: Partial<EvalOptions> = {}): Promise<void> {
  const model = options.model ?? DEFAULT_EVAL_MODEL;
  const profile = getModelProfile(model);
  const maxBudget = options.dailyBudget ?? profile.defaultDailyBudget;
  const checkpointFile = options.checkpointFile ?? 'eval_checkpoint.json';
  const runs = options.runs ?? (model === 'gemini-3.8-flash' ? 1 : 3);
  const status = computeDailyStatus(checkpointFile, '.eval_daily_budget.json', maxBudget, model, runs);

  console.log('================================================================');
  console.log('            AETHERFLOW DAILY EVALUATION RUNNER                  ');
  console.log('================================================================');
  console.log(`Model:            ${status.model} (${profile.description})`);
  console.log(`Pacing Interval:  ~${(profile.minPacingMs / 1000).toFixed(1)}s minimum (${profile.rpm} RPM / ${profile.tpm.toLocaleString()} TPM)`);
  console.log(`Pacific Date:     ${status.datePacific} (Google AI Studio reset boundary)`);
  console.log(`Casablanca Time:  ${status.timeCasablanca}`);
  console.log(
    `Calls Used Today: ${status.callsToday}/${status.maxDailyBudget} (Remaining Budget: ${status.remainingCalls})`
  );
  console.log(`Next Quota Reset: ${status.nextResetCasablanca} (${status.nextResetPacific})`);
  if (status.isBlocked) {
    console.log(`⚠️ STATUS: QUOTA BLOCKED for ${status.model} until ${status.nextResetCasablanca} due to Google 429`);
  }
  console.log(`Current Target:   ${status.stageName}`);
  console.log(
    `Overall Progress: ${status.stageCompletedItems}/${status.stageTotalItems} task-condition-run items completed (${status.stageRemainingItems} remaining)`
  );
  console.log('================================================================\n');

  if (status.allDone) {
    console.log(`✔ All evaluation tasks for [${status.model}] have been successfully completed!`);
    console.log(`Review isolated results in eval_results_${status.model.replace(/[^a-zA-Z0-9_-]/g, '_')}.json.`);
    return;
  }

  if (status.isBlocked) {
    console.log(`[DAILY QUOTA EXHAUSTED: ${status.model}] Google API daily quota is exhausted.`);
    console.log(`Blocked until next Pacific midnight: ${status.nextResetCasablanca} (Casablanca time).`);
    console.log('State is safely preserved in checkpoint. Run "npm run eval:daily" after reset to continue.\n');
    return;
  }

  if (status.remainingCalls <= 0) {
    console.log(`[DAILY BUDGET EXHAUSTED: ${status.model}] Today's budget of ${status.maxDailyBudget} calls is already used up.`);
    console.log('State is safely preserved in checkpoint.');
    console.log(`Next reset at ${status.nextResetCasablanca} (Casablanca time). Run "npm run eval:daily" tomorrow after reset.\n`);
    return;
  }

  const harnessOptions: Partial<EvalOptions> = {
    ...options,
    model,
    stage: model === 'gemini-3.8-flash' ? (status.stage as any) : undefined,
    runs,
    resume: true,
    dailyBudget: maxBudget,
    rpm: options.rpm ?? profile.rpm,
    rpd: options.rpd ?? profile.rpd,
    maxCalls: status.remainingCalls,
  };

  const harness = new EvalHarness(harnessOptions);
  await harness.run();

  const finalStatus = computeDailyStatus(checkpointFile, '.eval_daily_budget.json', maxBudget, model, runs);
  console.log('\n================================================================');
  console.log('                    TODAY\'S RUN SUMMARY                         ');
  console.log('================================================================');
  console.log(`Model:            ${finalStatus.model}`);
  console.log(`Pacific Date:     ${finalStatus.datePacific}`);
  console.log(`Casablanca Time:  ${finalStatus.timeCasablanca}`);
  console.log(
    `Calls Used Today: ${finalStatus.callsToday}/${finalStatus.maxDailyBudget} (Calls made this session: ${finalStatus.callsToday - status.callsToday})`
  );
  console.log(`Remaining Budget: ${finalStatus.remainingCalls}`);
  console.log(`Next Quota Reset: ${finalStatus.nextResetCasablanca} (${finalStatus.nextResetPacific})`);
  console.log(
    `Overall Progress: ${finalStatus.stageCompletedItems}/${finalStatus.stageTotalItems} completed (${finalStatus.stageRemainingItems} remaining)`
  );
  if (finalStatus.stageRemainingItems === 0) {
    console.log(`✔ ${finalStatus.stageName} is COMPLETE!`);
  } else {
    console.log(`Remaining work: ${finalStatus.stageRemainingItems} items left in ${finalStatus.stageName}`);
    console.log(`Run 'npm run eval:daily' again tomorrow after ${finalStatus.nextResetCasablanca} to continue.`);
  }
  console.log('================================================================\n');
}
