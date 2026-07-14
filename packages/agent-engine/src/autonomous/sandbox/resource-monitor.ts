import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'resource-monitor' });

interface ResourceUsage {
  cpuPercent: number;
  memoryMb: number;
  memoryPercent: number;
  diskUsedGb: number;
  diskPercent: number;
  timestamp: Date;
}

interface ResourceLimits {
  maxMemoryMb: number;
  maxCpuPercent: number;
  maxDiskPercent: number;
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxMemoryMb: 4096,
  maxCpuPercent: 90,
  maxDiskPercent: 90,
};

class ResourceMonitor {
  private limits: ResourceLimits;
  private history: ResourceUsage[] = [];
  private maxHistory = 100;

  constructor(limits?: Partial<ResourceLimits>) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
  }

  check(): ResourceUsage {
    const usage: ResourceUsage = {
      cpuPercent: this.getCpuUsage(),
      memoryMb: this.getMemoryUsage(),
      memoryPercent: 0,
      diskUsedGb: 0,
      diskPercent: 0,
      timestamp: new Date(),
    };

    usage.memoryPercent = (usage.memoryMb / this.limits.maxMemoryMb) * 100;

    this.history.push(usage);
    if (this.history.length > this.maxHistory) this.history.shift();

    return usage;
  }

  isHealthy(): { healthy: boolean; warnings: string[] } {
    const usage = this.check();
    const warnings: string[] = [];

    if (usage.memoryMb > this.limits.maxMemoryMb * 0.8) {
      warnings.push(`Memory high: ${Math.round(usage.memoryMb)}MB / ${this.limits.maxMemoryMb}MB`);
    }
    if (usage.cpuPercent > this.limits.maxCpuPercent * 0.8) {
      warnings.push(`CPU high: ${Math.round(usage.cpuPercent)}%`);
    }

    return { healthy: warnings.length === 0, warnings };
  }

  canExecute(): boolean {
    const { healthy } = this.isHealthy();
    return healthy;
  }

  getHistory(): ResourceUsage[] {
    return [...this.history];
  }

  getAverageMemory(): number {
    if (this.history.length === 0) return 0;
    return this.history.reduce((s, u) => s + u.memoryMb, 0) / this.history.length;
  }

  private getCpuUsage(): number {
    try {
      const cpus = require('node:os').cpus();
      let totalIdle = 0;
      let totalTick = 0;
      for (const cpu of cpus) {
        for (const type of Object.values(cpu.times) as number[]) {
          totalTick += type;
        }
        totalIdle += cpu.times.idle;
      }
      return Math.round((1 - totalIdle / totalTick) * 100);
    } catch {
      return 0;
    }
  }

  private getMemoryUsage(): number {
    const used = process.memoryUsage();
    return Math.round(used.heapUsed / 1024 / 1024);
  }
}
