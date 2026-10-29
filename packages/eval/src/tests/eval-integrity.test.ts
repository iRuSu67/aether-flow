import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Sandbox, ASTVerifier } from '@aether-flow/core';
import { runConditionA } from '../conditions/ConditionA.js';
import { runConditionB } from '../conditions/ConditionB.js';
import { runConditionC0 } from '../conditions/ConditionC0.js';
import { runConditionC } from '../conditions/ConditionC.js';
import { runConditionD, ToolLibrary } from '../conditions/ConditionD.js';
import { estimateApiCalls, estimateStagedEvaluation } from '../harness/estimator.js';
import { RateLimiter, DailyQuotaExhaustedError, isDailyQuotaExhausted, parseRetryDelayMs } from '../limiter/RateLimiter.js';
import { DailyBudgetManager, DailyBudgetExceededError } from '../limiter/DailyBudgetManager.js';
import { ResponseCache } from '../cache/ResponseCache.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { task_1a_markdown_employees, task_1b_markdown_servers } from '../tasks/definitions/family1_markdown_table.js';
import { task_5a_knapsack_cargo } from '../tasks/definitions/family5_knapsack_dual.js';
import { AgentVisibleTask } from '../types.js';
import { computeDailyStatus } from '../harness/dailyRunner.js';

test('ORACLE INTEGRITY: Hidden checker is NEVER called inside condition loops', async () => {
  let checkerCallCount = 0;
  const wrappedTask = {
    ...task_1a_markdown_employees,
    checker: (candidate: unknown, input: unknown) => {
      checkerCallCount++;
      return task_1a_markdown_employees.checker(candidate, input);
    },
  };

  const agentTask: AgentVisibleTask = {
    id: wrappedTask.id,
    familyId: wrappedTask.familyId,
    variant: wrappedTask.variant,
    title: wrappedTask.title,
    domain: wrappedTask.domain,
    prompt: wrappedTask.prompt,
    input: wrappedTask.input,
    example: wrappedTask.example,
  };

  const cache = new ResponseCache('.eval_cache_test');
  const limiter = new RateLimiter({ maxCalls: 100, minPacingMs: 0 });
  const client = new EvalModelClient({
    provider: 'mock',
    model: 'gemini-3.8-flash',
    thinkingLevel: 'medium',
    cache,
    limiter,
  });

  const astVerifier = new ASTVerifier();
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true });
  const library = new ToolLibrary();

  // Condition A
  checkerCallCount = 0;
  await runConditionA(agentTask, 0, client);
  assert.equal(checkerCallCount, 0, 'Condition A must not invoke task.checker inside its execution');

  // Condition B
  checkerCallCount = 0;
  await runConditionB(agentTask, 0, client);
  assert.equal(checkerCallCount, 0, 'Condition B must not invoke task.checker inside its execution');

  // Condition C0
  checkerCallCount = 0;
  await runConditionC0(agentTask, 0, client, sandbox, astVerifier);
  assert.equal(checkerCallCount, 0, 'Condition C0 must not invoke task.checker inside its execution');

  // Condition C
  checkerCallCount = 0;
  await runConditionC(agentTask, 0, client, sandbox, astVerifier);
  assert.equal(checkerCallCount, 0, 'Condition C must not invoke task.checker inside its synthesis retry loop');

  // Condition D
  checkerCallCount = 0;
  await runConditionD(agentTask, 0, client, sandbox, astVerifier, library);
  assert.equal(checkerCallCount, 0, 'Condition D must not invoke task.checker during retrieval or reuse check');
});

test('TOOL RETRIEVAL: ToolLibrary retrieves tools via description similarity without familyId', () => {
  const library = new ToolLibrary();

  const codeMarkdown = 'export default async function execute(args) { return []; }';
  library.save(task_1a_markdown_employees.prompt, codeMarkdown);

  // 1. Similar task in same domain (Markdown servers table)
  const matchSimilar = library.findSimilar(task_1b_markdown_servers.prompt, 0.25);
  assert.ok(matchSimilar !== null, 'Should find similar tool for related markdown table task');
  assert.equal(matchSimilar!.code, codeMarkdown);
  assert.ok(matchSimilar!.score >= 0.25, `Similarity score ${matchSimilar!.score} should be >= 0.25`);

  // 2. Unrelated task in different domain (Knapsack optimization)
  const matchUnrelated = library.findSimilar(task_5a_knapsack_cargo.prompt, 0.25);
  assert.equal(matchUnrelated, null, 'Should NOT retrieve markdown tool for knapsack optimization task');
});

test('CONDITION D REUSE VALIDATION: Validates candidates using public examples only', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true });
  const astVerifier = new ASTVerifier();
  const cache = new ResponseCache('.eval_cache_test');
  const limiter = new RateLimiter({ maxCalls: 100, minPacingMs: 0 });
  const client = new EvalModelClient({
    provider: 'mock',
    model: 'gemini-3.8-flash',
    thinkingLevel: 'medium',
    cache,
    limiter,
  });

  const library = new ToolLibrary();

  // Save a mock tool that fails the example test
  const failingToolCode = 'export default async function execute(args) { return { wrong: "data" }; }';
  library.save(task_1a_markdown_employees.prompt, failingToolCode);

  const agentTask: AgentVisibleTask = {
    id: task_1b_markdown_servers.id,
    familyId: task_1b_markdown_servers.familyId,
    variant: task_1b_markdown_servers.variant,
    title: task_1b_markdown_servers.title,
    domain: task_1b_markdown_servers.domain,
    prompt: task_1b_markdown_servers.prompt,
    input: task_1b_markdown_servers.input,
    example: task_1b_markdown_servers.example,
  };

  // Run Condition D: failing tool should be rejected on example validation, falling back to Condition C synthesis
  const result = await runConditionD(agentTask, 0, client, sandbox, astVerifier, library);
  assert.equal(result.reused, false, 'Condition D must reject candidate tool that fails public example validation');
});

