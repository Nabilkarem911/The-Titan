import { getLogger } from '@titan/logging';
import { promptVariants as pvRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'prompt-optimizer' });

export interface PromptVariant {
  id: string;
  template: string;
  successRate: number;
  avgScore: number;
  usageCount: number;
}

export class PromptOptimizer {
  private variants: Map<string, PromptVariant[]> = new Map();

  registerVariant(category: string, template: string): string {
    const id = `${category}_${Date.now()}`;
    const variants = this.variants.get(category) ?? [];
    variants.push({ id, template, successRate: 0.5, avgScore: 50, usageCount: 0 });
    this.variants.set(category, variants);
    pvRepo.insert(id, { prompt_key: category, variant_text: template, success_rate: 0.5, avg_score: 50, total_uses: 0 }).catch((err) => log.error({ err }, 'DB write failed'));
    return id;
  }

  selectBest(category: string): PromptVariant | undefined {
    const variants = this.variants.get(category);
    if (!variants || variants.length === 0) return undefined;

    // Epsilon-greedy: 80% best, 20% explore
    if (Math.random() < 0.2 && variants.length > 1) {
      return variants[Math.floor(Math.random() * variants.length)];
    }

    return variants.sort((a, b) => b.avgScore * b.successRate - a.avgScore * a.successRate)[0];
  }

  recordResult(variantId: string, success: boolean, score: number): void {
    for (const variants of this.variants.values()) {
      const variant = variants.find((v) => v.id === variantId);
      if (variant) {
        variant.usageCount++;
        variant.successRate = (variant.successRate * (variant.usageCount - 1) + (success ? 1 : 0)) / variant.usageCount;
        variant.avgScore = (variant.avgScore * (variant.usageCount - 1) + score) / variant.usageCount;
        pvRepo.upsert(variantId, { prompt_key: '', variant_text: variant.template, success_rate: variant.successRate, avg_score: variant.avgScore, total_uses: variant.usageCount }, ['success_rate', 'avg_score', 'total_uses']).catch((err) => log.error({ err }, 'DB write failed'));
        return;
      }
    }
  }

  getStats(): Record<string, Array<{ id: string; successRate: number; avgScore: number; uses: number }>> {
    const stats: Record<string, Array<{ id: string; successRate: number; avgScore: number; uses: number }>> = {};
    for (const [category, variants] of this.variants) {
      stats[category] = variants.map((v) => ({
        id: v.id,
        successRate: Math.round(v.successRate * 100),
        avgScore: Math.round(v.avgScore),
        uses: v.usageCount,
      }));
    }
    return stats;
  }
}
