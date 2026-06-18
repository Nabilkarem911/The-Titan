import { getLogger } from '@titan/logging';
import type { MemoryEntry } from '../layers/types.js';
import type { HybridSearchResult } from './hybrid-search.js';
import { HybridSearch } from './hybrid-search.js';
import { ContextRanker, type RankingContext } from './context-ranker.js';
import type { WorkingMemory } from '../layers/working-memory.js';
import type { EpisodicMemory } from '../layers/episodic-memory.js';
import type { SemanticMemory } from '../layers/semantic-memory.js';
import type { ProceduralMemory } from '../layers/procedural-memory.js';
import type { UserMemory } from '../layers/user-memory.js';

const log = getLogger().child({ component: 'memory-router' });

export interface MemoryLayers {
  working: WorkingMemory;
  episodic: EpisodicMemory;
  semantic: SemanticMemory;
  procedural: ProceduralMemory;
  user: UserMemory;
}

export class MemoryRouter {
  private hybridSearch: HybridSearch;
  private ranker: ContextRanker;
  private layers: MemoryLayers;

  constructor(layers: MemoryLayers) {
    this.layers = layers;
    this.hybridSearch = new HybridSearch([
      layers.working,
      layers.episodic,
      layers.semantic,
      layers.procedural,
      layers.user,
    ]);
    this.ranker = new ContextRanker();
  }

  async recall(query: string, context?: RankingContext, limit = 10): Promise<HybridSearchResult[]> {
    const results = await this.hybridSearch.search(query, limit * 2);

    if (context) {
      return this.ranker.rank(results, context).slice(0, limit);
    }

    return results.slice(0, limit);
  }

  async getContextForPrompt(prompt: string, limit = 8): Promise<string[]> {
    const context: RankingContext = {
      currentGoal: this.layers.working.getGoal(),
      recentTools: this.layers.working.getRecentToolResults().map((r) => r.tool),
    };

    const results = await this.recall(prompt, context, limit);
    const contextStrings: string[] = [];

    // User preferences first
    const userContext = this.layers.user.buildContextString();
    if (userContext) contextStrings.push(userContext);

    // Working memory context
    const workingContext = this.layers.working.getContextSummary();
    if (workingContext) contextStrings.push(workingContext);

    // Relevant procedures
    const procedures = this.layers.procedural.findApplicable(prompt, 2);
    for (const proc of procedures) {
      contextStrings.push(`Known procedure "${proc.name}": ${proc.steps.join(' → ')} (success: ${Math.round(proc.successRate * 100)}%)`);
    }

    // Similar past episodes
    const episodes = this.layers.episodic.findSimilarEpisodes(prompt, 2);
    for (const ep of episodes) {
      contextStrings.push(`Past ${ep.success ? 'success' : 'failure'}: "${ep.prompt.slice(0, 100)}" → ${ep.outcome.slice(0, 200)}`);
    }

    // General search results
    for (const r of results) {
      if (!contextStrings.includes(r.entry.content)) {
        contextStrings.push(r.entry.content);
      }
    }

    return contextStrings.slice(0, limit);
  }

  getLayer<K extends keyof MemoryLayers>(name: K): MemoryLayers[K] {
    return this.layers[name];
  }

  async stats(): Promise<Record<string, number>> {
    return {
      working: this.layers.working.size(),
      episodic: this.layers.episodic.size(),
      semantic: this.layers.semantic.size(),
      procedural: this.layers.procedural.size(),
      user: this.layers.user.size(),
    };
  }

  clearAll(): void {
    this.layers.working.clear();
    this.layers.episodic.clear();
    this.layers.semantic.clear();
    this.layers.procedural.clear();
    this.layers.user.clear();
    log.info('all memory layers cleared');
  }
}
