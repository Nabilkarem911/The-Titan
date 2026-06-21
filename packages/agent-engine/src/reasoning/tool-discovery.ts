import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'tool-discovery' });

export interface DiscoveredTool {
  id: string;
  name: string;
  description: string;
  category: string;
  source: 'npm' | 'github' | 'api' | 'mcp' | 'custom';
  url?: string;
  installCommand?: string;
  apiEndpoint?: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  verified: boolean;
  installed: boolean;
  discoveredAt: Date;
  installedAt?: Date;
  reliabilityScore: number;
}

export interface DiscoveryQuery {
  id: string;
  taskDescription: string;
  missingCapabilities: string[];
  status: 'searching' | 'found' | 'not-found' | 'installed';
  results: DiscoveredTool[];
  createdAt: Date;
}

export interface DiscoveryStats {
  totalDiscoveries: number;
  installedTools: number;
  verifiedTools: number;
  bySource: Array<{ source: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  avgReliability: number;
}

const DISCOVERY_PROMPT = `You are a tool discovery agent. The user needs to accomplish a task but doesn't have the right tools.

Given the task description and missing capabilities, search for tools that could help.

Consider:
1. npm packages that provide the needed functionality
2. GitHub repositories with APIs
3. Public APIs that could be called
4. MCP (Model Context Protocol) servers
5. Custom tool implementations

For each tool, provide:
- Name, description, category
- Source type (npm, github, api, mcp, custom)
- Installation method
- Parameters it accepts
- Reliability estimate (0-100)

Respond in JSON:
{
  "tools": [
    {
      "name": "tool name",
      "description": "what it does",
      "category": "data|file|web|ai|system|comms|cloud",
      "source": "npm|github|api|mcp|custom",
      "url": "source URL",
      "installCommand": "how to install (if applicable)",
      "apiEndpoint": "API URL (if applicable)",
      "parameters": [{"name": "param", "type": "string", "required": true, "description": "what"}],
      "reliabilityScore": 0-100
    }
  ]
}`;

const VERIFICATION_PROMPT = `You are a tool verification agent. Verify whether a discovered tool is safe and functional.

Check:
1. Is the source reputable?
2. Are the parameters reasonable?
3. Is there any security risk?
4. Is the tool likely to work as described?

Respond in JSON:
{
  "verified": true/false,
  "riskLevel": "low|medium|high",
  "notes": "verification notes"
}`;

export class DynamicToolDiscovery extends EventEmitter {
  private discovered: Map<string, DiscoveredTool> = new Map();
  private queries: DiscoveryQuery[] = [];
  private maxQueries = 100;
  private maxTools = 500;

  constructor(private llm: LlmProvider) {
    super();
  }

