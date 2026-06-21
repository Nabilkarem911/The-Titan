import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const log = getLogger().child({ component: 'web-mcp' });

export interface WebMCPServer {
  id: string;
  name: string;
  url: string;
  protocolVersion: string;
  capabilities: string[];
  status: 'connected' | 'disconnected' | 'error';
  connectedAt: Date | null;
  lastPing: Date | null;
  tools: WebMCPTool[];
}

export interface WebMCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  serverId: string;
}

export interface WebMCPInvocationResult {
  id: string;
  serverId: string;
  toolName: string;
  input: Record<string, unknown>;
  output: unknown;
  success: boolean;
  error?: string;
  durationMs: number;
  timestamp: Date;
}

export interface WebMCPStats {
  totalServers: number;
  connectedServers: number;
  totalTools: number;
  totalInvocations: number;
  successfulInvocations: number;
  failedInvocations: number;
  avgDurationMs: number;
  byServer: Array<{ serverId: string; name: string; invocations: number; successRate: number }>;
}

export class WebMCPBridge extends EventEmitter {
  private servers: Map<string, WebMCPServer> = new Map();
  private invocations: WebMCPInvocationResult[] = [];
  private maxInvocations = 500;

  constructor() {
    super();
  }

  registerServer(config: {
    id?: string;
    name: string;
    url: string;
    protocolVersion?: string;
    capabilities?: string[];
  }): WebMCPServer {
    const id = config.id ?? randomUUID().slice(0, 8);
    const server: WebMCPServer = {
      id,
      name: config.name,
      url: config.url,
      protocolVersion: config.protocolVersion ?? '2025-06-18',
      capabilities: config.capabilities ?? [],
      status: 'connected',
      connectedAt: new Date(),
      lastPing: new Date(),
      tools: [],
    };

    this.servers.set(id, server);
    incCounter('webmcp_register', 'WebMCP server registrations', 1);
    this.emit('server:registered', server);
    log.info({ id, name: config.name, url: config.url }, 'WebMCP server registered');
    return server;
  }

  unregisterServer(id: string): boolean {
    const server = this.servers.get(id);
    if (!server) return false;
    server.status = 'disconnected';
    this.servers.delete(id);
    this.emit('server:unregistered', { id });
    log.info({ id }, 'WebMCP server unregistered');
    return true;
  }

