import { Sandbox, ASTVerifier } from '@aether-flow/core';
import {
  BenchmarkTask,
  AgentVisibleTask,
  EvalOptions,
  EvalSummary,
  TaskRunResult,
  ConditionId,
  CallEstimates,
  TaskFamilyId,
  ErrorTaxonomy,
  ConditionStatistics,
  ConditionDReuseStatistics,
} from '../types.js';
import { ALL_TASKS } from '../tasks/registry.js';
import { ResponseCache } from '../cache/ResponseCache.js';
import { RateLimiter } from '../limiter/RateLimiter.js';
import { CheckpointManager } from '../checkpoints/CheckpointManager.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { runConditionA } from '../conditions/ConditionA.js';
import { runConditionB } from '../conditions/ConditionB.js';
import { runConditionC0 } from '../conditions/ConditionC0.js';
import { runConditionC } from '../conditions/ConditionC.js';
import { runConditionD, ToolLibrary } from '../conditions/ConditionD.js';
import { estimateApiCalls } from './estimator.js';
import { loadEnv } from '../utils/env.js';
import { isHarnessStopError, DailyBudgetExceededError, DailyQuotaExhaustedError } from '../utils/errors.js';

export function computeWilsonScoreCI(successes: number, total: number, z = 1.96): [number, number] {
  if (total === 0) return [0, 0];
  const p = successes / total;
  const denominator = 1 + (z * z) / total;
  const center = p + (z * z) / (2 * total);
  const spread = z * Math.sqrt((p * (1 - p)) / total + (z * z) / (4 * total * total));
  const lower = Math.max(0, (center - spread) / denominator);
  const upper = Math.min(1, (center + spread) / denominator);
  return [Number((lower * 100).toFixed(1)), Number((upper * 100).toFixed(1))];
}

export class EvalHarness {
  public options: EvalOptions;
  private cache: ResponseCache;
  private limiter: RateLimiter;
  private checkpoint: CheckpointManager;
  private client: EvalModelClient;
  private sandbox!: Sandbox;
  private astVerifier: ASTVerifier;
  private library: ToolLibrary;

  constructor(options: Partial<EvalOptions> = {}) {
    loadEnv();
    const isMock = (options.provider ?? 'mock') === 'mock';
    const defaultCacheDir = isMock ? '.eval_cache_mock' : '.eval_cache';

    let conditions: ConditionId[] | undefined = options.conditions;
    if (!conditions && options.stage) {
      if (options.stage === 1) conditions = ['A', 'C0', 'C'];
      else if (options.stage === 2) conditions = ['B', 'D'];
    }

    this.options = {
      provider: options.provider ?? 'mock',
      model: options.model ?? 'gemini-3.8-flash',
      rpm: options.rpm ?? 5,
      tpm: options.tpm ?? 250000,
      rpd: options.rpd ?? 20,
      dailyBudget: options.dailyBudget ?? 18,
      maxCalls: options.maxCalls ?? 50,
      runs: options.runs ?? 1,
      thinkingLevel: options.thinkingLevel ?? 'medium',
      limitTasks: options.limitTasks,
      taskIds: options.taskIds,
      conditions,
      stage: options.stage,
      resume: options.resume ?? false,
      checkpointFile: options.checkpointFile ?? 'eval_checkpoint.json',
      cacheDir: options.cacheDir ?? defaultCacheDir,
      openaiBaseUrl: options.openaiBaseUrl,
    };

    this.cache = new ResponseCache(this.options.cacheDir);
    this.limiter = new RateLimiter({
      rpm: this.options.rpm,
      tpm: this.options.tpm,
      rpd: this.options.rpd,
      dailyBudget: this.options.dailyBudget,
      maxCalls: this.options.maxCalls,
      minPacingMs: 13000,
    });
    this.checkpoint = new CheckpointManager(this.options.checkpointFile);
    this.client = new EvalModelClient({
      provider: this.options.provider,
      model: this.options.model,
      thinkingLevel: this.options.thinkingLevel,
      cache: this.cache,
      limiter: this.limiter,
      openaiBaseUrl: this.options.openaiBaseUrl,
    });
    this.astVerifier = new ASTVerifier();
    this.library = new ToolLibrary();
  }

