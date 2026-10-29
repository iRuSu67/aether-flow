import { ASTVerifier, Sandbox } from '@aether-flow/core';
import { AgentVisibleTask, TaskRunResult } from '../types.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { runConditionC } from './ConditionC.js';
import { ToolLibrary } from './ToolLibrary.js';
import { deepEquals } from '../utils/deep-equals.js';
import { isHarnessStopError, isProviderError } from '../utils/errors.js';

export { ToolLibrary } from './ToolLibrary.js';

export async function runConditionD(
  task: AgentVisibleTask,
  runIndex: number,
  client: EvalModelClient,
  sandbox: Sandbox,
  astVerifier: ASTVerifier,
  library: ToolLibrary
): Promise<TaskRunResult> {
  const startTime = performance.now();

  try {
    // 1. Semantic description-based tool retrieval (NO familyId, NO oracle)
    const candidate = library.findSimilar(task.prompt, 0.25);

    if (candidate) {
      // 2. Validate candidate tool against agent-visible task example in Docker Sandbox
      const exampleCheck = await sandbox.execute(candidate.code, task.example.input);

      if (exampleCheck.success && deepEquals(exampleCheck.result, task.example.output)) {
        // Candidate tool verified successfully against public example! Execute on real task input
        const execRes = await sandbox.execute(candidate.code, task.input as Record<string, unknown>);
        if (execRes.success) {
          const latencyMs = performance.now() - startTime;
          return {
            taskId: task.id,
            familyId: task.familyId,
            variant: task.variant,
            condition: 'D',
            runIndex,
            pass: false, // External harness scores with task.checker post-hoc
            retries: 0,
            errorTaxonomy: 'SUCCESS',
            latencyMs,
            tokens: { promptTokens: 0, thinkingTokens: 0, outputTokens: 0, totalTokens: 0 },
            reused: true,
            astBlocked: false,
            rawOutput: execRes.result,
          };
        }
      }
      // Candidate tool failed example validation or real input execution: record reuse miss and fall back
    }

    // 3. Fall back to Condition C dynamic synthesis on library miss or validation failure
    const cResult = await runConditionC(task, runIndex, client, sandbox, astVerifier);

    // If newly synthesized tool executed cleanly, index it by description for future tasks
    if (cResult.errorTaxonomy === 'SUCCESS' && cResult.finalCode) {
      library.save(task.prompt, cResult.finalCode);
    }

    return {
      ...cResult,
      condition: 'D',
      reused: false,
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
      condition: 'D',
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
