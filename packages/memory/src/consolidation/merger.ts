import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { MemoryEntry } from '../layers/types.js';

const log = getLogger().child({ component: 'memory-merger' });

const SIMILARITY_THRESHOLD = 0.6;

export class MemoryMerger {
  findDuplicates(entries: MemoryEntry[]): Array<[MemoryEntry, MemoryEntry]> {
    const pairs: Array<[MemoryEntry, MemoryEntry]> = [];

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const sim = this.textSimilarity(entries[i].content, entries[j].content);
        if (sim >= SIMILARITY_THRESHOLD) {
          pairs.push([entries[i], entries[j]]);
        }
      }
    }

    return pairs;
  }

  merge(a: MemoryEntry, b: MemoryEntry): MemoryEntry {
    const primary = a.importance >= b.importance ? a : b;
    const secondary = primary === a ? b : a;

    const merged: MemoryEntry = {
      id: randomUUID(),
      content: this.mergeContent(primary.content, secondary.content),
      type: primary.type,
      importance: Math.max(a.importance, b.importance),
      accessCount: a.accessCount + b.accessCount,
      lastAccessed: new Date(Math.max(a.lastAccessed.getTime(), b.lastAccessed.getTime())),
      createdAt: new Date(Math.min(a.createdAt.getTime(), b.createdAt.getTime())),
      metadata: {
        ...a.metadata,
        ...b.metadata,
        mergedFrom: [a.id, b.id],
      },
      embedding: primary.embedding,
    };

    log.debug({ mergedId: merged.id, from: [a.id, b.id] }, 'entries merged');
    return merged;
  }

  deduplicateAll(entries: MemoryEntry[]): MemoryEntry[] {
    const result = [...entries];
    const toRemove = new Set<string>();

    const duplicates = this.findDuplicates(result);
    for (const [a, b] of duplicates) {
      if (toRemove.has(a.id) || toRemove.has(b.id)) continue;

      const merged = this.merge(a, b);
      toRemove.add(a.id);
      toRemove.add(b.id);
      result.push(merged);
    }

    return result.filter((e) => !toRemove.has(e.id));
  }

  private mergeContent(primary: string, secondary: string): string {
    if (primary.length >= secondary.length * 0.8) {
      return primary;
    }

    const secondaryWords = secondary.split(/\s+/);
    const primaryWords = new Set(primary.toLowerCase().split(/\s+/));
    const newWords = secondaryWords.filter((w) => !primaryWords.has(w.toLowerCase()));

    if (newWords.length === 0) return primary;

    return `${primary} (also: ${newWords.join(' ').slice(0, 200)})`;
  }

  private textSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));

    if (wordsA.size === 0 || wordsB.size === 0) return 0;

    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;

    return intersection / union;
  }
}
