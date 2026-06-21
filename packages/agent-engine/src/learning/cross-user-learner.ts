import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'cross-user-learner' });

export interface SharedPattern {
  id: string;
  pattern: string;
  category: 'task' | 'tool_preference' | 'communication_style' | 'workflow' | 'error_avoidance';
  frequency: number;
  successRate: number;
  aggregatedFrom: number;
  firstSeen: Date;
  lastSeen: Date;
  anonymized: true;
}

export interface CrossUserInsight {
  insight: string;
  confidence: number;
  basedOnUsers: number;
  basedOnRuns: number;
  category: SharedPattern['category'];
}

export class CrossUserLearner {
  private patterns = new Map<string, SharedPattern>();
  private userContributions = new Map<string, number>();
  private totalRuns = 0;
  private maxPatterns = 500;

  recordPattern(
    userId: string,
    pattern: string,
    category: SharedPattern['category'],
    success: boolean,
  ): void {
    const key = `${category}:${pattern}`;

    // Track user contributions (anonymized — only count, no content)
    this.userContributions.set(userId, (this.userContributions.get(userId) ?? 0) + 1);
    this.totalRuns++;

    const existing = this.patterns.get(key);
    if (existing) {
      existing.frequency++;
      existing.aggregatedFrom = this.userContributions.size;
      existing.lastSeen = new Date();
      // Update success rate with running average
      const totalAttempts = existing.frequency;
      const currentSuccessCount = Math.round(existing.successRate * (totalAttempts - 1));
      existing.successRate = (currentSuccessCount + (success ? 1 : 0)) / totalAttempts;
    } else {
      if (this.patterns.size >= this.maxPatterns) {
        // Evict least frequent pattern
        let minKey: string | null = null;
        let minFreq = Infinity;
        for (const [k, v] of this.patterns) {
          if (v.frequency < minFreq) {
            minFreq = v.frequency;
            minKey = k;
          }
        }
        if (minKey) this.patterns.delete(minKey);
      }

      this.patterns.set(key, {
        id: randomUUID().slice(0, 8),
        pattern,
        category,
        frequency: 1,
        successRate: success ? 1 : 0,
        aggregatedFrom: this.userContributions.size,
        firstSeen: new Date(),
        lastSeen: new Date(),
        anonymized: true,
      });
    }

    incCounter('cross_user_pattern', 'Cross-user patterns recorded', 1, { category });
  }

  getInsights(category?: SharedPattern['category'], minFrequency = 3): CrossUserInsight[] {
    const filtered = Array.from(this.patterns.values()).filter(
      (p) => p.frequency >= minFrequency && (!category || p.category === category),
    );

    return filtered
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 20)
      .map((p) => ({
        insight: p.pattern,
        confidence: Math.round(p.successRate * 100),
        basedOnUsers: p.aggregatedFrom,
        basedOnRuns: p.frequency,
        category: p.category,
      }));
  }

  getTopPatterns(category?: SharedPattern['category'], count = 10): SharedPattern[] {
    const filtered = Array.from(this.patterns.values()).filter(
      (p) => !category || p.category === category,
    );
    return filtered.sort((a, b) => b.frequency - a.frequency).slice(0, count);
  }

  getRecommendationsForUser(_userId: string, taskType?: string): string[] {
    const relevant = Array.from(this.patterns.values())
      .filter(
        (p) =>
          p.successRate > 0.7 &&
          p.frequency >= 5 &&
          (!taskType || p.pattern.includes(taskType)),
      )
      .sort((a, b) => b.successRate - a.successRate)
      .slice(0, 5);

    return relevant.map((p) => p.pattern);
  }

  stats(): {
    totalPatterns: number;
    totalUsers: number;
    totalRuns: number;
    avgSuccessRate: number;
    topCategory: string;
  } {
    const patterns = Array.from(this.patterns.values());
    const avgSuccess = patterns.length > 0
      ? Math.round((patterns.reduce((s, p) => s + p.successRate, 0) / patterns.length) * 100)
      : 0;

    const categoryCounts = new Map<string, number>();
    for (const p of patterns) {
      categoryCounts.set(p.category, (categoryCounts.get(p.category) ?? 0) + 1);
    }
    const topCategory = Array.from(categoryCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'none';

    return {
      totalPatterns: this.patterns.size,
      totalUsers: this.userContributions.size,
      totalRuns: this.totalRuns,
      avgSuccessRate: avgSuccess,
      topCategory,
    };
  }

  clear(): void {
    this.patterns.clear();
    this.userContributions.clear();
    this.totalRuns = 0;
  }
}

let globalLearner: CrossUserLearner | null = null;

export function getCrossUserLearner(): CrossUserLearner {
  if (!globalLearner) {
    globalLearner = new CrossUserLearner();
  }
  return globalLearner;
}
