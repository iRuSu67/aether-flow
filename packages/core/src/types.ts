/**
 * AetherFlow Core Types
 * Defines the core microkernel, agent, tool synthesis, and consensus types.
 */

export type AgentRole = 'orchestrator' | 'synthesizer' | 'critic' | 'executor' | 'custom';

export interface AgentMessage {
  id: string;
  sender: string;
  role: AgentRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export type EventSeverity = 'info' | 'warn' | 'error' | 'success' | 'debug';

export interface CognitiveEvent {
  id: string;
  type: 
    | 'kernel:init'
    | 'goal:received'
    | 'plan:generated'
    | 'agent:debate'
    | 'agent:consensus'
    | 'tool:requested'
    | 'tool:synthesized'
    | 'tool:executed'
    | 'sandbox:output'
    | 'sandbox:error'
    | 'self_heal:triggered'
    | 'goal:completed';
  agent?: string;
  payload: Record<string, unknown>;
  timestamp: number;
  severity: EventSeverity;
}

export interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  handler: (args: Record<string, unknown>) => Promise<unknown> | unknown;
  isSynthesized?: boolean;
  synthesizedCode?: string;
  createdAt?: number;
}

export interface ToolSynthesisRequest {
  toolName: string;
  purpose: string;
  inputSpecification: ToolParameter[];
  expectedOutput: string;
}

export interface ToolSynthesisResult {
  success: boolean;
  tool?: ToolDefinition;
  code?: string;
  error?: string;
  iterations: number;
}

export interface DialecticRound {
  round: number;
  thesis: string;
  antithesis: string;
  synthesis: string;
  converged: boolean;
  confidenceScore: number;
}

export interface ExecutionStep {
  id: string;
  title: string;
  agentRole: AgentRole;
  toolNeeded?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'healed';
  input?: unknown;
  output?: unknown;
  error?: string;
  durationMs?: number;
}

export interface ExecutionPlan {
  id: string;
  goal: string;
  steps: ExecutionStep[];
  estimatedComplexity: 'low' | 'medium' | 'high' | 'critical';
  createdAt: number;
}

export interface KernelConfig {
  logLevel?: 'silent' | 'info' | 'verbose';
  maxDialecticRounds?: number;
  enableJitTools?: boolean;
  sandboxTimeoutMs?: number;
  telemetryPort?: number;
  provider?: 'mock' | 'gemini' | 'openai' | 'ollama';
  apiKey?: string;
  modelName?: string;
}
