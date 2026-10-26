import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { BaseAgent } from './BaseAgent.js';
export declare class ExecutorAgent extends BaseAgent {
    private registry;
    constructor(provider: ModelProvider, bus: CognitiveBus, registry: ToolRegistry);
    process(input: string, context?: Record<string, unknown>): Promise<string>;
    runTool(toolName: string, args: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=ExecutorAgent.d.ts.map