import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { BaseAgent } from './BaseAgent.js';
export declare class SynthesizerAgent extends BaseAgent {
    constructor(provider: ModelProvider, bus: CognitiveBus);
    process(input: string, context?: Record<string, unknown>): Promise<string>;
}
//# sourceMappingURL=SynthesizerAgent.d.ts.map