  public validateSecurityPrerequisites(): void {
    if (!Sandbox.isDockerAvailable()) {
      throw new Error(
        'SECURITY ENFORCEMENT: Docker is required for dynamic tool evaluation (Conditions C0, C, D). Docker engine is not available on this host. Execution refused.'
      );
    }
    this.sandbox = new Sandbox({
      mode: 'docker',
      unsafeDevMode: false,
      timeoutMs: 8000,
      maxMemoryMb: 64,
      maxOutputBytes: 128 * 1024,
    });
  }

  public getSelectedTasks(): BenchmarkTask[] {
    let tasks = [...ALL_TASKS];
    if (this.options.taskIds && this.options.taskIds.length > 0) {
      tasks = tasks.filter((t) => this.options.taskIds!.includes(t.id));
    }
    if (this.options.limitTasks && this.options.limitTasks > 0) {
      tasks = tasks.slice(0, this.options.limitTasks);
    }
    return tasks;
  }

  public getEffectiveConditions(): ConditionId[] {
    if (this.options.conditions && this.options.conditions.length > 0) {
      return this.options.conditions;
    }
    if (this.options.stage === 1) return ['A', 'C0', 'C'];
    if (this.options.stage === 2) return ['B', 'D'];
    return ['A', 'B', 'C0', 'C', 'D'];
  }

  public estimateCalls(tasks: BenchmarkTask[]): CallEstimates {
    return estimateApiCalls(tasks.length, this.options.runs, this.getEffectiveConditions());
  }

