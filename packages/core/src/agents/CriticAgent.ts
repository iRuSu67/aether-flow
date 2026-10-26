import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { BaseAgent } from './BaseAgent.js';

export class CriticAgent extends BaseAgent {
  constructor(provider: ModelProvider, bus: CognitiveBus) {
    super(
      'agent_critic',
      'Adversarial Critic',
      'critic',
      'You are the adversarial security and correctness auditor of AetherFlow. You inspect code, plans, and outputs for bugs, hallucinations, edge-case failures, and safety risks.',
      provider,
      bus
    );
  }

  async process(input: string, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Critique the following artifact with rigorous scrutiny:\n${input}\nContext:\n${JSON.stringify(context || {})}`;
    const critique = await this.provider.generateText({
      systemPrompt: this.systemPrompt,
      prompt,
    });
    this.recordMessage('target', input, 'custom');
    this.recordMessage(this.name, critique, this.role);
    return critique;
  }
}
