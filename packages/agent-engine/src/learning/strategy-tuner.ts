import { getLogger } from '@titan/logging';
import { strategyTunerRecords as stRepo } from '@titan/database';
import { randomUUID } from 'node:crypto';
import type { StrategyName } from '../strategies/types.js';

const log = getLogger().child({ component: 'strategy-tuner' });

export interface StrategyPerformance {
  strategy: StrategyName;
  taskType: string;
  successRate: number;
  avgDuration: number;
  avgTokens: number;
  sampleSize: number;
}

export class StrategyTuner {
  private records: Array<{ strategy: StrategyName; taskType: string; success: boolean; durationMs: number; tokensUsed: number }> = [];

  record(strategy: StrategyName, taskType: string, success: boolean, durationMs: number, tokensUsed: number): void {
    this.records.push({ strategy, taskType, success, durationMs, tokensUsed });
    if (this.records.length > 5000) this.records = this.records.slice(-5000);
    stRepo.insert(randomUUID().slice(0, 12), { task_type: taskType, strategy, success, duration_ms: durationMs }).catch(() => {});
  }

  recommend(taskType: string): StrategyName {
    const relevant = this.records.filter((r) => r.taskType === taskType);
    if (relevant.length < 5) return 'chain-of-thought';

    const byStrategy = new Map<StrategyName, { success: number; total: number }>();
    for (const r of relevant) {
      const stats = byStrategy.get(r.strategy) ?? { success: 0, total: 0 };
      stats.total++;
      if (r.success) stats.success++;
      byStrategy.set(r.strategy, stats);
    }

    let best: StrategyName = 'chain-of-thought';
    let bestRate = 0;
    for (const [strategy, stats] of byStrategy) {
      const rate = stats.total > 0 ? stats.success / stats.total : 0;
      if (rate > bestRate || (rate === bestRate && stats.total > (byStrategy.get(best)?.total ?? 0))) {
        best = strategy;
        bestRate = rate;
      }
    }

    return best;
  }

  getPerformance(): StrategyPerformance[] {
    const grouped = new Map<string, Array<{ success: boolean; durationMs: number; tokensUsed: number }>>();

    for (const r of this.records) {
      const key = `${r.strategy}:${r.taskType}`;
      const list = grouped.get(key) ?? [];
      list.push(r);
      grouped.set(key, list);
    }

    return Array.from(grouped.entries()).map(([key, records]) => {
      const [strategy, taskType] = key.split(':');
      return {
        strategy: strategy as StrategyName,
        taskType,
        successRate: records.filter((r) => r.success).length / records.length,
        avgDuration: records.reduce((s, r) => s + r.durationMs, 0) / records.length,
        avgTokens: records.reduce((s, r) => s + r.tokensUsed, 0) / records.length,
        sampleSize: records.length,
      };
    });
  }
}
