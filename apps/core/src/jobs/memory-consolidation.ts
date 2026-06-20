import { getLogger } from '@titan/logging';
import { createProviderFromEnv } from '@titan/agent-engine';
import { getGlobalMemoryClient } from '@titan/memory';
import { MemorySummarizer, MemoryMerger, MemoryForgetter, EntityExtractor, GraphStore } from '@titan/memory';
import type { LlmProvider } from '@titan/agent-engine';
import type { MemoryEntry } from '@titan/memory';

const log = getLogger().child({ component: 'memory-consolidation' });

const CONSOLIDATION_INTERVAL = 6 * 60 * 60 * 1000; // 6 hours
const COLLECTIONS = ['global'];

let consolidationTimer: NodeJS.Timeout | null = null;
let graphStore: GraphStore | null = null;
let entityExtractor: EntityExtractor | null = null;

export function getGraphStore(): GraphStore {
  if (!graphStore) graphStore = new GraphStore();
  return graphStore;
}

export function getEntityExtractor(): EntityExtractor {
  if (!entityExtractor) {
    const llm = createProviderFromEnv();
    entityExtractor = new EntityExtractor(llm ?? undefined);
  }
  return entityExtractor;
}

export interface ConsolidationResult {
  collection: string;
  totalEntries: number;
  summarized: number;
  merged: number;
  forgotten: number;
  entitiesExtracted: number;
  relationsExtracted: number;
  durationMs: number;
}

async function runConsolidationCycle(llm?: LlmProvider): Promise<ConsolidationResult[]> {
  const results: ConsolidationResult[] = [];
  const memory = await getGlobalMemoryClient();
  const merger = new MemoryMerger();
  const forgetter = new MemoryForgetter();
  const summarizer = llm ? new MemorySummarizer({ llm }) : null;
  const extractor = getEntityExtractor();
  const graph = getGraphStore();

  for (const collection of COLLECTIONS) {
    const start = Date.now();
    try {
      const searchResults = await memory.search(collection, '*', { limit: 200 });
      const entries: MemoryEntry[] = searchResults.map((r) => ({
        id: r.id,
        content: r.content,
        type: 'semantic',
        importance: 0.5,
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: (r.metadata?.timestamp as Date) ?? new Date(),
        metadata: r.metadata,
      }));

      if (entries.length === 0) {
        results.push({ collection, totalEntries: 0, summarized: 0, merged: 0, forgotten: 0, entitiesExtracted: 0, relationsExtracted: 0, durationMs: 0 });
        continue;
      }

      // 1. Apply decay to importance scores
      const decayed = forgetter.applyDecay(entries);

      // 2. Merge duplicates
      const deduped = merger.deduplicateAll(decayed);
      const mergedCount = decayed.length - deduped.length;

      // 3. Select for forgetting
      const toForget = forgetter.selectForForgetting(decayed);
      const forgetIds = toForget.map((e) => e.id);
      if (forgetIds.length > 0) {
        try {
          await memory.delete(collection, forgetIds);
        } catch {
          // deletion may not be supported by all providers
        }
      }

      // 4. Summarize old entries (if LLM available)
      let summarized = 0;
      if (summarizer && deduped.length > 10) {
        const oldEntries = deduped
          .filter((e) => Date.now() - e.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000)
          .slice(0, 20);
        if (oldEntries.length >= 3) {
          try {
            const summary = await summarizer.summarizeEntries(oldEntries);
            await memory.upsert(collection, [{
              id: summary.id,
              content: summary.content,
              metadata: { consolidated: true, ...summary.metadata },
              timestamp: new Date(),
            }]);
            summarized = oldEntries.length;
          } catch {
            // summarization is optional
          }
        }
      }

      // 5. Extract entities for knowledge graph
      let entitiesExtracted = 0;
      let relationsExtracted = 0;
      for (const entry of deduped.slice(0, 50)) {
        try {
          const extraction = await extractor.extract(entry.content);
          for (const entity of extraction.entities) {
            graph.addEntity(entity.name, entity.type);
            entitiesExtracted++;
          }
          for (const rel of extraction.relations) {
            graph.addRelation(rel.source, rel.target, rel.type);
            relationsExtracted++;
          }
        } catch {
          // entity extraction is optional
        }
      }

      const durationMs = Date.now() - start;
      log.info({ collection, entries: entries.length, merged: mergedCount, forgotten: forgetIds.length, summarized, entities: entitiesExtracted, relations: relationsExtracted, durationMs }, 'consolidation cycle complete');

      results.push({
        collection,
        totalEntries: entries.length,
        summarized,
        merged: mergedCount,
        forgotten: forgetIds.length,
        entitiesExtracted,
        relationsExtracted,
        durationMs,
      });
    } catch (err) {
      log.warn({ collection, err: err instanceof Error ? err.message : 'Unknown' }, 'consolidation cycle failed');
    }
  }

  return results;
}

export function startConsolidationDaemon(): void {
  if (consolidationTimer) {
    log.warn('consolidation daemon already running');
    return;
  }

  log.info({ intervalMs: CONSOLIDATION_INTERVAL }, 'starting memory consolidation daemon');

  // Run first cycle after 30 seconds
  setTimeout(async () => {
    try {
      const llm = createProviderFromEnv() ?? undefined;
      await runConsolidationCycle(llm ?? undefined);
    } catch (err) {
      log.warn({ err }, 'initial consolidation cycle failed');
    }
  }, 30_000);

  // Schedule recurring cycles
  consolidationTimer = setInterval(async () => {
    try {
      const llm = createProviderFromEnv() ?? undefined;
      await runConsolidationCycle(llm ?? undefined);
    } catch (err) {
      log.warn({ err }, 'consolidation cycle failed');
    }
  }, CONSOLIDATION_INTERVAL);
}

export function stopConsolidationDaemon(): void {
  if (consolidationTimer) {
    clearInterval(consolidationTimer);
    consolidationTimer = null;
    log.info('consolidation daemon stopped');
  }
}

export async function triggerConsolidationNow(): Promise<ConsolidationResult[]> {
  const llm = createProviderFromEnv() ?? undefined;
  return runConsolidationCycle(llm ?? undefined);
}