test('CALL ESTIMATOR & STAGED EVALUATION: Precision math for Stage 1, Stage 2, and Stage 3', () => {
  // Full Run: 15 tasks, 3 runs
  const fullEstimates = estimateApiCalls(15, 3);
  assert.equal(fullEstimates.minCalls, 195);
  assert.equal(fullEstimates.typicalCalls, 312);
  assert.equal(fullEstimates.maxCalls, 585);

  // Staged Evaluation Breakdown
  const stages = estimateStagedEvaluation(15, 18);
  assert.equal(stages.length, 3);

  // Stage 1 (A, C0, C), N=1
  assert.equal(stages[0].stage, 1);
  assert.equal(stages[0].minCalls, 45); // 15 + 15 + 15
  assert.equal(stages[0].typicalCalls, 60); // 15 + 15 + 30
  assert.equal(stages[0].maxCalls, 90); // 15 + 15 + 60
  assert.equal(stages[0].minDays, 3); // 45 / 18 = 2.5 -> 3
  assert.equal(stages[0].typicalDays, 4); // 60 / 18 = 3.33 -> 4
  assert.equal(stages[0].maxDays, 5); // 90 / 18 = 5.0 -> 5

  // Stage 2 (B, D), N=1
  assert.equal(stages[1].stage, 2);
  assert.equal(stages[1].minCalls, 20); // B: 15, D: 5 = 20
  assert.equal(stages[1].typicalCalls, 44); // B: 30, D: 14 = 44
  assert.equal(stages[1].maxCalls, 105); // B: 45, D: 60 = 105
  assert.equal(stages[1].minDays, 2); // 20 / 18 = 1.11 -> 2
  assert.equal(stages[1].typicalDays, 3); // 44 / 18 = 2.44 -> 3
  assert.equal(stages[1].maxDays, 6); // 105 / 18 = 5.83 -> 6
});

test('DAILY BUDGET COUNTER: Enforces call limits and throws DailyBudgetExceededError', () => {
  const testBudgetFile = '.eval_daily_budget_test.json';
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);

  const manager = new DailyBudgetManager(testBudgetFile, 3);
  assert.equal(manager.getCallsToday(), 0);
  assert.equal(manager.getRemainingCalls(), 3);

  manager.recordCall();
  manager.recordCall();
  assert.equal(manager.getCallsToday(), 2);
  assert.equal(manager.getRemainingCalls(), 1);

  manager.recordCall();
  assert.equal(manager.getCallsToday(), 3);
  assert.equal(manager.getRemainingCalls(), 0);

  assert.throws(
    () => manager.checkBudgetOrThrow(),
    DailyBudgetExceededError,
    'Must throw DailyBudgetExceededError when daily budget limit is reached'
  );

  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});

test('RATE LIMITER: Distinguishes Daily Quota 429 from Transient 429, counts retries against budget', async () => {
  const testBudgetFile = '.eval_daily_budget_rl_test.json';
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);

  const budget = new DailyBudgetManager(testBudgetFile, 10);
  const limiter = new RateLimiter({
    rpm: 60,
    dailyBudgetManager: budget,
    minPacingMs: 0,
  });

  // 1. Daily Quota Exhausted: MUST NOT retry and throws DailyQuotaExhaustedError
  let dailyAttempts = 0;
  await assert.rejects(
    async () => {
      await limiter.executeWithRetry(async () => {
        dailyAttempts++;
        throw new Error('429 Resource has been exhausted (e.g. check quota). Queries per day exceeded.');
      }, 2);
    },
    DailyQuotaExhaustedError,
    'Must throw DailyQuotaExhaustedError immediately without retrying'
  );
  assert.equal(dailyAttempts, 1, 'Must execute exactly 1 attempt on daily quota error (0 retries)');
  assert.equal(budget.getCallsToday(), 1, 'Initial failed attempt must count against daily budget');

  // 2. Transient 429: Retries up to 2 times, each retry counting against daily budget
  let transientAttempts = 0;
  const result = await limiter.executeWithRetry(async () => {
    transientAttempts++;
    if (transientAttempts < 2) {
      throw new Error('429 Too Many Requests: per-minute rate limit reached. retryDelay: 0.1s');
    }
    return 'TRANSIENT_RECOVERED';
  }, 2);

  assert.equal(result, 'TRANSIENT_RECOVERED');
  assert.equal(transientAttempts, 2, 'Should succeed on retry attempt 2');
  // 1 from daily test + 2 from transient test = 3 total calls recorded
  assert.equal(budget.getCallsToday(), 3, 'Both initial call and retry attempt must count against daily budget');

  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});

test('DAILY STATUS COMPUTE: Accurately calculates progress and determines active stage', () => {
  const testCheckpointFile = 'eval_checkpoint_test_status.json';
  const testBudgetFile = '.eval_daily_budget_status_test.json';
  if (fs.existsSync(testCheckpointFile)) fs.unlinkSync(testCheckpointFile);
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);

  const statusInitial = computeDailyStatus(testCheckpointFile, testBudgetFile, 18);
  assert.equal(statusInitial.stage, 1, 'Empty checkpoint must start on Stage 1');
  assert.equal(statusInitial.stageTotalItems, 45); // 15 tasks * 3 conditions
  assert.equal(statusInitial.stageCompletedItems, 0);
  assert.equal(statusInitial.stageRemainingItems, 45);
  assert.equal(statusInitial.allDone, false);

  if (fs.existsSync(testCheckpointFile)) fs.unlinkSync(testCheckpointFile);
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});
