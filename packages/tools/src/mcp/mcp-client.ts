import { getLogger } from '@titan/logging';
import type { McpClientConfig, McpServerInfo, McpToolDefinition, McpToolCallResult } from './types.js';

const log = getLogger().child({ component: 'mcp-client' });

const DEFAULT_TIMEOUT = 30000;

export class McpClient {
  private servers: Map<string, McpServerInfo> = new Map();
  private configs: Map<string, McpClientConfig> = new Map();

  async connect(config: McpClientConfig): Promise<McpServerInfo> {
    const serverName = config.serverName ?? new URL(config.serverUrl).hostname;

    try {
      const tools = await this.discoverTools(config);

      const info: McpServerInfo = {
        name: serverName,
        version: 'unknown',
        url: config.serverUrl,
        tools,
        status: 'connected',
        lastPing: new Date(),
      };

      this.servers.set(serverName, info);
      this.configs.set(serverName, config);

      log.info({ server: serverName, tools: tools.length }, 'MCP server connected');
      return info;
    } catch (err) {
      const info: McpServerInfo = {
        name: serverName,
        version: 'unknown',
        url: config.serverUrl,
        tools: [],
        status: 'error',
      };
      this.servers.set(serverName, info);
      log.error({ server: serverName, err: err instanceof Error ? err.message : 'Unknown' }, 'MCP connection failed');
      return info;
    }
  }

  disconnect(serverName: string): void {
    this.servers.delete(serverName);
    this.configs.delete(serverName);
    log.info({ server: serverName }, 'MCP server disconnected');
  }

  async callTool(serverName: string, toolName: string, params: Record<string, unknown>): Promise<McpToolCallResult> {
    const config = this.configs.get(serverName);
    if (!config) {
      return { content: [{ type: 'text', text: `Server "${serverName}" not connected` }], isError: true };
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (config.apiKey) {
        headers['Authorization'] = `Bearer ${config.apiKey}`;
      }

      const response = await fetch(`${config.serverUrl}/tools/call`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: toolName, arguments: params },
          id: Date.now(),
        }),
        signal: AbortSignal.timeout(config.timeout ?? DEFAULT_TIMEOUT),
      });

      if (!response.ok) {
        const errText = await response.text();
        return { content: [{ type: 'text', text: `MCP error ${response.status}: ${errText}` }], isError: true };
      }

      const data = await response.json() as { result?: McpToolCallResult; error?: { message: string } };
      if (data.error) {
        return { content: [{ type: 'text', text: data.error.message }], isError: true };
      }

      return data.result ?? { content: [{ type: 'text', text: 'No result' }] };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      log.error({ server: serverName, tool: toolName, err: msg }, 'MCP tool call failed');
      return { content: [{ type: 'text', text: `Tool call failed: ${msg}` }], isError: true };
    }
  }

  listTools(serverName?: string): McpToolDefinition[] {
    if (serverName) {
      return this.servers.get(serverName)?.tools ?? [];
    }
    const allTools: McpToolDefinition[] = [];
    for (const server of this.servers.values()) {
      for (const tool of server.tools) {
        allTools.push({ ...tool, name: `${server.name}/${tool.name}` });
      }
    }
    return allTools;
  }

  listServers(): McpServerInfo[] {
    return Array.from(this.servers.values());
  }

  getServer(name: string): McpServerInfo | undefined {
    return this.servers.get(name);
  }

  async healthCheck(serverName: string): Promise<boolean> {
    const config = this.configs.get(serverName);
    if (!config) return false;

    try {
      const response = await fetch(`${config.serverUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const healthy = response.ok;

      const info = this.servers.get(serverName);
      if (info) {
        info.status = healthy ? 'connected' : 'error';
        info.lastPing = new Date();
      }

      return healthy;
    } catch {
      const info = this.servers.get(serverName);
      if (info) info.status = 'error';
      return false;
    }
  }

  private async discoverTools(config: McpClientConfig): Promise<McpToolDefinition[]> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) {
      headers['Authorization'] = `Bearer ${config.apiKey}`;
    }

    const response = await fetch(`${config.serverUrl}/tools/list`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: Date.now(),
      }),
      signal: AbortSignal.timeout(config.timeout ?? DEFAULT_TIMEOUT),
    });

    if (!response.ok) {
      throw new Error(`Discovery failed: ${response.status}`);
    }

    const data = await response.json() as { result?: { tools?: McpToolDefinition[] } };
    return data.result?.tools ?? [];
  }
}
