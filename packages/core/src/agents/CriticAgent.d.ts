import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { BaseAgent } from './BaseAgent.js';
export declare class CriticAgent extends BaseAgent {
    constructor(provider: ModelProvider, bus: CognitiveBus);
    process(input: string, context?: Record<string, unknown>): Promise<string>;
}
//# sourceMappingURL=CriticAgent.d.ts.map