  async discover(
    taskDescription: string,
    missingCapabilities?: string[],
  ): Promise<DiscoveryQuery> {
    const queryId = randomUUID().slice(0, 8);
    const query: DiscoveryQuery = {
      id: queryId,
      taskDescription,
      missingCapabilities: missingCapabilities ?? [],
      status: 'searching',
      results: [],
      createdAt: new Date(),
    };

    this.emit('discovery:start', query);
    log.info({ queryId, task: taskDescription.slice(0, 80) }, 'tool discovery started');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: DISCOVERY_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            taskDescription,
            missingCapabilities: query.missingCapabilities,
            existingTools: Array.from(this.discovered.values())
              .filter((t) => t.installed)
              .map((t) => t.name)
              .slice(0, 20),
          }),
        },
      ], { temperature: 0.4, maxTokens: 1000 });

      const tools = this.parseTools(response.content);

      // Verify each tool
      for (const tool of tools) {
        const verified = await this.verifyTool(tool);
        tool.verified = verified;
        this.discovered.set(tool.id, tool);
        if (this.discovered.size > this.maxTools) {
          // Remove oldest uninstalled
          const oldest = Array.from(this.discovered.values())
            .filter((t) => !t.installed)
            .sort((a, b) => a.discoveredAt.getTime() - b.discoveredAt.getTime())[0];
          if (oldest) this.discovered.delete(oldest.id);
        }
      }

      query.results = tools;
      query.status = tools.length > 0 ? 'found' : 'not-found';

      this.queries.push(query);
      if (this.queries.length > this.maxQueries) {
        this.queries = this.queries.slice(-this.maxQueries);
      }

      incCounter('tool_discovery_run', 'Tool discovery runs', 1);
      incCounter('tool_discovery_found', 'Tools discovered', tools.length);

      log.info({ queryId, found: tools.length }, 'tool discovery complete');
      this.emit('discovery:complete', query);

      return query;
    } catch (err) {
      log.error({ err, queryId }, 'tool discovery failed');
      query.status = 'not-found';
      this.emit('discovery:error', { queryId, err });
      return query;
    }
  }

  async installTool(toolId: string): Promise<{ success: boolean; error?: string }> {
    const tool = this.discovered.get(toolId);
    if (!tool) return { success: false, error: 'Tool not found' };
    if (tool.installed) return { success: false, error: 'Already installed' };

    log.info({ toolId, name: tool.name, source: tool.source }, 'installing discovered tool');

    try {
      // In a real implementation, this would actually install the tool
      // (npm install, clone repo, register API endpoint, etc.)
      // For now, we mark it as installed and emit the event
      tool.installed = true;
      tool.installedAt = new Date();

      incCounter('tool_discovery_installed', 'Tools installed', 1);
      log.info({ toolId, name: tool.name }, 'tool installed');
      this.emit('tool:installed', tool);

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Install failed',
      };
    }
  }

  async uninstallTool(toolId: string): Promise<{ success: boolean }> {
    const tool = this.discovered.get(toolId);
    if (!tool || !tool.installed) return { success: false };
    tool.installed = false;
    tool.installedAt = undefined;
    this.emit('tool:uninstalled', tool);
    return { success: true };
  }

  getDiscoveredTools(): DiscoveredTool[] {
    return Array.from(this.discovered.values());
  }

  getInstalledTools(): DiscoveredTool[] {
    return Array.from(this.discovered.values()).filter((t) => t.installed);
  }

  getQueries(): DiscoveryQuery[] {
    return this.queries;
  }

  stats(): DiscoveryStats {
    const tools = Array.from(this.discovered.values());
    const installed = tools.filter((t) => t.installed);
    const verified = tools.filter((t) => t.verified);
    const avgReliability = tools.length > 0
      ? Math.round(tools.reduce((s, t) => s + t.reliabilityScore, 0) / tools.length)
      : 0;

    const sourceMap = new Map<string, number>();
    for (const t of tools) {
      sourceMap.set(t.source, (sourceMap.get(t.source) ?? 0) + 1);
    }

    const categoryMap = new Map<string, number>();
    for (const t of tools) {
      categoryMap.set(t.category, (categoryMap.get(t.category) ?? 0) + 1);
    }

    return {
      totalDiscoveries: tools.length,
      installedTools: installed.length,
      verifiedTools: verified.length,
      bySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
      byCategory: Array.from(categoryMap.entries()).map(([category, count]) => ({ category, count })),
      avgReliability,
    };
  }

  clear(): void {
    this.discovered.clear();
    this.queries = [];
  }

  private async verifyTool(tool: DiscoveredTool): Promise<boolean> {
    try {
      const response = await this.llm.complete([
        { role: 'system', content: VERIFICATION_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            name: tool.name,
            source: tool.source,
            url: tool.url,
            apiEndpoint: tool.apiEndpoint,
            parameters: tool.parameters,
          }),
        },
      ], { temperature: 0.1, maxTokens: 300 });

      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return false;
      const raw = JSON.parse(jsonMatch[0]);
      return Boolean(raw.verified);
    } catch {
      return false;
    }
  }

  private parseTools(content: string): DiscoveredTool[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw.tools)) return [];

      return raw.tools.map((t: Record<string, unknown>) => ({
        id: randomUUID().slice(0, 8),
        name: String(t.name ?? 'unknown'),
        description: String(t.description ?? ''),
        category: String(t.category ?? 'general'),
        source: (t.source as DiscoveredTool['source']) ?? 'custom',
        url: t.url ? String(t.url) : undefined,
        installCommand: t.installCommand ? String(t.installCommand) : undefined,
        apiEndpoint: t.apiEndpoint ? String(t.apiEndpoint) : undefined,
        parameters: Array.isArray(t.parameters)
          ? t.parameters.map((p: Record<string, unknown>) => ({
              name: String(p.name ?? ''),
              type: String(p.type ?? 'string'),
              required: Boolean(p.required ?? false),
              description: String(p.description ?? ''),
            }))
          : [],
        verified: false,
        installed: false,
        discoveredAt: new Date(),
        reliabilityScore: Math.max(0, Math.min(100, Number(t.reliabilityScore ?? 50))),
      }));
    } catch {
      return [];
    }
  }
}
