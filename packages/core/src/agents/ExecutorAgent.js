import { BaseAgent } from './BaseAgent.js';
export class ExecutorAgent extends BaseAgent {
    registry;
    constructor(provider, bus, registry) {
        super('agent_executor', 'Runtime Executor', 'executor', 'You are the sandboxed execution agent of AetherFlow. You execute registered tools, handle runtime errors, and report outputs.', provider, bus);
        this.registry = registry;
    }
    async process(input, context) {
        return `[Executor]: Processing task: ${input}. Context: ${JSON.stringify(context || {})}`;
    }
    async runTool(toolName, args) {
        this.bus.emit('tool:requested', { toolName, args }, this.name, 'info');
        try {
            const output = await this.registry.execute(toolName, args);
            this.bus.emit('tool:executed', { toolName, output }, this.name, 'success');
            return output;
        }
        catch (err) {
            const errorMsg = err instanceof Error ? err.message : String(err);
            this.bus.emit('sandbox:error', { toolName, error: errorMsg }, this.name, 'error');
            throw err;
        }
    }
}
//# sourceMappingURL=ExecutorAgent.js.map