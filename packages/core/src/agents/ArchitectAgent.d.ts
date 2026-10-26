import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { ExecutionPlan } from '../types.js';
import { BaseAgent } from './BaseAgent.js';
export declare class ArchitectAgent extends BaseAgent {
    constructor(provider: ModelProvider, bus: CognitiveBus);
    process(goal: string, context?: Record<string, unknown>): Promise<string>;
    createPlan(goal: string, availableTools: string[]): Promise<ExecutionPlan>;
}
//# sourceMappingURL=ArchitectAgent.d.ts.map