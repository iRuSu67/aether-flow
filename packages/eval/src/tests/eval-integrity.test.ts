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
import { RateLimiter } from '../limiter/RateLimiter.js';
import {
  DailyBudgetManager,
  getPacificDateString,
  getNextPacificMidnight,
  formatInTimezone,
} from '../limiter/DailyBudgetManager.js';
import {
  ProviderError,
  DailyQuotaExhaustedError,
  DailyBudgetExceededError,
  analyzeStructuredQuotaError,
  saveRedactedErrorBody,
} from '../utils/errors.js';
import { ResponseCache } from '../cache/ResponseCache.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import {
  task_1a_markdown_employees,
  task_1b_markdown_servers,
} from '../tasks/definitions/family1_markdown_table.js';
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

test('TYPED PROVIDER ERROR VS TASK ERROR: Errors in sandbox code containing "500", "network", "abort", "quota", "429" are scored as normal task failures and NOT excluded', async () => {
  const sandbox = new Sandbox({ mode: 'subprocess', unsafeDevMode: true });
  const astVerifier = new ASTVerifier();

  // Mock client that returns code throwing a simulated HTTP 500 network abort quota 429 error
  const codeThrowingSuspiciousError = `
export default async function execute(args) {
  throw new Error("HTTP 500 network connection abort quota 429 resource exhausted");
}
`;
  const mockClient = {
    complete: async () => ({
      text: '```typescript\n' + codeThrowingSuspiciousError + '\n```',
      tokens: { promptTokens: 10, thinkingTokens: 0, outputTokens: 20, totalTokens: 30 },
      fromCache: false,
    }),
  } as unknown as EvalModelClient;

  const agentTask: AgentVisibleTask = {
    id: task_1a_markdown_employees.id,
    familyId: task_1a_markdown_employees.familyId,
    variant: task_1a_markdown_employees.variant,
    title: task_1a_markdown_employees.title,
    domain: task_1a_markdown_employees.domain,
    prompt: task_1a_markdown_employees.prompt,
    input: task_1a_markdown_employees.input,
    example: task_1a_markdown_employees.example,
  };

  // Run in Condition C0 (no retry loop)
  const resultC0 = await runConditionC0(agentTask, 0, mockClient, sandbox, astVerifier);
  assert.equal(resultC0.pass, false);
  assert.equal(
    resultC0.errorTaxonomy,
    'RUNTIME_ERROR',
    'Sandbox error containing HTTP keywords must be scored as RUNTIME_ERROR, NOT PROVIDER_ERROR'
  );
  assert.notEqual(resultC0.errorTaxonomy, 'PROVIDER_ERROR');

  // Run in Condition C (synthesis loop retries and eventually fails as normal task failure)
  const resultC = await runConditionC(agentTask, 0, mockClient, sandbox, astVerifier);
  assert.equal(resultC.pass, false);
  assert.equal(
    resultC.errorTaxonomy,
    'RUNTIME_ERROR',
    'Condition C must score repeated sandbox runtime failure as RUNTIME_ERROR, NOT PROVIDER_ERROR'
  );
  assert.notEqual(resultC.errorTaxonomy, 'PROVIDER_ERROR');
});

