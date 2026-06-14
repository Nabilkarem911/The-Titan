import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'plugin-runner' });

export interface PluginToolMeta {
  name: string;
  description: string;
  tags?: string[];
}

export interface PluginManifest {
  name: string;
  version: string;
  description?: string;
  tools: PluginToolMeta[];
}

export class PluginRunner {
  private activePlugins = new Map<string, PluginManifest>();

  async load(manifest: PluginManifest): Promise<void> {
    if (this.activePlugins.has(manifest.name)) {
      log.warn({ plugin: manifest.name }, 'plugin already loaded; reloading');
      this.unload(manifest.name);
    }

    this.activePlugins.set(manifest.name, manifest);
    log.info({ plugin: manifest.name, version: manifest.version, tools: manifest.tools.length }, 'plugin loaded');
  }

  unload(pluginName: string): boolean {
    const removed = this.activePlugins.delete(pluginName);
    if (removed) log.info({ plugin: pluginName }, 'plugin unloaded');
    return removed;
  }

  isLoaded(pluginName: string): boolean {
    return this.activePlugins.has(pluginName);
  }

  getLoaded(): string[] {
    return Array.from(this.activePlugins.keys());
  }

  getTools(pluginName: string): PluginToolMeta[] {
    const manifest = this.activePlugins.get(pluginName);
    return manifest ? manifest.tools : [];
  }

  getAllTools(): Array<PluginToolMeta & { plugin: string }> {
    const out: Array<PluginToolMeta & { plugin: string }> = [];
    for (const [plugin, manifest] of this.activePlugins) {
      for (const tool of manifest.tools) {
        out.push({ ...tool, plugin });
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
