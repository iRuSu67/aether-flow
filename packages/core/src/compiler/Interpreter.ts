import { AetherKernel } from '../kernel/AetherKernel.js';
import { FlowScriptLexer } from './Lexer.js';
import { FlowScriptParser, SwarmProgramAST } from './Parser.js';

export interface ScriptExecutionResult {
  swarmName: string;
  stepOutputs: Array<{ agent: string; action?: string; output: string }>;
  success: boolean;
  durationMs: number;
}

export class FlowScriptInterpreter {
  private kernel: AetherKernel;

  constructor(kernel: AetherKernel) {
    this.kernel = kernel;
  }

  /**
   * Compile and execute raw FlowScript code
   */
  public async executeScript(source: string, initialContext = ''): Promise<ScriptExecutionResult> {
    const start = performance.now();
    const lexer = new FlowScriptLexer(source);
    const tokens = lexer.tokenize();

    const parser = new FlowScriptParser(tokens);
    const ast: SwarmProgramAST = parser.parse();

    const stepOutputs: Array<{ agent: string; action?: string; output: string }> = [];
    let state = initialContext || `Execution seed for swarm ${ast.name}`;

    for (const step of ast.pipeline) {
      let output = '';
      if (step.agent.toLowerCase().includes('architect')) {
        output = await this.kernel.architect.process(state);
      } else if (step.agent.toLowerCase().includes('critic')) {
        output = await this.kernel.critic.process(state);
      } else if (step.agent.toLowerCase().includes('synth')) {
        output = await this.kernel.synthesizer.process(state);
      } else {
        output = await this.kernel.executor.process(state);
      }

      stepOutputs.push({ agent: step.agent, action: step.action, output });
      state = output;
    }

    const durationMs = performance.now() - start;

    return {
      swarmName: ast.name,
      stepOutputs,
      success: true,
      durationMs,
    };
  }
}
