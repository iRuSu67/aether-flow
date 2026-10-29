import { ALL_TASKS } from '../tasks/registry.js';
import { CheckpointManager } from '../checkpoints/CheckpointManager.js';
import { DailyBudgetManager, getLocalDateString } from '../limiter/DailyBudgetManager.js';
import { EvalHarness } from './EvalHarness.js';
import { ConditionId, EvalOptions } from '../types.js';

export interface DailyStatus {
  date: string;
  timezone: string;
  callsToday: number;
  maxDailyBudget: number;
  remainingCalls: number;
  stage: 1 | 2 | 3;
  stageName: string;
  stageTotalItems: number;
  stageCompletedItems: number;
  stageRemainingItems: number;
  allDone: boolean;
}

export function computeDailyStatus(
  checkpointFile = 'eval_checkpoint.json',
  budgetFile = '.eval_daily_budget.json',
  maxDailyBudget = 18
): DailyStatus {
  const budget = new DailyBudgetManager(budgetFile, maxDailyBudget);
  const checkpoint = new CheckpointManager(checkpointFile);
  const tasks = ALL_TASKS;

  const s1Conds: ConditionId[] = ['A', 'C0', 'C'];
  const s2Conds: ConditionId[] = ['B', 'D'];

  const s1Completed = tasks
    .flatMap((t) => s1Conds.map((c) => ({ taskId: t.id, condition: c })))
    .filter((tc) => checkpoint.isCompleted(tc.taskId, tc.condition, 0)).length;
  const s1Total = tasks.length * s1Conds.length; // 15 * 3 = 45

  const s2Completed = tasks
    .flatMap((t) => s2Conds.map((c) => ({ taskId: t.id, condition: c })))
    .filter((tc) => checkpoint.isCompleted(tc.taskId, tc.condition, 0)).length;
  const s2Total = tasks.length * s2Conds.length; // 15 * 2 = 30

  let stage: 1 | 2 | 3 = 1;
  let stageName = 'Stage 1: Core Synthesis & Sandboxing (A, C0, C)';
  let stageTotalItems = s1Total;
  let stageCompletedItems = s1Completed;
  let stageRemainingItems = s1Total - s1Completed;
  let allDone = false;

  if (s1Completed < s1Total) {
    stage = 1;
    stageName = 'Stage 1: Core Synthesis & Sandboxing (A, C0, C)';
    stageTotalItems = s1Total;
    stageCompletedItems = s1Completed;
    stageRemainingItems = s1Total - s1Completed;
  } else if (s2Completed < s2Total) {
    stage = 2;
    stageName = 'Stage 2: Fixed Palette & Dynamic Reuse (B, D)';
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

  return {
    date: getLocalDateString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    callsToday: budget.getCallsToday(),
    maxDailyBudget: budget.getMaxBudget(),
    remainingCalls: budget.getRemainingCalls(),
    stage,
    stageName,
    stageTotalItems,
    stageCompletedItems,
    stageRemainingItems,
    allDone,
  };
}

export async function runDailyEval(options: Partial<EvalOptions> = {}): Promise<void> {
  const maxBudget = options.dailyBudget ?? 18;
  const checkpointFile = options.checkpointFile ?? 'eval_checkpoint.json';
  const status = computeDailyStatus(checkpointFile, '.eval_daily_budget.json', maxBudget);

  console.log('================================================================');
  console.log('            AETHERFLOW DAILY STAGED EVALUATION RUNNER           ');
  console.log('================================================================');
  console.log(`Date: ${status.date} [${status.timezone}]`);
  console.log(
    `Daily Call Budget: ${status.callsToday}/${status.maxDailyBudget} calls used today (Remaining: ${status.remainingCalls})`
  );
  console.log(`Current Target: ${status.stageName}`);
  console.log(
    `Stage Progress: ${status.stageCompletedItems}/${status.stageTotalItems} task-condition pairs completed (${status.stageRemainingItems} remaining)`
  );
  console.log('================================================================\n');

  if (status.allDone) {
    console.log('✔ All Stage 1 and Stage 2 evaluation tasks have been successfully completed!');
    console.log('Review results in eval/results/ or run Stage 3 with a local model (Ollama).');
    return;
  }

  if (status.remainingCalls <= 0) {
    console.log(`[DAILY BUDGET EXHAUSTED] Today's budget of ${status.maxDailyBudget} calls is already used up.`);
    console.log('State is safely preserved in checkpoint.');
    console.log('Run "npm run eval:daily" tomorrow after Google API quota reset to continue.\n');
    return;
  }

  const harnessOptions: Partial<EvalOptions> = {
    ...options,
    stage: status.stage,
    runs: 1,
    resume: true,
    dailyBudget: maxBudget,
    rpm: options.rpm ?? 5,
    rpd: options.rpd ?? 20,
    maxCalls: status.remainingCalls,
  };

  const harness = new EvalHarness(harnessOptions);
  await harness.run();

  const finalStatus = computeDailyStatus(checkpointFile, '.eval_daily_budget.json', maxBudget);
  console.log('\n================================================================');
  console.log('                    TODAY\'S RUN SUMMARY                         ');
  console.log('================================================================');
  console.log(
    `Calls Used Today: ${finalStatus.callsToday}/${finalStatus.maxDailyBudget} (Calls made this session: ${finalStatus.callsToday - status.callsToday})`
  );
  console.log(
    `Stage Progress:   ${finalStatus.stageCompletedItems}/${finalStatus.stageTotalItems} completed (${finalStatus.stageRemainingItems} remaining)`
  );
  if (finalStatus.stageRemainingItems === 0) {
    console.log(`✔ ${finalStatus.stageName} is COMPLETE!`);
  } else {
    console.log(`Remaining work: ${finalStatus.stageRemainingItems} items left in ${finalStatus.stageName}`);
    console.log(`Run 'npm run eval:daily' again tomorrow to continue.`);
  }
  console.log('================================================================\n');
}