  public async run(): Promise<{ summary: EvalSummary; results: TaskRunResult[] }> {
    this.validateSecurityPrerequisites();
    const tasks = this.getSelectedTasks();
    const results: TaskRunResult[] = [];
    const conditions = this.getEffectiveConditions();
    const isMock = this.options.provider === 'mock';

    if (isMock) {
      console.log('================================================================');
      console.log('           SCRIPTED MOCK RESULTS - NOT EVIDENCE                 ');
      console.log('================================================================');
    }

    console.log('================================================================');
    console.log('            AETHERFLOW EVALUATION BENCHMARK HARNESS             ');
    console.log(`  Provider: ${this.options.provider.toUpperCase()} | Model: ${this.options.model}`);
    console.log(`  Thinking Level: ${this.options.thinkingLevel.toUpperCase()}`);
    console.log(`  Tasks: ${tasks.length} | Conditions: ${conditions.join(', ')} | Runs: ${this.options.runs}`);
    console.log(
      `  Rate Limits: ${this.options.rpm} RPM | ${this.options.rpd} RPD | Daily Budget: ${this.limiter.dailyBudget.getMaxBudget()} calls/day`
    );
    console.log(
      `  Daily Calls Used Today: ${this.limiter.dailyBudget.getCallsToday()}/${this.limiter.dailyBudget.getMaxBudget()} (Remaining: ${this.limiter.dailyBudget.getRemainingCalls()})`
    );

    const estimates = this.estimateCalls(tasks);
    console.log(
      `  Estimated API Calls for this stage: Min: ${estimates.minCalls} | Typical: ${estimates.typicalCalls} | Max: ${estimates.maxCalls}`
    );
    console.log('================================================================\n');

    let stoppedEarly = false;
    let stopReason: string | undefined;

    executionLoop: for (let r = 0; r < this.options.runs; r++) {
      console.log(`\n▶ [RUN REPETITION ${r + 1}/${this.options.runs}] (Resetting Condition D Tool Library)`);
      this.library.reset();

      for (let tIdx = 0; tIdx < tasks.length; tIdx++) {
        const task = tasks[tIdx];
        console.log(`  [Task ${tIdx + 1}/${tasks.length}] ${task.id} (${task.title})`);

        // Strip hidden checker and solution: only pass agent-visible information to conditions
        const agentTask: AgentVisibleTask = {
          id: task.id,
          familyId: task.familyId,
          variant: task.variant,
          title: task.title,
          domain: task.domain,
          prompt: task.prompt,
          input: task.input,
          example: task.example,
        };

        for (const cond of conditions) {
          if (this.options.resume && this.checkpoint.isCompleted(task.id, cond, r)) {
            console.log(`    ↳ Condition ${cond}: Cached in checkpoint, skipping`);
            continue;
          }

          let runRes: TaskRunResult;

          try {
            switch (cond) {
              case 'A':
                runRes = await runConditionA(agentTask, r, this.client);
                break;
              case 'B':
                runRes = await runConditionB(agentTask, r, this.client);
                break;
              case 'C0':
                runRes = await runConditionC0(agentTask, r, this.client, this.sandbox, this.astVerifier);
                break;
              case 'C':
                runRes = await runConditionC(agentTask, r, this.client, this.sandbox, this.astVerifier);
                break;
              case 'D':
                runRes = await runConditionD(agentTask, r, this.client, this.sandbox, this.astVerifier, this.library);
                break;
            }
          } catch (err: unknown) {
            if (isHarnessStopError(err)) {
              stoppedEarly = true;
              stopReason = err instanceof Error ? err.message : String(err);
              console.warn(`\n[HALT CONDITION REACHED] ${stopReason}`);
              break executionLoop;
            }
            throw err;
          }

          // Authoritative external grading:
          // Provider errors (429/503/network) are NOT task failures and must not run through checker
          if (runRes.errorTaxonomy === 'PROVIDER_ERROR') {
            runRes.pass = false;
          } else {
            const check = task.checker(runRes.rawOutput, task.input);
            runRes.pass = check.pass;
            if (!check.pass) {
              runRes.errorDetails = check.reason;
              if (runRes.errorTaxonomy === 'SUCCESS') {
                runRes.errorTaxonomy = 'WRONG_OUTPUT';
              }
            }
          }

          // Track Condition D reuse accuracy
          if (cond === 'D' && runRes.reused) {
            runRes.reuseAccurate = runRes.pass;
          }

          runRes.variant = task.variant;
          results.push(runRes);
          this.checkpoint.record(runRes);

          const statusIcon =
            runRes.errorTaxonomy === 'PROVIDER_ERROR'
              ? '⚠️ PROVIDER_ERROR'
              : runRes.pass
                ? '✔ PASS'
                : '❌ FAIL';
          const reuseStr = runRes.reused
            ? runRes.reuseAccurate
              ? ' [REUSE HIT (ACCURATE)]'
              : ' [REUSE HIT (INACCURATE)]'
            : '';
          const retryStr = runRes.retries > 0 ? ` (retries: ${runRes.retries})` : '';
          console.log(
            `    ↳ Condition ${cond.padEnd(2)}: ${statusIcon}${reuseStr}${retryStr} | ${runRes.latencyMs.toFixed(0)}ms | Tax: ${runRes.errorTaxonomy} | Tokens: ${runRes.tokens.totalTokens}`
          );
        }
      }
    }

    const summary = this.computeSummary(results, tasks.length, stoppedEarly, stopReason);

    if (isMock) {
      console.log('\n================================================================');
      console.log('           SCRIPTED MOCK RESULTS - NOT EVIDENCE                 ');
      console.log('================================================================\n');
    }

    if (stoppedEarly) {
      console.log('\n================================================================');
      console.log('       RUN INCOMPLETE: DAILY BUDGET OR QUOTA LIMIT HIT         ');
      console.log(`Reason: ${stopReason}`);
      console.log('State saved to checkpoint. Run "npm run eval:daily" tomorrow to resume.');
      console.log('================================================================\n');
    }

    return { summary, results };
  }

