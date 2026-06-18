import { getLogger } from '@titan/logging';
import type { McpToolDefinition } from './types.js';
import type { McpClient } from './mcp-client.js';

const log = getLogger().child({ component: 'mcp-tool-adapter' });

export interface TitanToolDefinition {
  name: string;
  description: string;
  handler: (params: unknown) => Promise<unknown>;
  tags?: string[];
  schema?: Record<string, { type: string; description?: string; enum?: string[] }>;
  requiredParams?: string[];
}

export class McpToolAdapter {
  constructor(private client: McpClient) {}

  adaptAll(): TitanToolDefinition[] {
    const tools: TitanToolDefinition[] = [];

    for (const server of this.client.listServers()) {
      if (server.status !== 'connected') continue;

      for (const mcpTool of server.tools) {
        tools.push(this.adaptOne(server.name, mcpTool));
      }
    }

    log.info({ count: tools.length }, 'MCP tools adapted for Titan');
    return tools;
  }

  adaptOne(serverName: string, mcpTool: McpToolDefinition): TitanToolDefinition {
    const fullName = `mcp_${serverName}_${mcpTool.name}`.replace(/[^a-zA-Z0-9_]/g, '_');

    const schema: Record<string, { type: string; description?: string; enum?: string[] }> = {};
    if (mcpTool.inputSchema?.properties) {
      for (const [key, val] of Object.entries(mcpTool.inputSchema.properties)) {
        schema[key] = { type: val.type, description: val.description, enum: val.enum };
      }
    }

    return {
      name: fullName,
      description: `[MCP:${serverName}] ${mcpTool.description}`,
      tags: ['mcp', serverName],
      schema,
      requiredParams: mcpTool.inputSchema?.required,
      handler: async (params: unknown) => {
        const result = await this.client.callTool(
          serverName,
          mcpTool.name,
          (params ?? {}) as Record<string, unknown>,
        );

        if (result.isError) {
          throw new Error(result.content.map((c) => c.text).join('\n'));
        }

        return result.content.map((c) => c.text).join('\n');
      },
    };
  }
}
