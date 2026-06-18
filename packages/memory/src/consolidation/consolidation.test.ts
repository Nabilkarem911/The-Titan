import { describe, it, expect, vi } from 'vitest';
import { MemorySummarizer } from './summarizer.js';
import { MemoryMerger } from './merger.js';
import { MemoryForgetter } from './forgetter.js';
import type { MemoryEntry } from '../layers/types.js';

function makeEntry(id: string, content: string, opts: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id,
    content,
    type: 'semantic',
    importance: 0.5,
    accessCount: 0,
    lastAccessed: new Date(),
    createdAt: new Date(),
    ...opts,
  };
}

// ── Summarizer ──

describe('MemorySummarizer', () => {
  it('summarizes entries via LLM', async () => {
    const llm = { complete: vi.fn().mockResolvedValue({ content: 'Summary: user asked about Docker deployment' }) };
    const summarizer = new MemorySummarizer({ llm });

    const entries = [
      makeEntry('1', 'How do I deploy with Docker?'),
      makeEntry('2', 'Docker compose vs Dockerfile'),
      makeEntry('3', 'Production Docker best practices'),
    ];

    const result = await summarizer.summarizeEntries(entries);
    expect(result.content).toContain('Docker');
    expect(result.metadata?.consolidatedFrom).toHaveLength(3);
  });

  it('falls back on LLM failure', async () => {
    const llm = { complete: vi.fn().mockRejectedValue(new Error('LLM down')) };
    const summarizer = new MemorySummarizer({ llm });

    const entries = [makeEntry('1', 'Entry A'), makeEntry('2', 'Entry B')];
    const result = await summarizer.summarizeEntries(entries);
    expect(result.content).toContain('Entry A');
    expect(result.metadata?.fallback).toBe(true);
  });

  it('summarizes conversation', async () => {
    const llm = { complete: vi.fn().mockResolvedValue({ content: 'User asked about deployment, decided on Docker.' }) };
    const summarizer = new MemorySummarizer({ llm });

    const summary = await summarizer.summarizeConversation([
      { role: 'user', content: 'How do I deploy?' },
      { role: 'assistant', content: 'You can use Docker.' },
    ]);

    expect(summary).toContain('Docker');
  });
});

// ── Merger ──

describe('MemoryMerger', () => {
  it('finds duplicate entries', () => {
    const merger = new MemoryMerger();
    const entries = [
      makeEntry('1', 'PostgreSQL is a relational database system'),
      makeEntry('2', 'PostgreSQL is a relational database management system'),
      makeEntry('3', 'Redis is an in-memory cache'),
    ];

    const duplicates = merger.findDuplicates(entries);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0].map((e) => e.id).sort()).toEqual(['1', '2']);
  });

  it('merges two entries', () => {
    const merger = new MemoryMerger();
    const a = makeEntry('1', 'Docker is a container platform', { importance: 0.8, accessCount: 5 });
    const b = makeEntry('2', 'Docker is a container platform for deployment', { importance: 0.6, accessCount: 3 });

    const merged = merger.merge(a, b);
    expect(merged.importance).toBe(0.8);
    expect(merged.accessCount).toBe(8);
    expect(merged.metadata?.mergedFrom).toEqual(['1', '2']);
  });

  it('deduplicates all entries', () => {
    const merger = new MemoryMerger();
    const entries = [
      makeEntry('1', 'Redis cache system for fast data access'),
      makeEntry('2', 'Redis cache system for fast data storage and access'),
      makeEntry('3', 'Completely different topic about testing'),
    ];

    const result = merger.deduplicateAll(entries);
    expect(result.length).toBe(2); // 1 merged + 1 unique
  });
});

// ── Forgetter ──

describe('MemoryForgetter', () => {
  it('selects old low-importance entries for forgetting', () => {
    const forgetter = new MemoryForgetter({ maxAge: 1000 }); // 1 second

    const entries = [
      makeEntry('1', 'Old entry', { importance: 0.1, createdAt: new Date(Date.now() - 5000) }),
      makeEntry('2', 'New entry', { importance: 0.9, createdAt: new Date() }),
    ];

    const toForget = forgetter.selectForForgetting(entries);
    expect(toForget.length).toBe(1);
    expect(toForget[0].id).toBe('1');
  });

  it('keeps important entries even if old', () => {
    const forgetter = new MemoryForgetter({ maxAge: 1000 });

    const entries = [
      makeEntry('1', 'Critical memory', { importance: 0.9, createdAt: new Date(Date.now() - 5000) }),
    ];

    const toForget = forgetter.selectForForgetting(entries);
    expect(toForget.length).toBe(0);
  });

  it('forgets zero-access low-importance entries', () => {
    const forgetter = new MemoryForgetter({ minImportance: 0.2 });

    const entries = [
      makeEntry('1', 'Useless', { importance: 0.05, accessCount: 0 }),
      makeEntry('2', 'Useful', { importance: 0.5, accessCount: 3 }),
    ];

    const toForget = forgetter.selectForForgetting(entries);
    expect(toForget.length).toBe(1);
    expect(toForget[0].id).toBe('1');
  });

  it('applies decay to importance', () => {
    const forgetter = new MemoryForgetter({ decayRate: 0.5 });

    const entries = [
      makeEntry('1', 'Old access', {
        importance: 1.0,
        lastAccessed: new Date(Date.now() - 48 * 3600000), // 48 hours ago
      }),
    ];

    const decayed = forgetter.applyDecay(entries);
    expect(decayed[0].importance).toBeLessThan(1.0);
  });
});
