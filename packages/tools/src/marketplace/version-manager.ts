export interface VersionInfo {
  current: string;
  available: string[];
  latest: string;
  hasUpdate: boolean;
}

export class VersionManager {
  private versions: Map<string, string[]> = new Map();

  registerVersion(pluginId: string, version: string): void {
    const list = this.versions.get(pluginId) ?? [];
    if (!list.includes(version)) {
      list.push(version);
      list.sort(this.compareSemver);
      this.versions.set(pluginId, list);
    }
  }

  getInfo(pluginId: string, currentVersion: string): VersionInfo {
    const available = this.versions.get(pluginId) ?? [];
    const latest = available[available.length - 1] ?? currentVersion;

    return {
      current: currentVersion,
      available,
      latest,
      hasUpdate: this.compareSemver(currentVersion, latest) < 0,
    };
  }

  isCompatible(required: string, installed: string): boolean {
    const [reqMajor] = required.split('.').map(Number);
    const [instMajor] = installed.split('.').map(Number);
    return reqMajor === instMajor;
  }

  private compareSemver(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) - (pb[i] ?? 0);
    }
    return 0;
  }
}
