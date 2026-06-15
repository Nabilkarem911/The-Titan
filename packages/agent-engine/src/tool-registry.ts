import { getLogger } from '@titan/logging';
import type { ToolResult } from './types.js';

const log = getLogger().child({ component: 'tool-registry' });

export interface ToolHandler {
  (params: unknown): Promise<unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  handler: ToolHandler;
  tags?: string[];
  schema?: Record<string, { type: string; description?: string; enum?: string[] }>;
  requiredParams?: string[];
}

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(def: ToolDefinition): void {
    if (this.tools.has(def.name)) {
      log.warn({ tool: def.name }, 'tool already registered; overwriting');
    }
    this.tools.set(def.name, def);
    log.info({ tool: def.name, tags: def.tags }, 'tool registered');
  }

  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) log.info({ tool: name }, 'tool unregistered');
    return removed;
  }

  async execute(name: string, params: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }

    const start = performance.now();
    try {
      const data = await tool.handler(params);
      const latencyMs = Math.round(performance.now() - start);
      log.info({ tool: name, latencyMs }, 'tool executed');
      return { success: true, data, latencyMs };
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const error = err instanceof Error ? err.message : String(err);
      log.error({ tool: name, error, latencyMs }, 'tool execution failed');
      return { success: false, error, latencyMs };
    }
  }

  list(): Array<{ name: string; description: string; tags?: string[]; schema?: Record<string, { type: string; description?: string; enum?: string[] }>; requiredParams?: string[] }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      tags: t.tags,
      schema: t.schema,
      requiredParams: t.requiredParams,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }
}

/** Global singleton for the process. */
let globalRegistry: ToolRegistry | null = null;

export function getGlobalToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function resetGlobalToolRegistry(): void {
  globalRegistry = null;
}