  async discoverTools(serverId: string): Promise<WebMCPTool[]> {
    const server = this.servers.get(serverId);
    if (!server) return [];

    try {
      const response = await fetch(`${server.url}/tools`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        server.status = 'error';
        log.error({ serverId, status: response.status }, 'tool discovery failed');
        return server.tools;
      }

      const data = await response.json() as { tools?: Array<{ name: string; description: string; inputSchema: Record<string, unknown> }> };
      server.tools = (data.tools ?? []).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema,
        serverId,
      }));
      server.lastPing = new Date();

      incCounter('webmcp_discover', 'WebMCP tool discoveries', 1);
      log.info({ serverId, toolCount: server.tools.length }, 'tools discovered');
      return server.tools;
    } catch (err) {
      server.status = 'error';
      log.error({ err, serverId }, 'tool discovery error');
      return server.tools;
    }
  }

  async invokeTool(
    serverId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<WebMCPInvocationResult> {
    const server = this.servers.get(serverId);
    const startedAt = Date.now();
    const invocationId = randomUUID().slice(0, 8);

    if (!server) {
      return {
        id: invocationId,
        serverId,
        toolName,
        input,
        output: null,
        success: false,
        error: 'Server not found',
        durationMs: 0,
        timestamp: new Date(),
      };
    }

    try {
      const response = await fetch(`${server.url}/tools/${toolName}/invoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
        signal: AbortSignal.timeout(30000),
      });

      const data = await response.json() as { output?: unknown; error?: string };
      const success = response.ok;
      const result: WebMCPInvocationResult = {
        id: invocationId,
        serverId,
        toolName,
        input,
        output: data.output ?? null,
        success,
        error: success ? undefined : data.error ?? `HTTP ${response.status}`,
        durationMs: Date.now() - startedAt,
        timestamp: new Date(),
      };

      this.invocations.push(result);
      if (this.invocations.length > this.maxInvocations) {
        this.invocations = this.invocations.slice(-this.maxInvocations);
      }

      server.lastPing = new Date();
      incCounter('webmcp_invoke', 'WebMCP invocations', 1, { success: success ? 'true' : 'false' });
      this.emit('tool:invoked', result);
      log.info({ invocationId, serverId, toolName, success, durationMs: result.durationMs }, 'tool invoked');
      return result;
    } catch (err) {
      const result: WebMCPInvocationResult = {
        id: invocationId,
        serverId,
        toolName,
        input,
        output: null,
        success: false,
        error: String(err),
        durationMs: Date.now() - startedAt,
        timestamp: new Date(),
      };

      this.invocations.push(result);
      if (this.invocations.length > this.maxInvocations) {
        this.invocations = this.invocations.slice(-this.maxInvocations);
      }

      server.status = 'error';
      incCounter('webmcp_invoke', 'WebMCP invocations', 1, { success: 'false' });
      log.error({ err, invocationId, serverId, toolName }, 'tool invocation failed');
      return result;
    }
  }

  async pingServer(serverId: string): Promise<boolean> {
    const server = this.servers.get(serverId);
    if (!server) return false;

    try {
      const response = await fetch(`${server.url}/ping`, {
        method: 'GET',
        signal: AbortSignal.timeout(5000),
      });
      const alive = response.ok;
      server.lastPing = new Date();
      server.status = alive ? 'connected' : 'error';
      return alive;
    } catch {
      server.status = 'error';
      return false;
    }
  }

  async pingAll(): Promise<Array<{ serverId: string; alive: boolean }>> {
    const results: Array<{ serverId: string; alive: boolean }> = [];
    for (const id of this.servers.keys()) {
      const alive = await this.pingServer(id);
      results.push({ serverId: id, alive });
    }
    return results;
  }

  getServer(id: string): WebMCPServer | null {
    return this.servers.get(id) ?? null;
  }

  getServers(): WebMCPServer[] {
    return Array.from(this.servers.values());
  }

  getConnectedServers(): WebMCPServer[] {
    return this.getServers().filter((s) => s.status === 'connected');
  }

  getAllTools(): WebMCPTool[] {
    return this.getServers().flatMap((s) => s.tools);
  }

  getInvocations(filter?: { serverId?: string; success?: boolean }): WebMCPInvocationResult[] {
    let result = this.invocations;
    if (filter?.serverId) result = result.filter((i) => i.serverId === filter.serverId);
    if (filter?.success !== undefined) result = result.filter((i) => i.success === filter.success);
    return result;
  }

  stats(): WebMCPStats {
    const all = Array.from(this.servers.values());
    const connected = all.filter((s) => s.status === 'connected');
    const totalTools = all.reduce((s, srv) => s + srv.tools.length, 0);
    const totalInv = this.invocations.length;
    const successful = this.invocations.filter((i) => i.success).length;
    const avgDuration = totalInv > 0
      ? Math.round(this.invocations.reduce((s, i) => s + i.durationMs, 0) / totalInv)
      : 0;

    const byServerMap = new Map<string, { name: string; invocations: number; successCount: number }>();
    for (const inv of this.invocations) {
      const server = this.servers.get(inv.serverId);
      const entry = byServerMap.get(inv.serverId) ?? {
        name: server?.name ?? inv.serverId,
        invocations: 0,
        successCount: 0,
      };
      entry.invocations++;
      if (inv.success) entry.successCount++;
      byServerMap.set(inv.serverId, entry);
    }

    return {
      totalServers: all.length,
      connectedServers: connected.length,
      totalTools,
      totalInvocations: totalInv,
      successfulInvocations: successful,
      failedInvocations: totalInv - successful,
      avgDurationMs: avgDuration,
      byServer: Array.from(byServerMap.entries()).map(([serverId, v]) => ({
        serverId,
        name: v.name,
        invocations: v.invocations,
        successRate: v.invocations > 0 ? Math.round((v.successCount / v.invocations) * 100) : 0,
      })),
    };
  }

  clear(): void {
    this.invocations = [];
  }
}
