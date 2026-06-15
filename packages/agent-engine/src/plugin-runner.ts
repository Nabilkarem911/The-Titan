import { getLogger } from '@titan/logging';
import { createHash } from 'node:crypto';
import { Script, createContext } from 'node:vm';

const log = getLogger().child({ component: 'plugin-runner' });

export interface PluginToolMeta {
  name: string;
  description: string;
  tags?: string[];
  schema?: Record<string, { type: string; description?: string; enum?: string[] }>;
  requiredParams?: string[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  tools: PluginToolMeta[];
  /** JS source code — each tool must export a function matching tool name */
  code?: string;
  /** URL to fetch code from */
  codeUrl?: string;
  /** Expected SHA256 checksum of code */
  checksum?: string;
}

export interface LoadedPlugin {
  manifest: PluginManifest;
  handlers: Map<string, (params: unknown) => Promise<unknown>>;
  loadedAt: Date;
  codeChecksum?: string;
}

/** Safe sandbox — only expose non-dangerous globals */
function createSandbox(): Record<string, unknown> {
  return {
    console: {
      log: (...args: unknown[]) => log.info({ plugin: 'sandbox' }, String(args.join(' '))),
      error: (...args: unknown[]) => log.error({ plugin: 'sandbox' }, String(args.join(' '))),
      warn: (...args: unknown[]) => log.warn({ plugin: 'sandbox' }, String(args.join(' '))),
    },
    JSON, Math, Date, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI,
    setTimeout, clearTimeout, Promise, Array, Object, String, Number, Boolean, Error,
    fetch: globalThis.fetch,
    module: { exports: {} as Record<string, unknown> },
    exports: {} as Record<string, unknown>,
    require: (mod: string) => {
      // Allow only safe built-ins
      const allowed = ['node:crypto', 'node:path', 'node:url'];
      if (!allowed.includes(mod)) throw new Error(`require("${mod}") is not allowed in plugins`);
      return require(mod);
    },
  };
}

export class PluginRunner {
  private activePlugins = new Map<string, LoadedPlugin>();

  async load(manifest: PluginManifest): Promise<void> {
    if (this.activePlugins.has(manifest.name)) {
      log.warn({ plugin: manifest.name }, 'plugin already loaded; reloading');
      this.unload(manifest.name);
    }

    const handlers = new Map<string, (params: unknown) => Promise<unknown>>();
    let codeChecksum: string | undefined;

    // Load code if provided
    let code = manifest.code;
    if (!code && manifest.codeUrl) {
      log.info({ plugin: manifest.name, url: manifest.codeUrl }, 'fetching plugin code');
      const res = await fetch(manifest.codeUrl);
      if (!res.ok) throw new Error(`Failed to fetch plugin code from ${manifest.codeUrl}: ${res.status}`);
      code = await res.text();
    }

    if (code) {
      // Verify checksum if provided
      codeChecksum = createHash('sha256').update(code).digest('hex');
      if (manifest.checksum && manifest.checksum !== codeChecksum) {
        throw new Error(`Plugin "${manifest.name}" checksum mismatch — possible tampering detected`);
      }

      // Execute in sandbox
      const sandbox = createSandbox();
      (sandbox as Record<string, unknown>)['exports'] = {};
      (sandbox as Record<string, unknown>)['module'] = { exports: sandbox['exports'] };
      createContext(sandbox);

      try {
        const script = new Script(`(function(module, exports, require, console, fetch) { ${code} })(module, exports, require, console, fetch)`);
        script.runInContext(sandbox, { timeout: 5000 });
      } catch (err) {
        throw new Error(`Plugin "${manifest.name}" code execution failed: ${(err as Error).message}`);
      }

      const moduleExports = (sandbox['module'] as Record<string, unknown>)['exports'] as Record<string, unknown>;

      // Register handlers for each declared tool
      for (const tool of manifest.tools) {
        const fn = moduleExports[tool.name];
        if (typeof fn === 'function') {
          handlers.set(tool.name, fn as (params: unknown) => Promise<unknown>);
          log.info({ plugin: manifest.name, tool: tool.name }, 'plugin tool handler loaded');
        } else {
          // Placeholder handler
          handlers.set(tool.name, async () => ({
            note: `Plugin tool "${tool.name}" from "${manifest.name}" — no handler exported`,
          }));
          log.warn({ plugin: manifest.name, tool: tool.name }, 'no handler found for tool, using placeholder');
        }
      }
    } else {
      // No code — use placeholder handlers
      for (const tool of manifest.tools) {
        handlers.set(tool.name, async () => ({ note: `Plugin tool "${tool.name}" from "${manifest.name}"` }));
      }
    }

    this.activePlugins.set(manifest.name, {
      manifest,
      handlers,
      loadedAt: new Date(),
      codeChecksum,
    });

    log.info({ plugin: manifest.name, version: manifest.version, tools: manifest.tools.length }, 'plugin loaded');
  }

  async executeTool(pluginName: string, toolName: string, params: unknown): Promise<unknown> {
    const plugin = this.activePlugins.get(pluginName);
    if (!plugin) throw new Error(`Plugin "${pluginName}" is not loaded`);
    const handler = plugin.handlers.get(toolName);
    if (!handler) throw new Error(`Tool "${toolName}" not found in plugin "${pluginName}"`);
    return handler(params);
  }

  unload(pluginName: string): boolean {
    const removed = this.activePlugins.delete(pluginName);
    if (removed) log.info({ plugin: pluginName }, 'plugin unloaded');
    return removed;
  }

  isLoaded(pluginName: string): boolean {
    return this.activePlugins.has(pluginName);
  }

  getLoaded(): Array<{ name: string; version: string; toolCount: number; loadedAt: string }> {
    return Array.from(this.activePlugins.values()).map((p) => ({
      name: p.manifest.name,
      version: p.manifest.version,
      toolCount: p.manifest.tools.length,
      loadedAt: p.loadedAt.toISOString(),
    }));
  }

  getTools(pluginName: string): PluginToolMeta[] {
    const plugin = this.activePlugins.get(pluginName);
    return plugin ? plugin.manifest.tools : [];
  }

  getAllTools(): Array<PluginToolMeta & { plugin: string }> {
    const out: Array<PluginToolMeta & { plugin: string }> = [];
    for (const [name, plugin] of this.activePlugins) {
      for (const tool of plugin.manifest.tools) {
        out.push({ ...tool, plugin: name });
      }
    }
    return out;
  }
}

let globalRunner: PluginRunner | null = null;

export function getGlobalPluginRunner(): PluginRunner {
  if (!globalRunner) globalRunner = new PluginRunner();
  return globalRunner;
}

export function resetGlobalPluginRunner(): void {
  globalRunner = null;
}