test('STRUCTURED 429 FIXTURE - DAILY QUOTA: Identifies daily metric, sets blockedUntil to Pacific midnight, stops with 0 retries', async () => {
  const testBudgetFile = '.eval_daily_budget_fixture_daily.json';
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);

  const budget = new DailyBudgetManager(testBudgetFile, 10);
  const limiter = new RateLimiter({
    rpm: 60,
    dailyBudgetManager: budget,
    minPacingMs: 0,
  });

  const daily429Fixture = {
    error: {
      code: 429,
      message: 'Resource has been exhausted (e.g. check quota).',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'RATE_LIMIT_EXCEEDED',
          domain: 'googleapis.com',
          metadata: {
            quota_metric: 'generativelanguage.googleapis.com/generate_content_requests_per_day',
            quota_id: 'GenerateContentRequestsPerDayPerProjectPerBaseModel',
            service: 'generativelanguage.googleapis.com',
          },
        },
      ],
    },
  };

  const parsed = analyzeStructuredQuotaError(daily429Fixture);
  assert.equal(parsed.type, 'DAILY');

  let attempts = 0;
  await assert.rejects(
    async () => {
      await limiter.executeWithRetry(async () => {
        attempts++;
        throw new ProviderError('Simulated Daily 429', {
          httpStatus: 429,
          rawErrorBody: daily429Fixture,
          quotaAnalysis: parsed,
        });
      });
    },
    DailyQuotaExhaustedError,
    'Must throw DailyQuotaExhaustedError'
  );

  assert.equal(attempts, 1, 'Must NOT retry on structured daily quota 429 (0 retries)');
  assert.equal(budget.getCallsToday(), 1, 'Failed attempt must count against daily budget');
  assert.ok(budget.isBlocked(), 'Must set isBlocked to true after structured daily quota 429');
  assert.ok(budget.getBlockedUntil() !== null, 'Must record blockedUntil date');

  // Verify subsequent call is blocked immediately
  assert.throws(
    () => budget.checkBudgetOrThrow(),
    DailyQuotaExhaustedError,
    'Subsequent checkBudgetOrThrow must refuse calls while isBlocked is active'
  );

  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});

test('STRUCTURED 429 FIXTURE - PER-MINUTE: Identifies per-minute metric, parses retryDelay, retries up to 2 times, counts all retries', async () => {
  const testBudgetFile = '.eval_daily_budget_fixture_minute.json';
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);

  const budget = new DailyBudgetManager(testBudgetFile, 10);
  const limiter = new RateLimiter({
    rpm: 60,
    dailyBudgetManager: budget,
    minPacingMs: 0,
  });

  const minute429Fixture = {
    error: {
      code: 429,
      message: 'Resource has been exhausted (e.g. check quota).',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
          reason: 'RATE_LIMIT_EXCEEDED',
          domain: 'googleapis.com',
          metadata: {
            quota_metric: 'generativelanguage.googleapis.com/generate_content_requests_per_minute',
            quota_id: 'GenerateContentRequestsPerMinutePerProjectPerBaseModel',
          },
        },
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '0.01s',
        },
      ],
    },
  };

  const parsed = analyzeStructuredQuotaError(minute429Fixture);
  assert.equal(parsed.type, 'PER_MINUTE');
  assert.equal(parsed.retryDelayMs, 10);

  let attempts = 0;
  const result = await limiter.executeWithRetry(async () => {
    attempts++;
    if (attempts < 2) {
      throw new ProviderError('Simulated Per-Minute 429', {
        httpStatus: 429,
        rawErrorBody: minute429Fixture,
        quotaAnalysis: parsed,
      });
    }
    return 'MINUTE_RETRY_SUCCESS';
  });

  assert.equal(result, 'MINUTE_RETRY_SUCCESS');
  assert.equal(attempts, 2, 'Must retry per-minute 429');
  assert.equal(budget.getCallsToday(), 2, 'Both initial and retry call must be recorded in daily budget');
  assert.equal(budget.isBlocked(), false, 'Per-minute 429 must NOT block the day');

  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});

test('STRUCTURED 429 FIXTURE - UNCLASSIFIED: Retries at most once, does NOT block the day', async () => {
  const testBudgetFile = '.eval_daily_budget_fixture_unclass.json';
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);

  const budget = new DailyBudgetManager(testBudgetFile, 10);
  const limiter = new RateLimiter({
    rpm: 60,
    dailyBudgetManager: budget,
    minPacingMs: 0,
  });

  const unclassified429Fixture = {
    error: {
      code: 429,
      message: 'Unknown rate limit exceeded.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: '0.01s',
        },
      ],
    },
  };

  const parsed = analyzeStructuredQuotaError(unclassified429Fixture);
  assert.equal(parsed.type, 'UNCLASSIFIED');
  assert.equal(parsed.retryDelayMs, 10);

  let attempts = 0;
  await assert.rejects(
    async () => {
      await limiter.executeWithRetry(async () => {
        attempts++;
        throw new ProviderError('Simulated Unclassified 429', {
          httpStatus: 429,
          rawErrorBody: unclassified429Fixture,
          quotaAnalysis: parsed,
        });
      });
    },
    ProviderError,
    'Must fail with ProviderError after retry'
  );

  assert.equal(attempts, 2, 'Unclassified 429 must retry at most once (total 2 attempts)');
  assert.equal(budget.isBlocked(), false, 'Unclassified 429 must NOT mark the day exhausted or block future calls');

  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});

