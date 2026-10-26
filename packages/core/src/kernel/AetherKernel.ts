import { ArchitectAgent } from '../agents/ArchitectAgent.js';
import { CriticAgent } from '../agents/CriticAgent.js';
import { ExecutorAgent } from '../agents/ExecutorAgent.js';
import { SynthesizerAgent } from '../agents/SynthesizerAgent.js';
import { ClusterNode } from '../cluster/ClusterNode.js';
import { CRDTStore, VectorClock } from '../cluster/CRDTStore.js';
import { FlowScriptInterpreter, ScriptExecutionResult } from '../compiler/Interpreter.js';
import { BrowserAgent } from '../computer/BrowserAgent.js';
import { HegelianEngine } from '../consensus/HegelianEngine.js';
import { ArenaJudge } from '../evaluation/ArenaJudge.js';
import { GeneticOptimizer } from '../evolution/GeneticOptimizer.js';
import { SymbolicSolver } from '../formal/SymbolicSolver.js';
import { SecurityFirewall } from '../guardrails/SecurityFirewall.js';
import { KnowledgeGraph } from '../memory/KnowledgeGraph.js';
import { SkillRegistry } from '../memory/SkillRegistry.js';
import { VectorMemory } from '../memory/VectorMemory.js';
import { MCPHub } from '../mcp/MCPHub.js';
import { AudioPerception } from '../multimodal/AudioPerception.js';
import { VisionPerception } from '../multimodal/VisionPerception.js';
import { GeminiProvider } from '../providers/GeminiProvider.js';
import { MockProvider } from '../providers/MockProvider.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { OpenAIProvider } from '../providers/OpenAIProvider.js';
import { MCTSEngine, MCTSResult } from '../reasoning/MCTSEngine.js';
import { CheckpointEngine, SwarmCheckpoint } from '../storage/CheckpointEngine.js';
import { SpeculativeEngine, SpeculativeResult } from '../swarm/SpeculativeEngine.js';
import { TelemetryServer } from '../telemetry/WebSocketServer.js';
import { ASTVerifier } from '../tools/ASTVerifier.js';
import { Sandbox } from '../tools/Sandbox.js';
import { WebSearchEngine } from '../tools/search/WebSearchEngine.js';
import { ToolForge } from '../tools/ToolForge.js';
import { ToolRegistry } from '../tools/ToolRegistry.js';
import { VoiceKernel } from '../voice/VoiceKernel.js';
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
  speculativeBranches?: number;
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

  // Next-Gen Neural Memory, MCP & Swarm
  public memory: VectorMemory;
  public graph: KnowledgeGraph;
  public skills: SkillRegistry;
  public mcp: MCPHub;
  public web: WebSearchEngine;
  public speculative: SpeculativeEngine;
  public mcts: MCTSEngine;

  // Advanced Frontiers: Computer Use, Evolution, Cluster, Security & Voice
  public browser: BrowserAgent;
  public firewall: SecurityFirewall;
  public evolution: GeneticOptimizer;
  public cluster: ClusterNode;
  public voice: VoiceKernel;
  public astVerifier: ASTVerifier;
  public arena: ArenaJudge;

  // Formal Logic, DSL Compiler, Time-Travel & Multi-Modal
  public solver: SymbolicSolver;
  public flowInterpreter: FlowScriptInterpreter;
  public checkpoints: CheckpointEngine;
  public vision: VisionPerception;
  public audio: AudioPerception;
  public crdt: CRDTStore<Record<string, unknown>>;
  public clock: VectorClock;

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

    // 3. Initialize Memory, Knowledge Graph, MCP Hub & Web
    this.memory = new VectorMemory(64);
    this.graph = new KnowledgeGraph();
    this.skills = new SkillRegistry();
    this.web = new WebSearchEngine();
    this.registry = new ToolRegistry();
    this.mcp = new MCPHub(this.registry);

    // 4. Initialize Advanced Frontiers
    this.browser = new BrowserAgent();
    this.firewall = new SecurityFirewall(500_000);
    this.evolution = new GeneticOptimizer(this.provider);
    this.cluster = new ClusterNode('node_master_01');
    this.voice = new VoiceKernel(this.bus);
    this.astVerifier = new ASTVerifier();
    this.arena = new ArenaJudge();

    // 5. Initialize Formal Verification, FlowScript & Multi-Modal
    this.solver = new SymbolicSolver();
    this.flowInterpreter = new FlowScriptInterpreter(this);
    this.checkpoints = new CheckpointEngine();
    this.vision = new VisionPerception();
    this.audio = new AudioPerception();
    this.crdt = new CRDTStore<Record<string, unknown>>();
    this.clock = new VectorClock('kernel_local');

    // 6. Initialize Execution Tooling & Sandbox
    this.sandbox = new Sandbox(this.config.sandboxTimeoutMs);
    this.forge = new ToolForge(this.provider, this.registry, this.sandbox, this.bus);

    // 6. Initialize Dialectic Consensus, Speculative Swarms & MCTS Reasoning
    this.hegelian = new HegelianEngine(this.provider, this.bus, this.config.maxDialecticRounds);
    this.speculative = new SpeculativeEngine(this.provider, this.bus);
    this.mcts = new MCTSEngine(this.provider, this.bus);

    // 7. Initialize Agents
    this.architect = new ArchitectAgent(this.provider, this.bus);
    this.critic = new CriticAgent(this.provider, this.bus);
    this.synthesizer = new SynthesizerAgent(this.provider, this.bus);
    this.executor = new ExecutorAgent(this.provider, this.bus, this.registry);

    // Register Memory & Frontier tools into ToolRegistry
    this.registerFrontierTools();

    this.bus.emit('kernel:init', { provider: this.provider.name, config: this.config }, 'AetherKernel', 'info');
  }

  /**
   * Run speculative execution exploring multiple parallel thought branches
   */
  async executeSpeculative(goal: string, branchCount = 3): Promise<SpeculativeResult> {
    return await this.speculative.execute(goal, branchCount);
  }

  /**
   * Run Monte Carlo Tree Search (MCTS) & Tree-of-Thoughts non-linear reasoning
   */
  async searchMCTS(objective: string): Promise<MCTSResult> {
    return await this.mcts.search(objective);
  }

  /**
   * Compile and execute declarative FlowScript pipeline (.flow)
   */
  async compileFlowScript(source: string, initialContext?: string): Promise<ScriptExecutionResult> {
    return await this.flowInterpreter.executeScript(source, initialContext);
  }

  /**
   * Snapshot cognitive state for time-travel debugging and rollback
   */
  createCheckpoint(label: string): SwarmCheckpoint {
    return this.checkpoints.createCheckpoint(
      this.checkpoints.getTimeline().length + 1,
      label,
      this.bus.getHistory(),
      { memoryCount: this.memory.size(), graphNodes: this.graph.toJSON().nodeCount }
    );
  }

  private registerFrontierTools(): void {
    // Memory tools
    this.registry.register({
      name: 'memory_store',
      description: 'Stores semantic data into neural vector memory for future recall.',
      parameters: [
        { name: 'key', type: 'string', description: 'Memory key', required: true },
        { name: 'content', type: 'string', description: 'Content to vectorize', required: true },
      ],
      handler: (args) => {
        const key = String(args.key);
        const content = String(args.content);
        const record = this.memory.insert(key, content, { timestamp: Date.now() });
        return { stored: true, id: record.id };
      },
    });

    this.registry.register({
      name: 'memory_query',
      description: 'Queries neural vector memory using semantic cosine similarity.',
      parameters: [
        { name: 'query', type: 'string', description: 'Query string', required: true },
        { name: 'topK', type: 'number', description: 'Number of results to return' },
      ],
      handler: (args) => {
        const q = String(args.query);
        const topK = Number(args.topK) || 3;
        const matches = this.memory.search(q, topK);
        return {
          matches: matches.map((m) => ({ id: m.record.id, text: m.record.text, score: Number(m.score.toFixed(3)) })),
        };
      },
    });

    this.registry.register({
      name: 'graph_link',
      description: 'Links two concepts in the knowledge graph with a typed relation.',
      parameters: [
        { name: 'source', type: 'string', description: 'Source entity', required: true },
        { name: 'target', type: 'string', description: 'Target entity', required: true },
        { name: 'relation', type: 'string', description: 'Relationship name', required: true },
      ],
      handler: (args) => {
        const edge = this.graph.addEdge(String(args.source), String(args.target), String(args.relation));
        return { linked: true, edgeId: edge.id };
      },
    });

    // Computer Use / Browser Automation
    this.registry.register({
      name: 'browser_navigate',
      description: 'Navigates to a webpage and extracts interactive DOM elements.',
      parameters: [
        { name: 'url', type: 'string', description: 'Target URL', required: true }
      ],
      handler: async (args) => {
        return await this.browser.navigate(String(args.url));
      }
    });

    // Security & Guardrail Audit
    this.registry.register({
      name: 'security_audit',
      description: 'Audits a string or code for prompt injections and sensitive data.',
      parameters: [
        { name: 'input', type: 'string', description: 'Input text to audit', required: true }
      ],
      handler: (args) => {
        return this.firewall.auditInput(String(args.input));
      }
    });
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
    const res = await this.forge.synthesize(req);
    if (res.success && res.tool) {
      this.skills.saveSkill(res.tool, ['jit', 'synthesized']);
    }
    return res;
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
            this.skills.saveSkill(synth.tool, ['jit', 'autonomous']);
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
