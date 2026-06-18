import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'experience-collector' });

export interface Experience {
  id: string;
  runId: string;
  prompt: string;
  strategy: string;
  toolsUsed: string[];
  success: boolean;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  tokensUsed: number;
  durationMs: number;
  errorType?: string;
  timestamp: Date;
}

export interface LearningInsight {
  type: 'strategy_preference' | 'tool_preference' | 'error_pattern' | 'performance';
  description: string;
  confidence: number;
  evidence: number;
  recommendation: string;
}

export class ExperienceCollector {
  private experiences: Experience[] = [];
  private maxExperiences = 5000;

  record(exp: Experience): void {
    this.experiences.push(exp);
    if (this.experiences.length > this.maxExperiences) {
      this.experiences = this.experiences.slice(-this.maxExperiences);
    }
  }

  getInsights(): LearningInsight[] {
    const insights: LearningInsight[] = [];

    // Strategy preferences
    const byStrategy = this.groupBy(this.experiences, (e) => e.strategy);
    for (const [strategy, exps] of byStrategy) {
      const successRate = exps.filter((e) => e.success).length / exps.length;
      if (exps.length >= 5) {
        insights.push({
          type: 'strategy_preference',
          description: `${strategy}: ${Math.round(successRate * 100)}% success rate (${exps.length} runs)`,
          confidence: Math.min(0.9, exps.length / 50),
          evidence: exps.length,
          recommendation: successRate > 0.7 ? `Keep using ${strategy}` : `Consider alternatives to ${strategy}`,
        });
      }
    }

    // Tool preferences
    const toolSuccess = new Map<string, { success: number; total: number }>();
    for (const exp of this.experiences) {
      for (const tool of exp.toolsUsed) {
        const stats = toolSuccess.get(tool) ?? { success: 0, total: 0 };
        stats.total++;
        if (exp.success) stats.success++;
        toolSuccess.set(tool, stats);
      }
    }
    for (const [tool, stats] of toolSuccess) {
      if (stats.total >= 3) {
        const rate = stats.success / stats.total;
        insights.push({
          type: 'tool_preference',
          description: `${tool}: ${Math.round(rate * 100)}% success (${stats.total} uses)`,
          confidence: Math.min(0.8, stats.total / 30),
          evidence: stats.total,
          recommendation: rate > 0.8 ? `${tool} is reliable` : `${tool} may need alternatives`,
        });
      }
    }

    // Error patterns
    const errorTypes = this.groupBy(
      this.experiences.filter((e) => !e.success && e.errorType),
      (e) => e.errorType!,
    );
    for (const [errorType, exps] of errorTypes) {
      if (exps.length >= 3) {
        insights.push({
          type: 'error_pattern',
          description: `Recurring error: ${errorType} (${exps.length} times)`,
          confidence: Math.min(0.8, exps.length / 10),
          evidence: exps.length,
          recommendation: `Investigate root cause of ${errorType}`,
        });
      }
    }

    // Performance trends
    const recentAvgDuration = this.averageDuration(this.experiences.slice(-50));
    const olderAvgDuration = this.averageDuration(this.experiences.slice(-100, -50));
    if (recentAvgDuration && olderAvgDuration) {
      const change = ((recentAvgDuration - olderAvgDuration) / olderAvgDuration) * 100;
      insights.push({
        type: 'performance',
        description: `Avg duration ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(change))}%`,
        confidence: 0.6,
        evidence: this.experiences.length,
        recommendation: change > 20 ? 'Performance degradation detected' : 'Performance is stable',
      });
    }

    return insights;
  }

  getSuccessRate(): number {
    if (this.experiences.length === 0) return 0;
    return this.experiences.filter((e) => e.success).length / this.experiences.length;
  }

  getStats(): { total: number; success: number; avgDuration: number; avgTokens: number } {
    const total = this.experiences.length;
    const success = this.experiences.filter((e) => e.success).length;
    return {
      total,
      success,
      avgDuration: this.averageDuration(this.experiences) ?? 0,
      avgTokens: total > 0 ? this.experiences.reduce((s, e) => s + e.tokensUsed, 0) / total : 0,
    };
  }

  clear(): void {
    this.experiences = [];
  }

  private groupBy<T>(items: T[], keyFn: (item: T) => string): Map<string, T[]> {
    const groups = new Map<string, T[]>();
    for (const item of items) {
      const key = keyFn(item);
      const group = groups.get(key) ?? [];
      group.push(item);
      groups.set(key, group);
    }
    return groups;
  }

  private averageDuration(exps: Experience[]): number | null {
    if (exps.length === 0) return null;
    return exps.reduce((s, e) => s + e.durationMs, 0) / exps.length;
  }
}
