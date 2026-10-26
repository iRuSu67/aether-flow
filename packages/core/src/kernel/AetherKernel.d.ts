import { ArchitectAgent } from '../agents/ArchitectAgent.js';
import { CriticAgent } from '../agents/CriticAgent.js';
import { ExecutorAgent } from '../agents/ExecutorAgent.js';
import { SynthesizerAgent } from '../agents/SynthesizerAgent.js';
import { HegelianEngine } from '../consensus/HegelianEngine.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { Sandbox } from '../tools/Sandbox.js';
import { ToolForge } from '../tools/ToolForge.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { ExecutionPlan, KernelConfig, ToolSynthesisRequest, ToolSynthesisResult } from '../types.js';
import { CognitiveBus } from './CognitiveBus.js';
export interface KernelExecutionResult {
    goal: string;
    success: boolean;
    finalSynthesis: string;
    confidenceScore: number;
    plan: ExecutionPlan;
    synthesizedTools: string[];
    executionTimeMs: number;
    traceEventsCount: number;
}
/**
 * AetherKernel
 * The unified autonomous multi-agent microkernel.
 */
export declare class AetherKernel {
    bus: CognitiveBus;
    provider: ModelProvider;
    registry: ToolRegistry;
    sandbox: Sandbox;
    forge: ToolForge;
    hegelian: HegelianEngine;
    architect: ArchitectAgent;
    critic: CriticAgent;
    synthesizer: SynthesizerAgent;
    executor: ExecutorAgent;
    private telemetryServer?;
    private config;
    constructor(config?: KernelConfig);
    /**
     * Start the live WebSocket telemetry stream
     */
    startTelemetry(port?: number): Promise<number>;
    /**
     * Synthesize a tool dynamically
     */
    synthesizeTool(req: ToolSynthesisRequest): Promise<ToolSynthesisResult>;
    /**
     * Execute an end-to-end goal with multi-agent consensus, JIT tools, and self-healing
     */
    executeGoal(goal: string, context?: Record<string, unknown>): Promise<KernelExecutionResult>;
    stop(): Promise<void>;
}
//# sourceMappingURL=AetherKernel.d.ts.map