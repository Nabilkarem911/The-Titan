import { getLogger } from '@titan/logging';
import type { MemoryLayer, MemoryEntry } from './types.js';
import { embeddingText, type EmbeddingProvider } from '../embeddings.js';

const log = getLogger().child({ component: 'semantic-memory' });

const MAX_ITEMS = 2000;

export class SemanticMemory implements MemoryLayer {
  name = 'semantic';
  private entries: Map<string, MemoryEntry> = new Map();

  constructor(private embedder?: EmbeddingProvider | null) {}

  async store(entry: MemoryEntry): Promise<void> {
    if (!entry.embedding && this.embedder) {
      try {
        const [embedding] = await this.embedder.embed([embeddingText(entry.content)]);
        entry.embedding = embedding;
      } catch {
        log.warn({ id: entry.id }, 'failed to embed — storing without vector');
      }
    }

    this.entries.set(entry.id, { ...entry, type: 'semantic' });

    if (this.entries.size > MAX_ITEMS) {
      this.evictLeastAccessed();
    }
  }

  async retrieve(query: string, limit = 5): Promise<MemoryEntry[]> {
    if (this.embedder && this.entries.size > 0) {
      try {
        const [queryEmbedding] = await this.embedder.embed([query]);
        if (queryEmbedding) {
          return this.vectorSearch(queryEmbedding, limit);
        }
      } catch {
        // fall through to keyword search
      }
    }

    return this.keywordSearch(query, limit);
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
  }

  async list(limit = 20): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .sort((a, b) => b.importance - a.importance)
      .slice(0, limit);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }

  private vectorSearch(queryEmbedding: number[], limit: number): MemoryEntry[] {
    const scored = Array.from(this.entries.values())
      .filter((e) => e.embedding && e.embedding.length > 0)
      .map((entry) => ({
        entry,
        score: cosineSimilarity(queryEmbedding, entry.embedding!),
      }))
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit).map((s) => {
      s.entry.accessCount++;
      s.entry.lastAccessed = new Date();
      return s.entry;
    });
  }

  private keywordSearch(query: string, limit: number): MemoryEntry[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

    return Array.from(this.entries.values())
      .map((entry) => {
        const contentWords = entry.content.toLowerCase().split(/\s+/);
        const overlap = contentWords.filter((w) => queryWords.has(w)).length;
        return { entry, score: overlap + entry.importance * 0.5 };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.entry);
  }

  private evictLeastAccessed(): void {
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => a[1].accessCount - b[1].accessCount);

    const toRemove = sorted.slice(0, sorted.length - MAX_ITEMS);
    for (const [id] of toRemove) {
      this.entries.delete(id);
    }
  }
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}
