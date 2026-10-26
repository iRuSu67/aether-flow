import { ToolDefinition } from '../types.js';
export declare class ToolRegistry {
    private tools;
    constructor();
    /**
     * Register a standard or dynamic tool
     */
    register(tool: ToolDefinition): void;
    /**
     * Check if tool exists
     */
    has(name: string): boolean;
    /**
     * Get tool definition
     */
    get(name: string): ToolDefinition | undefined;
    /**
     * List all registered tools
     */
    list(): ToolDefinition[];
    /**
     * Execute a registered tool
     */
    execute(name: string, args: Record<string, unknown>): Promise<unknown>;
    /**
     * Pre-loads essential foundational tools
     */
    private registerStandardTools;
}
//# sourceMappingURL=ToolRegistry.d.ts.map