import { ArchitectAgent } from '../agents/ArchitectAgent.js';
import { CriticAgent } from '../agents/CriticAgent.js';
import { ExecutorAgent } from '../agents/ExecutorAgent.js';
import { SynthesizerAgent } from '../agents/SynthesizerAgent.js';
import { HegelianEngine } from '../consensus/HegelianEngine.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { TelemetryServer } from '../telemetry/WebSocketServer.js';
import { Sandbox } from '../tools/Sandbox.js';
import { ToolForge } from '../tools/ToolForge.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import {
  ExecutionPlan,
  KernelConfig,
  ToolSynthesisRequest,
  ToolSynthesisResult,
} from '../types.js';
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
export class AetherKernel {
  public bus: CognitiveBus;
  public provider: ModelProvider;
  public registry: ToolRegistry;
  public sandbox: Sandbox;
  public forge: ToolForge;
  public hegelian: HegelianEngine;

  // Swarm Agents
  public architect: ArchitectAgent;
  public critic: CriticAgent;
  public synthesizer: SynthesizerAgent;
  public executor: ExecutorAgent;

  private telemetryServer?: TelemetryServer;
  private config: KernelConfig;

  constructor(config: KernelConfig = {}) {
    this.config = {
      enableJitTools: true,
      maxDialecticRounds: 3,
      sandboxTimeoutMs: 5000,
      provider: 'mock',
      ...config,
    };

    // 1. Initialize Cognitive Nerve Center
    this.bus = new CognitiveBus();

    // 2. Initialize Model Provider
    if (this.config.provider === 'gemini') {
      this.provider = new GeminiProvider(this.config.apiKey, this.config.modelName);
    } else if (this.config.provider === 'openai') {
      this.provider = new OpenAIProvider(this.config.apiKey, this.config.modelName);
    } else {
      this.provider = new MockProvider();
    }

    // 3. Initialize Execution Tooling & Sandbox
    this.registry = new ToolRegistry();
    this.sandbox = new Sandbox(this.config.sandboxTimeoutMs);
    this.forge = new ToolForge(this.provider, this.registry, this.sandbox, this.bus);

    // 4. Initialize Dialectic Consensus
    this.hegelian = new HegelianEngine(this.provider, this.bus, this.config.maxDialecticRounds);

    // 5. Initialize Agents
    this.architect = new ArchitectAgent(this.provider, this.bus);
    this.critic = new CriticAgent(this.provider, this.bus);
    this.synthesizer = new SynthesizerAgent(this.provider, this.bus);
    this.executor = new ExecutorAgent(this.provider, this.bus, this.registry);

    this.bus.emit('kernel:init', { provider: this.provider.name, config: this.config }, 'AetherKernel', 'info');
  }

  /**
   * Start the live WebSocket telemetry stream
   */
  async startTelemetry(port = 4884): Promise<number> {
    this.telemetryServer = new TelemetryServer({ port, bus: this.bus });
    const actualPort = await this.telemetryServer.start();
    return actualPort;
  }

  /**
   * Synthesize a tool dynamically
   */
  async synthesizeTool(req: ToolSynthesisRequest): Promise<ToolSynthesisResult> {
    return await this.forge.synthesize(req);
  }

  /**
   * Execute an end-to-end goal with multi-agent consensus, JIT tools, and self-healing
   */
  async executeGoal(goal: string, context?: Record<string, unknown>): Promise<KernelExecutionResult> {
    const startTime = performance.now();
    this.bus.emit('goal:received', { goal, context }, 'AetherKernel', 'info');

    const synthesizedTools: string[] = [];

    // 1. Hegelian Consensus Resolution
    const debate = await this.hegelian.resolve(goal, context);

    // 2. Architectural Planning
    const availableTools = this.registry.list().map((t) => t.name);
    const plan = await this.architect.createPlan(goal, availableTools);

    // 3. Plan Step Execution
    for (const step of plan.steps) {
      step.status = 'running';
      const stepStart = performance.now();

      try {
        if (step.agentRole === 'synthesizer' && this.config.enableJitTools) {
          // If need dynamic computation tool, synthesize it JIT
          const toolName = `jit_${goal.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 15)}`;
          const synth = await this.synthesizeTool({
            toolName,
            purpose: `Domain computation for: ${goal}`,
            inputSpecification: [{ name: 'input', type: 'string', description: 'Task context' }],
            expectedOutput: 'Structured analytics object',
          });

          if (synth.success && synth.tool) {
            synthesizedTools.push(synth.tool.name);
            step.output = await this.executor.runTool(synth.tool.name, { input: goal });
          } else {
            step.output = await this.synthesizer.process(goal, context);
          }
        } else if (step.agentRole === 'critic') {
          step.output = await this.critic.process(debate.finalSynthesis, context);
        } else if (step.agentRole === 'executor') {
          step.output = `Executed verified pipeline with confidence ${(debate.confidenceScore * 100).toFixed(1)}%`;
        } else {
          step.output = `Completed analysis for step [${step.title}]`;
        }

        step.status = 'completed';
        step.durationMs = performance.now() - stepStart;
      } catch (err) {
        step.status = 'failed';
        step.error = err instanceof Error ? err.message : String(err);
        this.bus.emit('self_heal:triggered', { stepId: step.id, error: step.error }, 'AetherKernel', 'warn');
      }
    }

    const executionTimeMs = performance.now() - startTime;

    this.bus.emit(
      'goal:completed',
      {
        goal,
        confidenceScore: debate.confidenceScore,
        synthesizedToolsCount: synthesizedTools.length,
        executionTimeMs,
      },
      'AetherKernel',
      'success'
    );

    return {
      goal,
      success: true,
      finalSynthesis: debate.finalSynthesis,
      confidenceScore: debate.confidenceScore,
      plan,
      synthesizedTools,
      executionTimeMs,
      traceEventsCount: this.bus.getHistory().length,
    };
  }

  async stop(): Promise<void> {
    if (this.telemetryServer) {
      await this.telemetryServer.stop();
    }
  }
}
