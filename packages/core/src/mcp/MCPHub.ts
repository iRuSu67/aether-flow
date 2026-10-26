import { ToolRegistry } from '../tools/ToolRegistry.js';
import { MCPClient } from './MCPClient.js';
import { MCPToolSchema } from './types.js';

export interface MCPServerConfig {
  name: string;
  command: string;
  args?: string[];
}

export class MCPHub {
  private clients: Map<string, MCPClient> = new Map();
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  /**
   * Connect to an external MCP server and auto-register its tools into AetherFlow
   */
  public async connect(config: MCPServerConfig): Promise<number> {
    const client = new MCPClient(config.name);
    await client.connectProcess(config.command, config.args || []);
    this.clients.set(config.name, client);

    const mcpTools: MCPToolSchema[] = await client.listTools();
    const adapted = client.adaptToAetherTools(mcpTools);

    for (const tool of adapted) {
      this.registry.register(tool);
    }

    return adapted.length;
  }

  public listConnectedServers(): string[] {
    return Array.from(this.clients.keys());
  }

  public disconnectAll(): void {
    for (const client of this.clients.values()) {
      client.disconnect();
    }
    this.clients.clear();
  }
}
