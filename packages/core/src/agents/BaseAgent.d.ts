import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { AgentMessage, AgentRole } from '../types.js';
export declare abstract class BaseAgent {
    id: string;
    name: string;
    role: AgentRole;
    systemPrompt: string;
    protected provider: ModelProvider;
    protected bus: CognitiveBus;
    protected memory: AgentMessage[];
    constructor(id: string, name: string, role: AgentRole, systemPrompt: string, provider: ModelProvider, bus: CognitiveBus);
    recordMessage(sender: string, content: string, role: AgentRole): AgentMessage;
    getMemory(): AgentMessage[];
    clearMemory(): void;
    abstract process(input: string, context?: Record<string, unknown>): Promise<string>;
}
//# sourceMappingURL=BaseAgent.d.ts.map