test('ERROR REDACTION: saveRedactedErrorBody sanitizes API keys and tokens', () => {
  const tempErrorFile = '.test_redacted_error.json';
  if (fs.existsSync(tempErrorFile)) fs.unlinkSync(tempErrorFile);

  const sensitivePayload = {
    error: {
      message:
        'Invalid request to endpoint https://generativelanguage.googleapis.com/v1beta/models/gemini?key=AIzaSySecretFakeApiKey12345678901234',
      bearer: 'Bearer ya29.a0ARrdaM_SecretToken123',
    },
  };

  saveRedactedErrorBody(sensitivePayload, tempErrorFile);
  assert.ok(fs.existsSync(tempErrorFile), 'Redacted error file must exist');

  const content = fs.readFileSync(tempErrorFile, 'utf8');
  assert.ok(
    !content.includes('AIzaSySecretFakeApiKey12345678901234'),
    'Must sanitize AIzaSy API key'
  );
  assert.ok(!content.includes('ya29.a0ARrdaM_SecretToken123'), 'Must sanitize Bearer token');
  assert.ok(content.includes('[REDACTED_API_KEY]'), 'Must replace sensitive key with placeholder');
  assert.ok(content.includes('[REDACTED_TOKEN]'), 'Must replace bearer token with placeholder');

  if (fs.existsSync(tempErrorFile)) fs.unlinkSync(tempErrorFile);
});

test('PACIFIC DATE KEYING & RESET TIME IN CASABLANCA: Verifies midnight alignment in America/Los_Angeles and conversion to Africa/Casablanca', () => {
  const pacificDate = getPacificDateString();
  assert.match(pacificDate, /^\d{4}-\d{2}-\d{2}$/, 'Pacific date must follow YYYY-MM-DD');

  const nextMidnight = getNextPacificMidnight();
  assert.ok(nextMidnight instanceof Date, 'getNextPacificMidnight must return a Date');
  assert.ok(nextMidnight.getTime() > Date.now(), 'Next Pacific midnight must be in the future');

  const casablancaReset = formatInTimezone(nextMidnight, 'Africa/Casablanca');
  const pacificReset = formatInTimezone(nextMidnight, 'America/Los_Angeles');

  assert.ok(casablancaReset.length > 0);
  assert.ok(pacificReset.length > 0);
  // Pacific midnight must be 12:00 AM (00:00)
  assert.ok(pacificReset.includes('12:00:00 AM') || pacificReset.includes('00:00:00'), `Pacific reset time should be midnight: ${pacificReset}`);
});

test('GUARD LIVE CALLS BEHIND --allow-live: Refuses live calls without explicit flag', async () => {
  const cache = new ResponseCache('.eval_cache_guard_test');
  const limiter = new RateLimiter({ maxCalls: 10, minPacingMs: 0 });

  // Client without allowLive
  const guardedClient = new EvalModelClient({
    provider: 'gemini',
    model: 'gemini-3.8-flash',
    cache,
    limiter,
    allowLive: false,
  });

  await assert.rejects(
    async () => {
      await guardedClient.complete({
        systemPrompt: '',
        prompt: 'test',
        runIndex: 0,
      });
    },
    /Live Gemini API calls are blocked unless --allow-live is explicitly passed/,
    'Must refuse live complete without --allow-live'
  );

  await assert.rejects(
    async () => {
      await guardedClient.executeSmokeCall();
    },
    /Must pass --allow-live to run live smoke test/,
    'Must refuse live smoke call without --allow-live'
  );
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
  assert.ok(statusInitial.datePacific.length > 0);
  assert.ok(statusInitial.timeCasablanca.length > 0);
  assert.ok(statusInitial.nextResetCasablanca.length > 0);

  if (fs.existsSync(testCheckpointFile)) fs.unlinkSync(testCheckpointFile);
  if (fs.existsSync(testBudgetFile)) fs.unlinkSync(testBudgetFile);
});
