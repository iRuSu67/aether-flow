import { AgentVisibleTask, TaskRunResult, TokenUsage } from '../types.js';
import { EvalModelClient, ProviderError } from '../providers/EvalModelClient.js';
import { extractJsonFromText } from '../utils/json-extractor.js';
import { isHarnessStopError } from '../utils/errors.js';

// Static tools for Condition B (Weak Baseline)
function executeStaticTool(toolName: string, args: Record<string, any>): any {
  switch (toolName) {
    case 'math_calc': {
      const expr = String(args.expr || '');
      if (/^[0-9+\-*/().\s]+$/.test(expr)) {
        try {
          return new Function(`return (${expr})`)();
        } catch {}
      }
      return null;
    }
    case 'regex_match': {
      const re = new RegExp(args.pattern, args.flags || '');
      return args.text.match(re);
    }
    case 'json_path': {
      const obj = args.data;
      const pathParts = String(args.path || '').split('.').filter(Boolean);
      let cur = obj;
      for (const p of pathParts) {
        if (cur == null) return null;
        cur = cur[p];
      }
      return cur;
    }
    case 'string_slice': {
      return String(args.text || '').slice(args.start, args.end);
    }
    case 'array_sort': {
      const arr = Array.isArray(args.array) ? [...args.array] : [];
      return arr.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    }
    default:
      return { error: `Tool '${toolName}' not in fixed palette` };
  }
}

export async function runConditionB(
  task: AgentVisibleTask,
  runIndex: number,
  client: EvalModelClient
): Promise<TaskRunResult> {
  const startTime = performance.now();
  const systemPrompt = `FIXED_TOOL_CONDITION_B: You are an agent with access to a FIXED static tool palette:
1. math_calc(expr: string) -> number
2. regex_match(pattern: string, text: string, flags?: string) -> match
3. json_path(data: object, path: string) -> value
4. string_slice(text: string, start: number, end?: number) -> string
5. array_sort(array: any[]) -> array

To call a tool, output:
\`\`\`tool_call
{"tool": "<name>", "args": { ... }}
\`\`\`

If you have the final answer, output strictly in JSON:
\`\`\`json
<final_result>
\`\`\``;

  let userPrompt = `${task.prompt}\n\nTask Input:\n${JSON.stringify(task.input, null, 2)}`;
  let turns = 0;
  const maxTurns = 2;
  const cumulativeTokens: TokenUsage = {
    promptTokens: 0,
    thinkingTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
  };

  let lastToolResult: unknown = null;

  try {
    while (turns <= maxTurns) {
      turns++;
      const response = await client.complete({
        systemPrompt,
        prompt: userPrompt,
        runIndex,
      });

      cumulativeTokens.promptTokens += response.tokens.promptTokens;
      cumulativeTokens.thinkingTokens += response.tokens.thinkingTokens;
      cumulativeTokens.outputTokens += response.tokens.outputTokens;
      cumulativeTokens.totalTokens += response.tokens.totalTokens;

      // Check if model called a tool
      const toolMatch = response.text.match(/```tool_call\s*([\s\S]*?)\s*```/i);
      if (toolMatch && toolMatch[1] && turns <= maxTurns) {
        try {
          const callObj = JSON.parse(toolMatch[1].trim());
          lastToolResult = executeStaticTool(callObj.tool, callObj.args || {});
          userPrompt += `\n\nAgent Output:\n${response.text}\n\nTool Result:\n${JSON.stringify(lastToolResult)}`;
          continue;
        } catch {}
      }

      // Check for final JSON answer
      const extraction = extractJsonFromText(response.text);
      const latencyMs = performance.now() - startTime;
      const candidateAnswer = extraction.success ? extraction.data : lastToolResult;

      if (!candidateAnswer) {
        return {
          taskId: task.id,
          familyId: task.familyId,
          condition: 'B',
          runIndex,
          pass: false,
          retries: turns - 1,
          errorTaxonomy: 'WRONG_OUTPUT',
          errorDetails: 'No valid output produced by fixed tools or agent',
          latencyMs,
          tokens: cumulativeTokens,
          reused: false,
          astBlocked: false,
          rawOutput: response.text,
        };
      }

      return {
        taskId: task.id,
        familyId: task.familyId,
        condition: 'B',
        runIndex,
        pass: false, // External harness scores with task.checker post-hoc
        retries: turns - 1,
        errorTaxonomy: 'SUCCESS',
        latencyMs,
        tokens: cumulativeTokens,
        reused: false,
        astBlocked: false,
        rawOutput: candidateAnswer,
      };
    }

    const latencyMs = performance.now() - startTime;
    return {
      taskId: task.id,
      familyId: task.familyId,
      condition: 'B',
      runIndex,
      pass: false,
      retries: turns,
      errorTaxonomy: 'WRONG_OUTPUT',
      errorDetails: 'Exceeded max tool-use turns without final answer',
      latencyMs,
      tokens: cumulativeTokens,
      reused: false,
      astBlocked: false,
    };
  } catch (err: unknown) {
    if (isHarnessStopError(err)) {
      throw err;
    }
    const latencyMs = performance.now() - startTime;
    const isProv = err instanceof ProviderError;
    return {
      taskId: task.id,
      familyId: task.familyId,
      variant: task.variant,
      condition: 'B',
      runIndex,
      pass: false,
      retries: turns,
      errorTaxonomy: isProv ? 'PROVIDER_ERROR' : 'RUNTIME_ERROR',
      errorDetails: err instanceof Error ? err.message : String(err),
      latencyMs,
      tokens: cumulativeTokens,
      reused: false,
      astBlocked: false,
    };
  }
}
