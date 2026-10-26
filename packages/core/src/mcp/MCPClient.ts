import { spawn, ChildProcess } from 'node:child_process';
import { ToolDefinition } from '../types.js';
import { MCPRequest, MCPResponse, MCPToolSchema } from './types.js';

export class MCPClient {
  public serverName: string;
  private process: ChildProcess | null = null;
  private pendingRequests: Map<string | number, (response: MCPResponse) => void> = new Map();
  private requestId = 1;
  private buffer = '';

  constructor(serverName: string) {
    this.serverName = serverName;
  }

  /**
   * Connect to an external MCP server via stdio process spawn
   */
  public async connectProcess(command: string, args: string[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = spawn(command, args, {
          stdio: ['pipe', 'pipe', 'pipe'],
          shell: true,
        });

        this.process.stdout?.on('data', (chunk: Buffer) => {
          this.handleStdout(chunk.toString('utf8'));
        });

        this.process.stderr?.on('data', (err: Buffer) => {
          console.warn(`[MCP:${this.serverName}] stderr:`, err.toString('utf8'));
        });

        this.process.on('error', (err) => {
          reject(err);
        });

        // Initialize MCP handshake
        this.sendRequest('initialize', {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          clientInfo: { name: 'AetherFlow-Swarm-Client', version: '1.0.0' },
        })
          .then(() => resolve())
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * List tools exposed by this MCP server
   */
  public async listTools(): Promise<MCPToolSchema[]> {
    const res = await this.sendRequest<{ tools: MCPToolSchema[] }>('tools/list', {});
    return res.tools || [];
  }

  /**
   * Call a tool on the external MCP server
   */
  public async callTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const res = await this.sendRequest<{ content: Array<{ type: string; text?: string }> }>('tools/call', {
      name,
      arguments: args,
    });
    return res.content;
  }

  /**
   * Adapt MCP tools to native AetherFlow ToolDefinition format
   */
  public adaptToAetherTools(mcpTools: MCPToolSchema[]): ToolDefinition[] {
    return mcpTools.map((t) => ({
      name: `mcp_${this.serverName}_${t.name}`,
      description: `[MCP:${this.serverName}] ${t.description}`,
      parameters: Object.entries(t.inputSchema.properties || {}).map(([key, val]: [string, any]) => ({
        name: key,
        type: val.type || 'string',
        description: val.description || '',
        required: t.inputSchema.required?.includes(key),
      })),
      handler: async (args) => await this.callTool(t.name, args),
    }));
  }

  public disconnect(): void {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private sendRequest<T>(method: string, params: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id,
        method,
        params,
      };

      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP Request timed out (${method})`));
      }, 10000);

      this.pendingRequests.set(id, (res: MCPResponse) => {
        clearTimeout(timeout);
        if (res.error) {
          reject(new Error(`MCP Error ${res.error.code}: ${res.error.message}`));
        } else {
          resolve(res.result as T);
        }
      });

      const message = JSON.stringify(request) + '\n';
      this.process?.stdin?.write(message);
    });
  }

  private handleStdout(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const response: MCPResponse = JSON.parse(trimmed);
        if (response.id && this.pendingRequests.has(response.id)) {
          const handler = this.pendingRequests.get(response.id);
          this.pendingRequests.delete(response.id);
          handler?.(response);
        }
      } catch {
        // Ignore unparseable non-JSON logs
      }
    }
  }
}
