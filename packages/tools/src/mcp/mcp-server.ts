import { getLogger } from '@titan/logging';
import type { McpServerConfig, McpToolDefinition, McpToolCallResult } from './types.js';

const log = getLogger().child({ component: 'mcp-server' });

export interface McpServerToolHandler {
  (params: Record<string, unknown>): Promise<string>;
}

interface RegisteredTool {
  definition: McpToolDefinition;
  handler: McpServerToolHandler;
}

export class McpServer {
  private tools: Map<string, RegisteredTool> = new Map();
  private config: McpServerConfig;

  constructor(config: McpServerConfig) {
    this.config = config;
  }

  registerTool(definition: McpToolDefinition, handler: McpServerToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
    log.info({ tool: definition.name }, 'MCP tool registered');
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  listTools(): McpToolDefinition[] {
    return Array.from(this.tools.values()).map((t) => t.definition);
  }

  async callTool(name: string, params: Record<string, unknown>): Promise<McpToolCallResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { content: [{ type: 'text', text: `Unknown tool: ${name}` }], isError: true };
    }

    try {
      const result = await tool.handler(params);
      return { content: [{ type: 'text', text: result }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { content: [{ type: 'text', text: msg }], isError: true };
    }
  }

  handleJsonRpc(request: { method: string; params?: Record<string, unknown>; id?: number }): Promise<unknown> {
    switch (request.method) {
      case 'initialize':
        return Promise.resolve({
          jsonrpc: '2.0',
          result: {
            protocolVersion: '2024-11-05',
            serverInfo: { name: this.config.name, version: this.config.version },
            capabilities: { tools: {} },
          },
          id: request.id,
        });

      case 'tools/list':
        return Promise.resolve({
          jsonrpc: '2.0',
          result: { tools: this.listTools() },
          id: request.id,
        });

      case 'tools/call':
        return this.handleToolCall(request.params ?? {}, request.id);

      default:
        return Promise.resolve({
          jsonrpc: '2.0',
          error: { code: -32601, message: `Method not found: ${request.method}` },
          id: request.id,
        });
    }
  }

  getServerInfo(): { name: string; version: string; toolCount: number } {
    return {
      name: this.config.name,
      version: this.config.version,
      toolCount: this.tools.size,
    };
  }

  private async handleToolCall(params: Record<string, unknown>, id?: number): Promise<unknown> {
    const name = String(params.name ?? '');
    const args = (params.arguments ?? {}) as Record<string, unknown>;

    const result = await this.callTool(name, args);
    return {
      jsonrpc: '2.0',
      result,
      id,
    };
  }
}
