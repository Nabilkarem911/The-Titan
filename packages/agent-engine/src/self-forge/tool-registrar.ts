import { getLogger } from '@titan/logging';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { ForgedToolSpec } from './tool-forger.js';

const log = getLogger().child({ component: 'tool-registrar' });

export interface RegisteredTool {
  name: string;
  description: string;
  forgedAt: Date;
  sourceCode: string;
  usageCount: number;
  lastUsed: Date | null;
}

export class ToolRegistrar {
  private forgeDir: string;
  private forged: Map<string, RegisteredTool> = new Map();

  constructor() {
    this.forgeDir = join(process.cwd(), '.titan-forged');
    if (!existsSync(this.forgeDir)) {
      try { mkdirSync(this.forgeDir, { recursive: true }); } catch { /* ignore */ }
    }
  }

  async register(spec: ForgedToolSpec): Promise<RegisteredTool | null> {
    try {
      // Write source to disk for persistence
      const filePath = join(this.forgeDir, `${spec.name}.mjs`);
      writeFileSync(filePath, `${spec.sourceCode}\nexport { handler };\n`, 'utf-8');

      // Dynamic import to get the handler
      const fileUrl = `file://${filePath.replace(/\\/g, '/')}`;
      const mod = await import(fileUrl);

      if (typeof mod.handler !== 'function') {
        log.error({ toolName: spec.name }, 'forged module has no handler function');
        return null;
      }

      const handler = mod.handler as (params: unknown) => Promise<unknown>;

      // Register in the global tool registry
      const registry = getGlobalToolRegistry();
      registry.register({
        name: spec.name,
        description: spec.description,
        handler: async (params) => handler(params),
        schema: spec.schema,
        requiredParams: spec.requiredParams,
        tags: ['forged', 'auto-generated'],
      });

      const entry: RegisteredTool = {
        name: spec.name,
        description: spec.description,
        forgedAt: new Date(),
        sourceCode: spec.sourceCode,
        usageCount: 0,
        lastUsed: null,
      };

      this.forged.set(spec.name, entry);
      log.info({ toolName: spec.name }, 'forged tool registered and hot-loaded');

      return entry;
    } catch (err) {
      log.error({ err, toolName: spec.name }, 'failed to register forged tool');
      return null;
    }
  }

  listForged(): RegisteredTool[] {
    return Array.from(this.forged.values());
  }

  getForged(name: string): RegisteredTool | undefined {
    return this.forged.get(name);
  }

  recordUsage(name: string): void {
    const entry = this.forged.get(name);
    if (entry) {
      entry.usageCount++;
      entry.lastUsed = new Date();
    }
  }

  removeForged(name: string): boolean {
    const registry = getGlobalToolRegistry();
    const removed = registry.unregister(name);
    if (removed) {
      this.forged.delete(name);
      log.info({ toolName: name }, 'forged tool removed');
    }
    return removed;
  }
}
