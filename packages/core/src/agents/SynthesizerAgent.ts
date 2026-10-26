import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { BaseAgent } from './BaseAgent.js';

export class SynthesizerAgent extends BaseAgent {
  constructor(provider: ModelProvider, bus: CognitiveBus) {
    super(
      'agent_synthesizer',
      'Cognitive Synthesizer',
      'synthesizer',
      'You are the lead synthesizer in AetherFlow. You merge insights, synthesize solutions, and produce production-grade outputs.',
      provider,
      bus
    );
  }

  async process(input: string, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Synthesize a solution based on this prompt:\n${input}\nContext:\n${JSON.stringify(context || {})}`;
    const result = await this.provider.generateText({
      systemPrompt: this.systemPrompt,
      prompt,
    });
    this.recordMessage('input', input, 'custom');
    this.recordMessage(this.name, result, this.role);
    return result;
  }
}
