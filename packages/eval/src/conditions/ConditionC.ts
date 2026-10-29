import { ASTVerifier, Sandbox } from '@aether-flow/core';
import { AgentVisibleTask, TaskRunResult, TokenUsage, ErrorTaxonomy } from '../types.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { isHarnessStopError, isProviderError } from '../utils/errors.js';

function extractCodeFromResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}

export async function runConditionC(
  task: AgentVisibleTask,
  runIndex: number,
  client: EvalModelClient,
  sandbox: Sandbox,
  astVerifier: ASTVerifier,
  maxRetries = 3
): Promise<TaskRunResult & { finalCode?: string }> {
  const startTime = performance.now();
  const systemPrompt = `DYNAMIC_SYNTHESIS_CONDITION_C: You are an expert TypeScript/JavaScript programmer.
Synthesize a single-file, production-ready ES module that exports default async function execute(args).
The function takes 'args' matching the task input and returns the final calculated result.
Do NOT use external network or filesystem. Implement all algorithms directly in pure JavaScript.
Wrap your code in \`\`\`javascript ... \`\`\`.`;

  let userPrompt = `${task.prompt}\n\nTask Input Schema & Values:\n${JSON.stringify(task.input, null, 2)}\n\nSynthesize the executable tool code:`;

  const cumulativeTokens: TokenUsage = {
    promptTokens: 0,
    thinkingTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  let attempts = 0;
  let lastTaxonomy: ErrorTaxonomy = 'WRONG_OUTPUT';
  let lastError = '';
  let astBlocked = false;

  try {
    while (attempts <= maxRetries) {
      const response = await client.complete({
        systemPrompt,
        prompt: userPrompt,
        runIndex,
      });

      cumulativeTokens.promptTokens += response.tokens.promptTokens;
      cumulativeTokens.thinkingTokens += response.tokens.thinkingTokens;
      cumulativeTokens.outputTokens += response.tokens.outputTokens;
      cumulativeTokens.totalTokens += response.tokens.totalTokens;

      const code = extractCodeFromResponse(response.text);

      // 1. Static AST Verification
      const astReport = astVerifier.verify(code);
      if (!astReport.isSafe) {
        astBlocked = true;
        lastTaxonomy = 'POLICY_BLOCKED';
        lastError = `AST Verifier blocked code: ${astReport.bannedPatternsDetected.join(', ')}`;

        if (attempts === maxRetries) break;
        attempts++;
        userPrompt += `\n\nPrevious code attempt was rejected by AST security linter with error:\n${lastError}\nPlease fix the implementation and output valid compliant JavaScript code:`;
        continue;
      }

      // 2. Docker Sandbox Execution
      const execRes = await sandbox.execute(code, task.input as Record<string, unknown>);

      if (!execRes.success) {
        lastTaxonomy = execRes.error?.includes('timed out') ? 'TIMEOUT' : 'RUNTIME_ERROR';
        lastError = execRes.error || 'Execution failed';

        if (attempts === maxRetries) break;
        attempts++;
        userPrompt += `\n\nPrevious code execution in sandbox failed with error:\n${lastError}\nPlease fix the logic and output updated JavaScript code:`;
        continue;
      }

      // 3. Clean Execution: Successfully synthesized and executed without runtime errors
      // Terminate synthesis loop cleanly. The external harness evaluates correctness post-hoc.
      const latencyMs = performance.now() - startTime;
      return {
        taskId: task.id,
        familyId: task.familyId,
        condition: 'C',
        runIndex,
        pass: false, // External harness scores with task.checker post-hoc
        retries: attempts,
        errorTaxonomy: 'SUCCESS',
        latencyMs,
        tokens: cumulativeTokens,
        reused: false,
        astBlocked,
        rawOutput: execRes.result,
        finalCode: code,
      };
    }

    // Exceeded max retry attempts without clean execution
    const latencyMs = performance.now() - startTime;
    return {
      taskId: task.id,
      familyId: task.familyId,
      condition: 'C',
      runIndex,
      pass: false,
      retries: attempts,
      errorTaxonomy: lastTaxonomy,
      errorDetails: lastError,
      latencyMs,
      tokens: cumulativeTokens,
      reused: false,
      astBlocked,
    };
  } catch (err: unknown) {
    if (isHarnessStopError(err)) {
      throw err;
    }
    const latencyMs = performance.now() - startTime;
    const isProv = isProviderError(err);
    return {
      taskId: task.id,
      familyId: task.familyId,
      variant: task.variant,
      condition: 'C',
      runIndex,
      pass: false,
      retries: attempts,
      errorTaxonomy: isProv ? 'PROVIDER_ERROR' : 'RUNTIME_ERROR',
      errorDetails: err instanceof Error ? err.message : String(err),
      latencyMs,
      tokens: cumulativeTokens,
      reused: false,
      astBlocked,
    };
  }
}
