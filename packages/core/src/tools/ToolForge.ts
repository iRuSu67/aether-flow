import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { ToolDefinition, ToolSynthesisRequest, ToolSynthesisResult } from '../types.js';
import { ASTVerifier } from './ASTVerifier.js';
import { Sandbox } from './Sandbox.js';
import { ToolRegistry } from './ToolRegistry.js';

export class ToolForge {
  private provider: ModelProvider;
  private registry: ToolRegistry;
  private sandbox: Sandbox;
  private astVerifier: ASTVerifier;
  private bus?: CognitiveBus;
  private maxRetries = 3;

  constructor(
    provider: ModelProvider,
    registry: ToolRegistry,
    sandbox?: Sandbox,
    bus?: CognitiveBus
  ) {
    this.provider = provider;
    this.registry = registry;
    this.sandbox = sandbox || new Sandbox();
    this.astVerifier = new ASTVerifier();
    this.bus = bus;
  }

  /**
   * Synthesize a tool just-in-time from a specification and verify in sandbox
   */
  async synthesize(request: ToolSynthesisRequest): Promise<ToolSynthesisResult> {
    this.bus?.emit(
      'tool:requested',
      { toolName: request.toolName, purpose: request.purpose },
      'ToolForge',
      'info'
    );

    let lastError: string | undefined;
    let code = '';
    let iterations = 0;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      iterations = attempt;
      const prompt = this.buildSynthesisPrompt(request, attempt, lastError, code);

      try {
        const rawCode = await this.provider.generateText({ prompt });
        code = this.extractCode(rawCode);

        // Static AST Security Verification
        const astReport = this.astVerifier.verify(code);
        if (!astReport.isSafe) {
          lastError = `AST Security Scan Failed: ${astReport.bannedPatternsDetected.join(', ')}`;
          this.bus?.emit('self_heal:triggered', { attempt, error: lastError, tool: request.toolName }, 'ToolForge', 'warn');
          continue;
        }

        // Verify in sandbox with simulated/sample arguments
        const sampleArgs = this.generateSampleArgs(request);
        const testResult = await this.sandbox.execute(code, sampleArgs);

        if (!testResult.success) {
          lastError = testResult.error || 'Execution failed';
          this.bus?.emit(
            'self_heal:triggered',
            { attempt, error: lastError, tool: request.toolName },
            'ToolForge',
            'warn'
          );
          continue;
        }

        // Verification succeeded! Build executable tool definition
        const createdTool: ToolDefinition = {
          name: request.toolName,
          description: request.purpose,
          parameters: request.inputSpecification,
          isSynthesized: true,
          synthesizedCode: code,
          createdAt: Date.now(),
          handler: async (args: Record<string, unknown>) => {
            const run = await this.sandbox.execute(code, args);
            if (!run.success) {
              throw new Error(`Synthesized tool [${request.toolName}] runtime failure: ${run.error}`);
            }
            return run.result;
          },
        };

        // Register into registry
        this.registry.register(createdTool);

        this.bus?.emit(
          'tool:synthesized',
          {
            toolName: request.toolName,
            iterations,
            verificationDurationMs: testResult.durationMs,
          },
          'ToolForge',
          'success'
        );

        return {
          success: true,
          tool: createdTool,
          code,
          iterations,
        };
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err);
      }
    }

    return {
      success: false,
      error: `Failed to synthesize valid tool after ${this.maxRetries} attempts. Last error: ${lastError}`,
      code,
      iterations,
    };
  }

  private buildSynthesisPrompt(
    req: ToolSynthesisRequest,
    attempt: number,
    previousError?: string,
    previousCode?: string
  ): string {
    let prompt = `You are an expert systems programmer. Synthesize a self-contained JavaScript tool function.
Tool Name: ${req.toolName}
Purpose: ${req.purpose}
Parameters: ${JSON.stringify(req.inputSpecification, null, 2)}
Expected Output: ${req.expectedOutput}

Format strictly as:
export default async function execute(args) {
  // your logic here
  return { ... };
}
Only output the code, no markdown commentary.`;

    if (attempt > 1 && previousError) {
      prompt += `\n\n[SELF-HEALING ATTEMPT ${attempt}]:
The previous implementation produced the following error:
${previousError}
Previous code:
${previousCode}
Fix the bug, ensure safe null/undefined handling, and return the corrected code.`;
    }

    return prompt;
  }

  private extractCode(raw: string): string {
    const codeMatch = raw.match(/```(?:javascript|js|typescript|ts)?\s*([\s\S]*?)```/);
    if (codeMatch && codeMatch[1]) {
      return codeMatch[1].trim();
    }
    return raw.trim();
  }

  private generateSampleArgs(req: ToolSynthesisRequest): Record<string, unknown> {
    const sample: Record<string, unknown> = {};
    for (const param of req.inputSpecification) {
      if (param.type === 'number') sample[param.name] = 42;
      else if (param.type === 'boolean') sample[param.name] = true;
      else if (param.type === 'array') sample[param.name] = [1, 2, 3];
      else if (param.type === 'object') sample[param.name] = { key: 'sample' };
      else sample[param.name] = 'test_value';
    }
    return sample;
  }
}
