import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EvalHarness } from './harness/EvalHarness.js';
import { EvalModelClient } from './providers/EvalModelClient.js';
import { ResponseCache } from './cache/ResponseCache.js';
import { RateLimiter } from './limiter/RateLimiter.js';
import { EvalOptions } from './types.js';
import { loadEnv } from './utils/env.js';
import { runDailyEval } from './harness/dailyRunner.js';
import { DEFAULT_EVAL_MODEL, getModelProfile, MODEL_PROFILES } from './config/models.js';

export { EvalHarness } from './harness/EvalHarness.js';
export { ToolLibrary } from './conditions/ToolLibrary.js';
export {
  estimateApiCalls,
  estimateStagedEvaluation,
  estimateMainRun,
  estimateSpotCheck38,
  estimateGemmaRun,
} from './harness/estimator.js';
export { runDailyEval, computeDailyStatus } from './harness/dailyRunner.js';
export { DEFAULT_EVAL_MODEL, getModelProfile, MODEL_PROFILES } from './config/models.js';
export * from './types.js';

async function main() {
  loadEnv();

  const args = process.argv.slice(2);
  const options: Partial<EvalOptions> = {};
  let isDaily = false;
  let isSmoke = false;

  for (const arg of args) {
    if (arg.startsWith('--provider=')) {
      options.provider = arg.split('=')[1].toLowerCase() as any;
    } else if (arg.startsWith('--model=')) {
      options.model = arg.split('=')[1];
    } else if (arg.startsWith('--rpm=')) {
      options.rpm = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--max-calls=')) {
      options.maxCalls = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--runs=')) {
      options.runs = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--daily-budget=')) {
      options.dailyBudget = Number(arg.split('=')[1]);
    } else if (arg.startsWith('--stage=')) {
      options.stage = Number(arg.split('=')[1]) as any;
    } else if (arg.startsWith('--openai-base-url=')) {
      options.openaiBaseUrl = arg.split('=')[1];
    } else if (arg.startsWith('--thinking-level=')) {
      options.thinkingLevel = arg.split('=')[1].toLowerCase() as any;
    } else if (arg === '--dry-run') {
      options.provider = 'mock';
      options.runs = 1;
    } else if (arg === '--daily') {
      isDaily = true;
    } else if (arg === '--smoke') {
      isSmoke = true;
    } else if (arg === '--allow-live') {
      options.allowLive = true;
    } else if (arg === '--small-run') {
      // 3 tasks from family 1 (variants a, b, c) to demonstrate tool reuse in Condition D
      options.taskIds = [
        'task_1a_markdown_employees',
        'task_1b_markdown_servers',
        'task_1c_markdown_transactions',
      ];
      options.runs = 1;
    } else if (arg.startsWith('--checkpoint-file=')) {
      options.checkpointFile = arg.split('=')[1];
    } else if (arg === '--resume') {
      options.resume = true;
    }
  }

  if (isSmoke) {
    const model = options.model ?? DEFAULT_EVAL_MODEL;
    const profile = getModelProfile(model);
    const cache = new ResponseCache(options.cacheDir ?? '.eval_cache');
    const limiter = new RateLimiter({
      model,
      rpm: options.rpm ?? profile.rpm,
      tpm: options.tpm ?? profile.tpm,
      rpd: options.rpd ?? profile.rpd,
      dailyBudget: options.dailyBudget ?? profile.defaultDailyBudget,
      maxCalls: 1,
      minPacingMs: profile.minPacingMs,
    });
    const client = new EvalModelClient({
      provider: options.provider ?? 'gemini',
      model,
      thinkingLevel: options.thinkingLevel ?? profile.defaultThinkingLevel,
      allowLive: options.allowLive ?? false,
      cache,
      limiter,
    });
    console.log('================================================================');
    console.log('                 EVAL SMOKE TEST (1 LIVE CALL)                  ');
    console.log('================================================================');
    console.log(`Model:          ${model} (${profile.description})`);
    console.log(`Thinking Level: ${options.thinkingLevel ?? profile.defaultThinkingLevel}`);
    console.log(`Allow Live:     ${options.allowLive ? 'YES' : 'NO'}`);
    console.log('Executing single smoke call ("Respond with OK")...\n');
    const result = await client.executeSmokeCall();
    console.log('----------------------------------------------------------------');
    console.log('REDACTED REQUEST BODY (Sent to Google Gemini API):');
    console.log(JSON.stringify(result.requestBody, null, 2));
    console.log('----------------------------------------------------------------');
    console.log(`HTTP Status:    ${result.httpStatus} ${result.statusText}`);
    console.log(`Model:          ${result.model}`);
    console.log(`Thinking Level: ${result.thinkingLevel}`);
    console.log('RAW usageMetadata:');
    console.log(JSON.stringify(result.rawUsageMetadata, null, 2));
    console.log('PARSED TOKEN USAGE:');
    console.log(`  Prompt Tokens:   ${result.tokenUsage.promptTokens}`);
    console.log(`  Thinking Tokens: ${result.tokenUsage.thinkingTokens}`);
    console.log(`  Output Tokens:   ${result.tokenUsage.outputTokens} (from candidatesTokenCount)`);
    console.log(`  Total Tokens:    ${result.tokenUsage.totalTokens}`);
    const tokenSum =
      result.tokenUsage.promptTokens +
      result.tokenUsage.outputTokens +
      result.tokenUsage.thinkingTokens;
    console.log(
      `  Token Math:      ${result.tokenUsage.promptTokens} (prompt) + ${result.tokenUsage.outputTokens} (output) + ${result.tokenUsage.thinkingTokens} (thinking) = ${tokenSum} (API totalTokenCount: ${result.tokenUsage.totalTokens})`
    );
    console.log(`Finish Reason:  ${result.responseShape.finishReason ?? 'STOP'}`);
    console.log(`Response Text:  ${JSON.stringify(result.responseShape.preview)}`);
    console.log('----------------------------------------------------------------');
    console.log('✔ Smoke test verified valid response shape and model connectivity.');
    console.log('================================================================\n');
    return;
  }

  if (isDaily) {
    await runDailyEval(options);
    return;
  }

  const harness = new EvalHarness(options);
  const { summary } = await harness.run();

  const conds = harness.getEffectiveConditions();
  console.log('\n================================================================');
  console.log('             EVALUATION REPORT (PER-CONDITION RESULTS)          ');
  console.log('================================================================');
  console.log(`Status: ${summary.status}${summary.incompleteReason ? ` (${summary.incompleteReason})` : ''}`);
  console.log(`Methodology (STRICTLY ISOLATED TO THIS MODEL):`);
  console.log(`  Model: ${summary.methodology.model} | Thinking Setting: ${summary.methodology.thinkingLevel}`);
  console.log(`  Evaluation Date (Pacific): ${summary.methodology.evaluationDate} | Runs Per Task (N): ${summary.methodology.runsPerTask}`);
  console.log(`  Tasks Evaluated: ${summary.methodology.totalTasks} | Conditions: ${conds.join(', ')}`);
  console.log(`  API Calls Made: ${summary.apiCallsMade} | Persistent Cache Hits: ${summary.cacheHits}`);
  console.log(`  NOTE: Results from different models must NEVER be merged or pooled.`);
  if (summary.dailyBudget) {
    console.log(
      `  Daily Budget: ${summary.dailyBudget.callsToday}/${summary.dailyBudget.maxDailyBudget} calls used (${summary.dailyBudget.remaining} remaining today)`
    );
  }

  console.log('\n----------------------------------------------------------------');
  console.log('CONDITION PERFORMANCE (STRICTLY UNPOOLED):');
  console.log('----------------------------------------------------------------');
  for (const c of conds) {
    const s = summary.conditionStats[c];
    if (!s || s.total === 0) continue;
    console.log(
      `Condition ${c.padEnd(2)}: ${s.passed}/${s.validRuns} passed (${s.passRate.toFixed(1)}%) | 95% Wilson CI: [${s.wilsonCI[0]}%, ${s.wilsonCI[1]}%]${s.providerErrors > 0 ? ` (⚠️ ${s.providerErrors} Provider Errors Excluded)` : ''}`
    );
    console.log(
      `   Latency: ${s.avgLatencyMs}ms | Tokens: ${s.avgTotalTokens} (Prompt: ${s.avgPromptTokens}, Thinking: ${s.avgThinkingTokens}, Output: ${s.avgOutputTokens})`
    );
    console.log(
      `   AST False Rejections: ${s.astFalseRejections}`
    );
    console.log(
      `   Error Taxonomy: Success: ${s.errorCounts.SUCCESS}, Syntax: ${s.errorCounts.SYNTAX_ERROR}, Blocked: ${s.errorCounts.POLICY_BLOCKED}, Runtime: ${s.errorCounts.RUNTIME_ERROR}, Timeout: ${s.errorCounts.TIMEOUT}, Wrong Output: ${s.errorCounts.WRONG_OUTPUT}, Provider Error: ${s.errorCounts.PROVIDER_ERROR}\n`
    );
  }

  if (conds.includes('D')) {
    console.log('----------------------------------------------------------------');
    console.log('CONDITION D DYNAMIC TOOL REUSE METRICS:');
    console.log('----------------------------------------------------------------');
    const dReuse = summary.conditionDReuse;
    console.log(`  Eligible Variants (b & c): ${dReuse.eligibleVariants}`);
    console.log(`  Attempted Tool Reuses:     ${dReuse.attemptedReuses} (${dReuse.reuseHitRate.toFixed(1)}% Reuse Hit Rate)`);
    console.log(`  Accurate Tool Reuses:      ${dReuse.accurateReuses} (${dReuse.reusePrecision.toFixed(1)}% Reuse Precision verified post-hoc)\n`);

    console.log('  Per-Family Reuse Breakdown:');
    for (const [fam, stats] of Object.entries(dReuse.familyBreakdown)) {
      console.log(
        `    ${fam.padEnd(30)}: ${stats.hits}/${stats.eligible} hits (${stats.hitRate.toFixed(1)}%) | ${stats.accurate}/${stats.hits || 1} accurate (${stats.precision.toFixed(1)}% precision)`
      );
    }
  }
  console.log('================================================================\n');
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((err) => {
    console.error('\nEvaluation Harness Fatal Error:', err.message);
    process.exit(1);
  });
}
