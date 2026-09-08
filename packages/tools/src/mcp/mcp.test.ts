import { describe, it, expect } from 'vitest';
import { McpServer } from './mcp-server.js';
import { McpToolAdapter } from './tool-adapter.js';
import { McpClient } from './mcp-client.js';
import type { McpServerInfo } from './types.js';

// ── MCP Server ──

describe('McpServer', () => {
  it('registers and lists tools', () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    server.registerTool(
      { name: 'greet', description: 'Say hello', inputSchema: { type: 'object', properties: { name: { type: 'string' } } } },
      async (params) => `Hello ${params.name}!`,
    );

    const tools = server.listTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('greet');
  });

  it('calls a registered tool', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    server.registerTool(
      { name: 'add', description: 'Add numbers', inputSchema: { type: 'object', properties: { a: { type: 'number' }, b: { type: 'number' } } } },
      async (params) => String(Number(params.a) + Number(params.b)),
    );

    const result = await server.callTool('add', { a: 2, b: 3 });
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toBe('5');
  });

  it('returns error for unknown tool', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    const result = await server.callTool('nonexistent', {});
    expect(result.isError).toBe(true);
  });

  it('handles tool errors gracefully', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    server.registerTool(
      { name: 'fail', description: 'Always fails', inputSchema: { type: 'object', properties: {} } },
      async () => { throw new Error('Boom'); },
    );

    const result = await server.callTool('fail', {});
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe('Boom');
  });

  it('handles JSON-RPC initialize', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    const response = await server.handleJsonRpc({ method: 'initialize', id: 1 }) as Record<string, unknown>;
    const result = response.result as Record<string, unknown>;
    expect((result.serverInfo as Record<string, unknown>).name).toBe('titan');
  });

  it('handles JSON-RPC tools/list', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    server.registerTool(
      { name: 'test', description: 'Test', inputSchema: { type: 'object', properties: {} } },
      async () => 'ok',
    );

    const response = await server.handleJsonRpc({ method: 'tools/list', id: 2 }) as Record<string, unknown>;
    const result = response.result as Record<string, unknown>;
    expect((result.tools as unknown[]).length).toBe(1);
  });

  it('handles JSON-RPC tools/call', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    server.registerTool(
      { name: 'echo', description: 'Echo', inputSchema: { type: 'object', properties: { msg: { type: 'string' } } } },
      async (params) => String(params.msg),
    );

    const response = await server.handleJsonRpc({ method: 'tools/call', params: { name: 'echo', arguments: { msg: 'hi' } }, id: 3 }) as Record<string, unknown>;
    const result = response.result as Record<string, unknown>;
    expect((result.content as Array<{ text: string }>)[0].text).toBe('hi');
  });

  it('returns error for unknown JSON-RPC method', async () => {
    const server = new McpServer({ name: 'titan', version: '1.0' });
    const response = await server.handleJsonRpc({ method: 'unknown', id: 4 }) as Record<string, unknown>;
    expect(response.error).toBeDefined();
  });

  it('reports server info', () => {
    const server = new McpServer({ name: 'titan', version: '2.0' });
    server.registerTool({ name: 'a', description: 'A', inputSchema: { type: 'object', properties: {} } }, async () => 'ok');
    const info = server.getServerInfo();
    expect(info.name).toBe('titan');
    expect(info.toolCount).toBe(1);
  });
});

// ── MCP Tool Adapter ──

describe('McpToolAdapter', () => {
  it('adapts MCP tools to Titan format', () => {
    const client = new McpClient();
    // Manually inject a connected server for testing
    const servers = (client as unknown as { servers: Map<string, McpServerInfo> }).servers;
    servers.set('test-server', {
      name: 'test-server',
      version: '1.0',
      url: 'http://localhost:3001',
      status: 'connected',
      tools: [
        { name: 'search', description: 'Search docs', inputSchema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] } },
      ],
    });

    const adapter = new McpToolAdapter(client);
    const tools = adapter.adaptAll();

    expect(tools.length).toBe(1);
    expect(tools[0].name).toContain('mcp_test_server_search');
    expect(tools[0].tags).toContain('mcp');
    expect(tools[0].schema?.query.type).toBe('string');
    expect(tools[0].requiredParams).toEqual(['query']);
  });

  it('skips disconnected servers', () => {
    const client = new McpClient();
    const servers = (client as unknown as { servers: Map<string, McpServerInfo> }).servers;
    servers.set('offline', {
      name: 'offline',
      version: '1.0',
      url: 'http://localhost:9999',
      status: 'disconnected',
      tools: [{ name: 'tool', description: 'Tool', inputSchema: { type: 'object', properties: {} } }],
    });

    const adapter = new McpToolAdapter(client);
    expect(adapter.adaptAll().length).toBe(0);
  });
});