  public computeSummary(
    results: TaskRunResult[],
    totalTasks: number,
    stoppedEarly = false,
    incompleteReason?: string
  ): EvalSummary {
    const conditions = this.getEffectiveConditions();
    const conditionStats = {} as Record<ConditionId, ConditionStatistics>;

    for (const cond of conditions) {
      const condResults = results.filter((r) => r.condition === cond);
      const total = condResults.length;
      const providerErrors = condResults.filter((r) => r.errorTaxonomy === 'PROVIDER_ERROR').length;
      const validRuns = total - providerErrors;
      const passed = condResults.filter((r) => r.pass).length;
      const cPassRate = validRuns > 0 ? Number(((passed / validRuns) * 100).toFixed(1)) : 0;
      const cWilson = computeWilsonScoreCI(passed, validRuns);

      const avgLatencyMs =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.latencyMs, 0) / total).toFixed(0)) : 0;
      const avgTotalTokens =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.tokens.totalTokens, 0) / total).toFixed(0)) : 0;
      const avgPromptTokens =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.tokens.promptTokens, 0) / total).toFixed(0)) : 0;
      const avgThinkingTokens =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.tokens.thinkingTokens, 0) / total).toFixed(0)) : 0;
      const avgOutputTokens =
        total > 0 ? Number((condResults.reduce((acc, r) => acc + r.tokens.outputTokens, 0) / total).toFixed(0)) : 0;

      const errorCounts: Record<ErrorTaxonomy, number> = {
        SYNTAX_ERROR: 0,
        POLICY_BLOCKED: 0,
        RUNTIME_ERROR: 0,
        TIMEOUT: 0,
        WRONG_OUTPUT: 0,
        PROVIDER_ERROR: 0,
        SUCCESS: 0,
      };

      let astFalseRejections = 0;
      for (const r of condResults) {
        errorCounts[r.errorTaxonomy] = (errorCounts[r.errorTaxonomy] || 0) + 1;
        if (r.astBlocked) astFalseRejections++;
      }

      conditionStats[cond] = {
        total,
        passed,
        validRuns,
        providerErrors,
        passRate: cPassRate,
        wilsonCI: cWilson,
        avgLatencyMs,
        avgTotalTokens,
        avgPromptTokens,
        avgThinkingTokens,
        avgOutputTokens,
        errorCounts,
        astFalseRejections,
      };
    }

    // Condition D reuse statistics (Eligible tasks: variants 'b' and 'c')
    const dResults = results.filter((r) => r.condition === 'D');
    const families: TaskFamilyId[] = [
      'family1_markdown_table',
      'family2_levenshtein_alignment',
      'family3_dijkstra_turns',
      'family4_csv_pivot',
      'family5_knapsack_dual',
    ];

    const familyBreakdown = {} as ConditionDReuseStatistics['familyBreakdown'];
    let totalEligible = 0;
    let totalAttempts = 0;
    let totalAccurate = 0;

    for (const fam of families) {
      const famEligible = dResults.filter((r) => r.familyId === fam && (r.variant === 'b' || r.variant === 'c'));
      const eligible = famEligible.length;
      const hits = famEligible.filter((r) => r.reused).length;
      const accurate = famEligible.filter((r) => r.reused && r.reuseAccurate).length;

      const hitRate = eligible > 0 ? Number(((hits / eligible) * 100).toFixed(1)) : 0;
      const precision = hits > 0 ? Number(((accurate / hits) * 100).toFixed(1)) : 0;

      familyBreakdown[fam] = { eligible, hits, hitRate, accurate, precision };
      totalEligible += eligible;
      totalAttempts += hits;
      totalAccurate += accurate;
    }

    const reuseHitRate = totalEligible > 0 ? Number(((totalAttempts / totalEligible) * 100).toFixed(1)) : 0;
    const reusePrecision = totalAttempts > 0 ? Number(((totalAccurate / totalAttempts) * 100).toFixed(1)) : 0;

    const hasProviderErrors = results.some((r) => r.errorTaxonomy === 'PROVIDER_ERROR');
    const status = stoppedEarly || hasProviderErrors ? 'INCOMPLETE' : 'COMPLETED';

    return {
      methodology: {
        provider: this.options.provider,
        model: this.options.model,
        thinkingLevel: this.options.thinkingLevel,
        runsPerTask: this.options.runs,
        totalTasks,
        evaluationDate: new Date().toISOString().split('T')[0],
        stage: this.options.stage,
      },
      status,
      incompleteReason: incompleteReason ?? (hasProviderErrors ? 'Provider errors occurred during execution' : undefined),
      dailyBudget: {
        callsToday: this.limiter.dailyBudget.getCallsToday(),
        maxDailyBudget: this.limiter.dailyBudget.getMaxBudget(),
        remaining: this.limiter.dailyBudget.getRemainingCalls(),
        date: new Date().toISOString().split('T')[0],
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      },
      conditionStats,
      conditionDReuse: {
        eligibleVariants: totalEligible,
        attemptedReuses: totalAttempts,
        accurateReuses: totalAccurate,
        reuseHitRate,
        reusePrecision,
        familyBreakdown,
      },
      apiCallsMade: this.limiter.apiCallsMade,
      cacheHits: this.cache.hits,
    };
  }
}
