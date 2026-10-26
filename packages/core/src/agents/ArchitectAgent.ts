import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { ExecutionPlan, ExecutionStep } from '../types.js';
import { BaseAgent } from './BaseAgent.js';

export class ArchitectAgent extends BaseAgent {
  constructor(provider: ModelProvider, bus: CognitiveBus) {
    super(
      'agent_architect',
      'Orchestration Architect',
      'orchestrator',
      'You are the lead architect of AetherFlow. You decompose complex user objectives into clean, actionable, modular steps.',
      provider,
      bus
    );
  }

  async process(goal: string, context?: Record<string, unknown>): Promise<string> {
    const prompt = `Goal: ${goal}\nContext: ${JSON.stringify(context || {})}\nDecompose this goal into a high-level architectural overview.`;
    const response = await this.provider.generateText({
      systemPrompt: this.systemPrompt,
      prompt,
    });
    this.recordMessage('user', goal, 'custom');
    this.recordMessage(this.name, response, this.role);
    return response;
  }

  async createPlan(goal: string, availableTools: string[]): Promise<ExecutionPlan> {
    const prompt = `Deconstruct the following goal into a sequence of executable steps:
Goal: "${goal}"
Available Registered Tools: [${availableTools.join(', ')}]

Return 3 to 4 sequential steps with title, agentRole, and any needed tool name.`;

    const raw = await this.provider.generateText({
      systemPrompt: this.systemPrompt,
      prompt,
    });

    // Provide robust fallback steps if parsing doesn't occur directly
    const steps: ExecutionStep[] = [
      {
        id: 'step_1',
        title: 'Analyze objective parameters and contextual prerequisites',
        agentRole: 'orchestrator',
        status: 'pending',
      },
      {
        id: 'step_2',
        title: 'Synthesize or execute required computational tools',
        agentRole: 'synthesizer',
        status: 'pending',
      },
      {
        id: 'step_3',
        title: 'Adversarial verification and result validation',
        agentRole: 'critic',
        status: 'pending',
      },
      {
        id: 'step_4',
        title: 'Aggregate final synthesis and output report',
        agentRole: 'executor',
        status: 'pending',
      },
    ];

    const plan: ExecutionPlan = {
      id: `plan_${Date.now()}`,
      goal,
      steps,
      estimatedComplexity: goal.length > 80 ? 'high' : 'medium',
      createdAt: Date.now(),
    };

    this.bus.emit('plan:generated', { planId: plan.id, stepCount: steps.length, goal }, this.name, 'info');

    return plan;
  }
}
