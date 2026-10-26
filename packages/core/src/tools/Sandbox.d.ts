export interface SandboxExecutionResult {
    success: boolean;
    result?: unknown;
    logs: string[];
    error?: string;
    durationMs: number;
}
/**
 * Safe execution sandbox for running synthesized tool code and dynamic scripts.
 * Employs timeouts, custom contexts, and captured console logs.
 */
export declare class Sandbox {
    private timeoutMs;
    constructor(timeoutMs?: number);
    /**
     * Execute raw JS code or an exported function in a fortified vm context.
     */
    execute(code: string, args?: Record<string, unknown>): Promise<SandboxExecutionResult>;
}
//# sourceMappingURL=Sandbox.d.ts.map