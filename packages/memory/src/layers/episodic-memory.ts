import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { MemoryLayer, MemoryEntry, Episode } from './types.js';

const log = getLogger().child({ component: 'episodic-memory' });

const MAX_EPISODES = 500;

export class EpisodicMemory implements MemoryLayer {
  name = 'episodic';
  private entries: Map<string, MemoryEntry> = new Map();
  private episodes: Map<string, Episode> = new Map();

  async store(entry: MemoryEntry): Promise<void> {
    this.entries.set(entry.id, { ...entry, type: 'episodic' });

    if (this.entries.size > MAX_EPISODES) {
      this.evictOldest();
    }
  }

  recordEpisode(episode: Omit<Episode, 'id'>): Episode {
    const full: Episode = { id: randomUUID(), ...episode };
    this.episodes.set(full.id, full);

    const entry: MemoryEntry = {
      id: full.id,
      content: `[${full.success ? 'SUCCESS' : 'FAIL'}] ${full.prompt} → ${full.outcome.slice(0, 500)}`,
      type: 'episodic',
      importance: full.success ? 0.6 : 0.8,
      accessCount: 0,
      lastAccessed: new Date(),
      createdAt: full.timestamp,
      metadata: {
        sessionId: full.sessionId,
        toolsUsed: full.toolsUsed,
        stepsCount: full.stepsCount,
        tokensUsed: full.tokensUsed,
        duration: full.duration,
        success: full.success,
      },
    };
    this.entries.set(entry.id, entry);

    log.debug({ episodeId: full.id, success: full.success }, 'episode recorded');
    return full;
  }

  findSimilarEpisodes(prompt: string, limit = 5): Episode[] {
    const queryWords = new Set(prompt.toLowerCase().split(/\s+/));

    return Array.from(this.episodes.values())
      .map((ep) => {
        const epWords = new Set(ep.prompt.toLowerCase().split(/\s+/));
        const overlap = [...queryWords].filter((w) => epWords.has(w)).length;
        const score = overlap / Math.max(queryWords.size, 1);
        return { ep, score };
      })
      .filter((r) => r.score > 0.1)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((r) => r.ep);
  }

  getSuccessfulEpisodes(toolName?: string, limit = 10): Episode[] {
    return Array.from(this.episodes.values())
      .filter((ep) => {
        if (!ep.success) return false;
        if (toolName && !ep.toolsUsed.includes(toolName)) return false;
        return true;
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  getFailedEpisodes(limit = 10): Episode[] {
    return Array.from(this.episodes.values())
      .filter((ep) => !ep.success)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  async retrieve(query: string, limit = 5): Promise<MemoryEntry[]> {
    const queryLower = query.toLowerCase();

    return Array.from(this.entries.values())
      .map((entry) => {
        const contentMatch = entry.content.toLowerCase().includes(queryLower) ? 2 : 0;
        const score = entry.importance + contentMatch;
        return { entry, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => {
        s.entry.accessCount++;
        s.entry.lastAccessed = new Date();
        return s.entry;
      });
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
    this.episodes.delete(id);
  }

  async list(limit = 20): Promise<MemoryEntry[]> {
    return Array.from(this.entries.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }

  size(): number {
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
    this.episodes.clear();
  }

  private evictOldest(): void {
    const sorted = Array.from(this.entries.entries())
      .sort((a, b) => a[1].createdAt.getTime() - b[1].createdAt.getTime());

    const toRemove = sorted.slice(0, sorted.length - MAX_EPISODES);
    for (const [id] of toRemove) {
      this.entries.delete(id);
      this.episodes.delete(id);
    }
  }
}
