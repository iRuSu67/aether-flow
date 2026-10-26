import { CognitiveBus } from '../kernel/CognitiveBus.js';
import { ModelProvider } from '../providers/ModelProvider.js';
import { AgentMessage, AgentRole } from '../types.js';

export abstract class BaseAgent {
  public id: string;
  public name: string;
  public role: AgentRole;
  public systemPrompt: string;
  protected provider: ModelProvider;
  protected bus: CognitiveBus;
  protected memory: AgentMessage[] = [];

  constructor(
    id: string,
    name: string,
    role: AgentRole,
    systemPrompt: string,
    provider: ModelProvider,
    bus: CognitiveBus
  ) {
    this.id = id;
    this.name = name;
    this.role = role;
    this.systemPrompt = systemPrompt;
    this.provider = provider;
    this.bus = bus;
  }

  public recordMessage(sender: string, content: string, role: AgentRole): AgentMessage {
    const msg: AgentMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sender,
      role,
      content,
      timestamp: Date.now(),
    };
    this.memory.push(msg);
    return msg;
  }

  public getMemory(): AgentMessage[] {
    return [...this.memory];
  }

  public clearMemory(): void {
    this.memory = [];
  }

  public abstract process(input: string, context?: Record<string, unknown>): Promise<string>;
}
