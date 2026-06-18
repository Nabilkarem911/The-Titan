import { getLogger } from '@titan/logging';
import type { MemoryEntry } from '../layers/types.js';

const log = getLogger().child({ component: 'memory-forgetter' });

export interface ForgetPolicy {
  maxAge?: number;
  minImportance?: number;
  maxEntries?: number;
  decayRate?: number;
}

const DEFAULT_POLICY: Required<ForgetPolicy> = {
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  minImportance: 0.1,
  maxEntries: 1000,
  decayRate: 0.95,
};

export class MemoryForgetter {
  private policy: Required<ForgetPolicy>;

  constructor(policy?: ForgetPolicy) {
    this.policy = { ...DEFAULT_POLICY, ...policy };
  }

  selectForForgetting(entries: MemoryEntry[]): MemoryEntry[] {
    const now = Date.now();
    const toForget: MemoryEntry[] = [];

    for (const entry of entries) {
      const age = now - entry.createdAt.getTime();

      if (age > this.policy.maxAge && entry.importance < 0.5) {
        toForget.push(entry);
        continue;
      }

      if (entry.importance < this.policy.minImportance && entry.accessCount === 0) {
        toForget.push(entry);
        continue;
      }
    }

    if (entries.length - toForget.length > this.policy.maxEntries) {
      const retained = entries.filter((e) => !toForget.includes(e));
      const sorted = retained.sort((a, b) => this.computeRetentionScore(a) - this.computeRetentionScore(b));
      const excess = sorted.slice(0, retained.length - this.policy.maxEntries);
      toForget.push(...excess);
    }

    log.info({ total: entries.length, forgetting: toForget.length }, 'forgetting analysis');
    return toForget;
  }

  applyDecay(entries: MemoryEntry[]): MemoryEntry[] {
    const now = Date.now();

    return entries.map((entry) => {
      const hoursSinceAccess = (now - entry.lastAccessed.getTime()) / 3600000;
      const decayFactor = Math.pow(this.policy.decayRate, hoursSinceAccess / 24);
      const accessBonus = Math.min(0.3, entry.accessCount * 0.05);
      const newImportance = Math.max(0, entry.importance * decayFactor + accessBonus);

      return { ...entry, importance: newImportance };
    });
  }

  private computeRetentionScore(entry: MemoryEntry): number {
    const recency = 1 / (1 + (Date.now() - entry.lastAccessed.getTime()) / 86400000);
    const frequency = Math.log2(1 + entry.accessCount);
    return entry.importance * 0.4 + recency * 0.3 + frequency * 0.3;
  }
}
