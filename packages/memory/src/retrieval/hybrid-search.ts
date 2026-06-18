import { getLogger } from '@titan/logging';
import type { MemoryEntry, MemoryLayer } from '../layers/types.js';

const log = getLogger().child({ component: 'hybrid-search' });

export interface HybridSearchResult {
  entry: MemoryEntry;
  score: number;
  source: string;
}

export class HybridSearch {
  private layers: MemoryLayer[];

  constructor(layers: MemoryLayer[]) {
    this.layers = layers;
  }

  async search(query: string, limit = 10): Promise<HybridSearchResult[]> {
    const allResults: HybridSearchResult[] = [];

    const promises = this.layers.map(async (layer) => {
      try {
        const entries = await layer.retrieve(query, limit);
        return entries.map((entry) => ({
          entry,
          score: entry.importance,
          source: layer.name,
        }));
      } catch (err) {
        log.warn({ layer: layer.name, err: err instanceof Error ? err.message : 'Unknown' }, 'layer search failed');
        return [];
      }
    });

    const results = await Promise.all(promises);
    for (const layerResults of results) {
      allResults.push(...layerResults);
    }

    // Deduplicate by content similarity
    const deduplicated = this.deduplicateResults(allResults);

    // Score and rank
    return deduplicated
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async searchLayer(layerName: string, query: string, limit = 5): Promise<HybridSearchResult[]> {
    const layer = this.layers.find((l) => l.name === layerName);
    if (!layer) return [];

    const entries = await layer.retrieve(query, limit);
    return entries.map((entry) => ({
      entry,
      score: entry.importance,
      source: layer.name,
    }));
  }

  private deduplicateResults(results: HybridSearchResult[]): HybridSearchResult[] {
    const seen = new Set<string>();
    const unique: HybridSearchResult[] = [];

    for (const result of results) {
      const key = result.entry.id;
      if (seen.has(key)) {
        // Boost score for entries found in multiple layers
        const existing = unique.find((r) => r.entry.id === key);
        if (existing) existing.score += 0.2;
        continue;
      }
      seen.add(key);
      unique.push(result);
    }

    return unique;
  }
}
