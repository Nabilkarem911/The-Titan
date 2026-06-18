import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'plugin-store' });

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: 'tool' | 'agent' | 'integration' | 'theme';
  tags: string[];
  entryPoint: string;
  permissions: string[];
  rating: number;
  downloads: number;
  verified: boolean;
  publishedAt: Date;
  updatedAt: Date;
}

export interface InstalledPlugin {
  manifest: PluginManifest;
  installedAt: Date;
  enabled: boolean;
  config: Record<string, unknown>;
}

export class PluginStore {
  private available: Map<string, PluginManifest> = new Map();
  private installed: Map<string, InstalledPlugin> = new Map();

  register(manifest: PluginManifest): void {
    this.available.set(manifest.id, manifest);
    log.info({ plugin: manifest.name, version: manifest.version }, 'plugin registered');
  }

  search(query: string, category?: string): PluginManifest[] {
    const lower = query.toLowerCase();
    return Array.from(this.available.values())
      .filter((p) => {
        if (category && p.category !== category) return false;
        return p.name.toLowerCase().includes(lower) ||
          p.description.toLowerCase().includes(lower) ||
          p.tags.some((t) => t.toLowerCase().includes(lower));
      })
      .sort((a, b) => b.downloads - a.downloads);
  }

  install(pluginId: string, config: Record<string, unknown> = {}): InstalledPlugin | null {
    const manifest = this.available.get(pluginId);
    if (!manifest) return null;

    const installed: InstalledPlugin = {
      manifest,
      installedAt: new Date(),
      enabled: true,
      config,
    };

    this.installed.set(pluginId, installed);
    log.info({ plugin: manifest.name }, 'plugin installed');
    return installed;
  }

  uninstall(pluginId: string): boolean {
    return this.installed.delete(pluginId);
  }

  enable(pluginId: string): void {
    const plugin = this.installed.get(pluginId);
    if (plugin) plugin.enabled = true;
  }

  disable(pluginId: string): void {
    const plugin = this.installed.get(pluginId);
    if (plugin) plugin.enabled = false;
  }

  getInstalled(): InstalledPlugin[] {
    return Array.from(this.installed.values());
  }

  getEnabled(): InstalledPlugin[] {
    return this.getInstalled().filter((p) => p.enabled);
  }

  isInstalled(pluginId: string): boolean {
    return this.installed.has(pluginId);
  }

  listCategories(): string[] {
    const cats = new Set(Array.from(this.available.values()).map((p) => p.category));
    return Array.from(cats);
  }

  getTopRated(limit = 10): PluginManifest[] {
    return Array.from(this.available.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, limit);
  }

  stats(): { available: number; installed: number; enabled: number } {
    return {
      available: this.available.size,
      installed: this.installed.size,
      enabled: this.getEnabled().length,
    };
  }
}
