import { getLogger } from '@titan/logging';
import type { HybridSearchResult } from './hybrid-search.js';

const log = getLogger().child({ component: 'context-ranker' });

export interface RankingContext {
  currentGoal?: string;
  recentTools?: string[];
  conversationTopic?: string;
  userId?: string;
}

export class ContextRanker {
  rank(results: HybridSearchResult[], context: RankingContext): HybridSearchResult[] {
    return results
      .map((result) => ({
        ...result,
        score: this.computeScore(result, context),
      }))
      .sort((a, b) => b.score - a.score);
  }

  private computeScore(result: HybridSearchResult, context: RankingContext): number {
    let score = result.score;

    // Recency boost
    const hoursSinceAccess = (Date.now() - result.entry.lastAccessed.getTime()) / 3600000;
    const recencyBoost = Math.max(0, 0.3 * (1 - hoursSinceAccess / 168)); // 7 day window
    score += recencyBoost;

    // Goal relevance
    if (context.currentGoal) {
      const goalWords = new Set(context.currentGoal.toLowerCase().split(/\s+/));
      const entryWords = result.entry.content.toLowerCase().split(/\s+/);
      const overlap = entryWords.filter((w) => goalWords.has(w)).length;
      score += overlap * 0.15;
    }

    // Topic relevance
    if (context.conversationTopic) {
      const topicWords = new Set(context.conversationTopic.toLowerCase().split(/\s+/));
      const entryWords = result.entry.content.toLowerCase().split(/\s+/);
      const overlap = entryWords.filter((w) => topicWords.has(w)).length;
      score += overlap * 0.1;
    }

    // Tool relevance
    if (context.recentTools && result.entry.metadata?.toolsUsed) {
      const toolsUsed = result.entry.metadata.toolsUsed as string[];
      const overlap = toolsUsed.filter((t) => context.recentTools!.includes(t)).length;
      score += overlap * 0.2;
    }

    // Frequency boost (well-accessed entries are more useful)
    score += Math.log2(1 + result.entry.accessCount) * 0.05;

    // Layer-specific weights
    const layerWeights: Record<string, number> = {
      working: 1.5,
      episodic: 1.0,
      procedural: 1.2,
      semantic: 0.8,
      user: 1.3,
    };
    score *= layerWeights[result.source] ?? 1.0;

    return score;
  }
}
