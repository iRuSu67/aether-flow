import { AgentVisibleTask, TaskRunResult } from '../types.js';
import { EvalModelClient } from '../providers/EvalModelClient.js';
import { extractJsonFromText } from '../utils/json-extractor.js';
import { isHarnessStopError, isProviderError } from '../utils/errors.js';

export async function runConditionA(
  task: AgentVisibleTask,
  runIndex: number,
  client: EvalModelClient
): Promise<TaskRunResult> {
  const startTime = performance.now();
  const systemPrompt = `DIRECT_ANSWER_CONDITION_A: You are an expert programmer and mathematical reasoning agent.
Solve the following task directly without access to external tools.
You MUST output your final answer strictly in valid JSON matching the required format.`;

  const userPrompt = `${task.prompt}\n\nTask Input:\n${JSON.stringify(task.input, null, 2)}\n\nRespond with ONLY valid JSON:`;

  try {
    const response = await client.complete({
      systemPrompt,
      prompt: userPrompt,
      runIndex,
    });

    const extraction = extractJsonFromText(response.text);
    const latencyMs = performance.now() - startTime;

    if (!extraction.success) {
      return {
        taskId: task.id,
        familyId: task.familyId,
        condition: 'A',
        runIndex,
        pass: false,
        retries: 0,
        errorTaxonomy: 'WRONG_OUTPUT',
        errorDetails: `JSON parse error: ${extraction.error}`,
        latencyMs,
        tokens: response.tokens,
        reused: false,
        astBlocked: false,
        rawOutput: response.text,
      };
    }

    return {
      taskId: task.id,
      familyId: task.familyId,
      condition: 'A',
      runIndex,
      pass: false, // External harness scores with task.checker post-hoc
      retries: 0,
      errorTaxonomy: 'SUCCESS',
      latencyMs,
      tokens: response.tokens,
      reused: false,
      astBlocked: false,
      rawOutput: extraction.data,
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
      condition: 'A',
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
