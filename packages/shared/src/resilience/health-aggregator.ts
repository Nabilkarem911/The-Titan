import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'health-aggregator' });

export type ServiceHealth = 'healthy' | 'degraded' | 'unhealthy' | 'unknown';

export interface ServiceStatus {
  name: string;
  status: ServiceHealth;
  latencyMs?: number;
  lastCheck: Date;
  message?: string;
  critical: boolean;
}

export interface HealthReport {
  overall: ServiceHealth;
  services: ServiceStatus[];
  timestamp: Date;
  uptimeMs: number;
}

export type HealthCheckFn = () => Promise<{ status: ServiceHealth; latencyMs?: number; message?: string }>;

export class HealthAggregator {
  private checks: Map<string, { fn: HealthCheckFn; critical: boolean }> = new Map();
  private cache: Map<string, ServiceStatus> = new Map();
  private startTime = Date.now();

  registerCheck(name: string, fn: HealthCheckFn, critical = false): void {
    this.checks.set(name, { fn, critical });
  }

  unregisterCheck(name: string): void {
    this.checks.delete(name);
    this.cache.delete(name);
  }

  async check(): Promise<HealthReport> {
    const services: ServiceStatus[] = [];

    const promises = Array.from(this.checks.entries()).map(async ([name, { fn, critical }]) => {
      try {
        const start = performance.now();
        const result = await Promise.race([
          fn(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), 10000),
          ),
        ]);

        const status: ServiceStatus = {
          name,
          status: result.status,
          latencyMs: result.latencyMs ?? Math.round(performance.now() - start),
          lastCheck: new Date(),
          message: result.message,
          critical,
        };

        this.cache.set(name, status);
        return status;
      } catch (err) {
        const status: ServiceStatus = {
          name,
          status: 'unhealthy',
          lastCheck: new Date(),
          message: err instanceof Error ? err.message : 'Check failed',
          critical,
        };
        this.cache.set(name, status);
        return status;
      }
    });

    const results = await Promise.all(promises);
    services.push(...results);

    const overall = this.computeOverall(services);

    return {
      overall,
      services,
      timestamp: new Date(),
      uptimeMs: Date.now() - this.startTime,
    };
  }

  getCached(): HealthReport {
    const services = Array.from(this.cache.values());
    return {
      overall: this.computeOverall(services),
      services,
      timestamp: new Date(),
      uptimeMs: Date.now() - this.startTime,
    };
  }

  private computeOverall(services: ServiceStatus[]): ServiceHealth {
    const criticalUnhealthy = services.some((s) => s.critical && s.status === 'unhealthy');
    if (criticalUnhealthy) return 'unhealthy';

    const anyDegraded = services.some((s) => s.status === 'degraded');
    const anyUnhealthy = services.some((s) => s.status === 'unhealthy');
    if (anyUnhealthy || anyDegraded) return 'degraded';

    return 'healthy';
  }
}
