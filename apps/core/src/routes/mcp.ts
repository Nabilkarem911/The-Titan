import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { McpClient } from '@titan/tools';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS, ValidationError } from '@titan/shared';
import { getGlobalToolRegistry } from '@titan/agent-engine';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'mcp-routes' });

const mcpClient = new McpClient();

const ConnectSchema = {
  body: {
    type: 'object' as const,
    required: ['serverUrl'],
    properties: {
      serverUrl: { type: 'string' },
      serverName: { type: 'string' },
      apiKey: { type: 'string' },
      timeout: { type: 'number' },
    },
  },
};

const CallToolSchema = {
  body: {
    type: 'object' as const,
    required: ['toolName', 'params'],
    properties: {
      toolName: { type: 'string' },
      params: { type: 'object' },
    },
  },
};

export const mcpRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/mcp/servers — list connected MCP servers
  app.get('/api/v1/mcp/servers', { preHandler: [requireAuth] }, async (_req, reply) => {
    const servers = mcpClient.listServers();
    return reply.send({ servers, total: servers.length });
  });

  // POST /api/v1/mcp/connect — connect to an MCP server
  app.post('/api/v1/mcp/connect', {
    preHandler: [requireAuth],
    schema: ConnectSchema,
  }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { serverUrl, serverName, apiKey, timeout } = req.body as {
      serverUrl: string;
      serverName?: string;
      apiKey?: string;
      timeout?: number;
    };

    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      throw new ValidationError('serverUrl must start with http:// or https://');
    }

    const info = await mcpClient.connect({ serverUrl, serverName, apiKey, timeout });
    return reply.send(info);
  });

  // DELETE /api/v1/mcp/servers/:name — disconnect from an MCP server
  app.delete<{ Params: { name: string } }>('/api/v1/mcp/servers/:name', {
    preHandler: [requireAuth],
  }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    mcpClient.disconnect(req.params.name);
    return reply.send({ disconnected: true, server: req.params.name });
  });

  // GET /api/v1/mcp/tools — list all tools from all connected MCP servers
  app.get('/api/v1/mcp/tools', { preHandler: [requireAuth] }, async (req, reply) => {
    const serverName = (req.query as { server?: string }).server;
    const tools = mcpClient.listTools(serverName);
    return reply.send({ tools, total: tools.length });
  });

  // POST /api/v1/mcp/call — call a tool on a specific MCP server
  app.post<{ Params: { name: string } }>('/api/v1/mcp/servers/:name/call', {
    preHandler: [requireAuth],
    schema: CallToolSchema,
  }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { name } = req.params;
    const { toolName, params } = req.body as { toolName: string; params: Record<string, unknown> };

    const result = await mcpClient.callTool(name, toolName, params);
    return reply.send(result);
  });

  // GET /api/v1/mcp/servers/:name/health — health check a specific server
  app.get<{ Params: { name: string } }>('/api/v1/mcp/servers/:name/health', {
    preHandler: [requireAuth],
  }, async (req, reply) => {
    const healthy = await mcpClient.healthCheck(req.params.name);
    return reply.send({ server: req.params.name, healthy });
  });

  // POST /api/v1/mcp/register — register MCP tools into the global tool registry
  app.post('/api/v1/mcp/register', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const serverName = (req.body as { server?: string }).server;
    const tools = mcpClient.listTools(serverName);
    const registry = getGlobalToolRegistry();
    let registered = 0;

    for (const tool of tools) {
      try {
        registry.register({
          name: `mcp_${tool.name}`,
          description: tool.description,
          schema: tool.inputSchema.properties,
          requiredParams: tool.inputSchema.required ?? [],
          handler: async (params: unknown) => {
            const result = await mcpClient.callTool(serverName ?? '', tool.name, params as Record<string, unknown>);
            if (result.isError) {
              return { success: false, error: result.content[0]?.text ?? 'MCP tool error' };
            }
            return { success: true, data: result.content[0]?.text ?? '' };
          },
        });
        registered++;
      } catch (err) {
        log.warn({ tool: tool.name, err }, 'failed to register MCP tool');
      }
    }

    return reply.send({ registered, total: tools.length });
  });
};
