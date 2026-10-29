import { ASTVerifier, Sandbox } from '@aether-flow/core';
import { AgentVisibleTask, TaskRunResult } from '../types.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { isHarnessStopError, isProviderError } from '../utils/errors.js';

function extractCodeFromResponse(text: string): string {
  const codeBlockMatch = text.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim();
  }
  return text.trim();
}

export async function runConditionC0(
  task: AgentVisibleTask,
  runIndex: number,
  client: EvalModelClient,
  sandbox: Sandbox,
  astVerifier: ASTVerifier
): Promise<TaskRunResult> {
  const startTime = performance.now();
  const systemPrompt = `DYNAMIC_SYNTHESIS_CONDITION_C0: You are an expert TypeScript/JavaScript programmer.
Synthesize a single-file, production-ready ES module that exports default async function execute(args).
The function takes 'args' matching the task input and returns the final calculated result.
Do NOT use external network or filesystem. Implement all algorithms directly in pure JavaScript.
Wrap your code in \`\`\`javascript ... \`\`\`.`;

  const userPrompt = `${task.prompt}\n\nTask Input Schema & Values:\n${JSON.stringify(task.input, null, 2)}\n\nSynthesize the executable tool code:`;

  try {
    const response = await client.complete({
      systemPrompt,
      prompt: userPrompt,
      runIndex,
    });

    const code = extractCodeFromResponse(response.text);

    // 1. Static AST Verification
    const astReport = astVerifier.verify(code);
    if (!astReport.isSafe) {
      const latencyMs = performance.now() - startTime;
      return {
        taskId: task.id,
        familyId: task.familyId,
        condition: 'C0',
        runIndex,
        pass: false,
        retries: 0,
        errorTaxonomy: 'POLICY_BLOCKED',
        errorDetails: `AST Verifier blocked code: ${astReport.bannedPatternsDetected.join(', ')}`,
        latencyMs,
        tokens: response.tokens,
        reused: false,
        astBlocked: true,
        rawOutput: code,
      };
    }

    // 2. Execute in Docker Sandbox (NO retries)
    const execRes = await sandbox.execute(code, task.input as Record<string, unknown>);
    const latencyMs = performance.now() - startTime;

    if (!execRes.success) {
      const isTimeout = execRes.error?.includes('timed out');
      return {
        taskId: task.id,
        familyId: task.familyId,
        condition: 'C0',
        runIndex,
        pass: false,
        retries: 0,
        errorTaxonomy: isTimeout ? 'TIMEOUT' : 'RUNTIME_ERROR',
        errorDetails: execRes.error,
        latencyMs,
        tokens: response.tokens,
        reused: false,
        astBlocked: false,
        rawOutput: execRes.error,
      };
    }

    // 3. Execution succeeded cleanly: output returned to harness for external scoring
    return {
      taskId: task.id,
      familyId: task.familyId,
      condition: 'C0',
      runIndex,
      pass: false, // External harness scores with task.checker post-hoc
      retries: 0,
      errorTaxonomy: 'SUCCESS',
      latencyMs,
      tokens: response.tokens,
      reused: false,
      astBlocked: false,
      rawOutput: execRes.result,
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
      condition: 'C0',
      runIndex,
      pass: false,
      retries: 0,
      errorTaxonomy: isProv ? 'PROVIDER_ERROR' : 'RUNTIME_ERROR',
      errorDetails: err instanceof Error ? err.message : String(err),
      latencyMs,
      tokens: { promptTokens: 0, thinkingTokens: 0, outputTokens: 0, totalTokens: 0 },
      reused: false,
      astBlocked: false,
    };
  }
}
