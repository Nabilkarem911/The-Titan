import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'usage-quotas' });

export interface QuotaConfig {
  maxTokensPerDay: number;
  maxRunsPerDay: number;
  maxStorageMb: number;
  maxConcurrentRuns: number;
}

export interface QuotaUsage {
  tokensToday: number;
  runsToday: number;
  storageMb: number;
  concurrentRuns: number;
}

const DEFAULT_QUOTAS: Record<string, QuotaConfig> = {
  free: { maxTokensPerDay: 50000, maxRunsPerDay: 20, maxStorageMb: 100, maxConcurrentRuns: 2 },
  pro: { maxTokensPerDay: 500000, maxRunsPerDay: 200, maxStorageMb: 5000, maxConcurrentRuns: 10 },
  enterprise: { maxTokensPerDay: 5000000, maxRunsPerDay: 2000, maxStorageMb: 50000, maxConcurrentRuns: 50 },
};

export class UsageQuotaManager {
  private usage: Map<string, QuotaUsage> = new Map();
  private plans: Map<string, string> = new Map();

  setPlan(entityId: string, plan: string): void {
    this.plans.set(entityId, plan);
  }

  getQuota(entityId: string): QuotaConfig {
    const plan = this.plans.get(entityId) ?? 'free';
    return DEFAULT_QUOTAS[plan] ?? DEFAULT_QUOTAS['free'];
  }

  getUsage(entityId: string): QuotaUsage {
    return this.usage.get(entityId) ?? { tokensToday: 0, runsToday: 0, storageMb: 0, concurrentRuns: 0 };
  }

  recordTokens(entityId: string, tokens: number): { allowed: boolean; remaining: number } {
    const quota = this.getQuota(entityId);
    const usage = this.getOrCreateUsage(entityId);
    usage.tokensToday += tokens;

    const remaining = quota.maxTokensPerDay - usage.tokensToday;
    return { allowed: remaining >= 0, remaining: Math.max(0, remaining) };
  }

  recordRun(entityId: string): { allowed: boolean; remaining: number } {
    const quota = this.getQuota(entityId);
    const usage = this.getOrCreateUsage(entityId);
    usage.runsToday++;

    const remaining = quota.maxRunsPerDay - usage.runsToday;
    return { allowed: remaining >= 0, remaining: Math.max(0, remaining) };
  }

  canRun(entityId: string): { allowed: boolean; reason?: string } {
    const quota = this.getQuota(entityId);
    const usage = this.getUsage(entityId);

    if (usage.tokensToday >= quota.maxTokensPerDay) return { allowed: false, reason: 'Daily token limit reached' };
    if (usage.runsToday >= quota.maxRunsPerDay) return { allowed: false, reason: 'Daily run limit reached' };
    if (usage.concurrentRuns >= quota.maxConcurrentRuns) return { allowed: false, reason: 'Max concurrent runs reached' };

    return { allowed: true };
  }

  resetDaily(): void {
    for (const usage of this.usage.values()) {
      usage.tokensToday = 0;
      usage.runsToday = 0;
    }
    log.info('daily quotas reset');
  }

  private getOrCreateUsage(entityId: string): QuotaUsage {
    let usage = this.usage.get(entityId);
    if (!usage) {
      usage = { tokensToday: 0, runsToday: 0, storageMb: 0, concurrentRuns: 0 };
      this.usage.set(entityId, usage);
    }
    return usage;
  }
}
