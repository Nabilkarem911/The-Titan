import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { MemoryEntry } from '../layers/types.js';

const log = getLogger().child({ component: 'memory-summarizer' });

interface SummarizerDeps {
  llm: { complete(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> };
}

export class MemorySummarizer {
  constructor(private deps: SummarizerDeps) {}

  async summarizeEntries(entries: MemoryEntry[], maxOutputLength = 500): Promise<MemoryEntry> {
    const combined = entries
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((e) => e.content)
      .join('\n---\n');

    try {
      const result = await this.deps.llm.complete([
        {
          role: 'system',
          content: `Summarize the following memories into a single concise summary (max ${maxOutputLength} chars). Keep key facts, decisions, and outcomes. Remove redundancy.`,
        },
        { role: 'user', content: combined.slice(0, 8000) },
      ]);

      const summary: MemoryEntry = {
        id: randomUUID(),
        content: result.content.slice(0, maxOutputLength),
        type: 'semantic',
        importance: Math.max(...entries.map((e) => e.importance)),
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        metadata: {
          consolidatedFrom: entries.map((e) => e.id),
          originalCount: entries.length,
        },
      };

      log.info({ sourceCount: entries.length, summaryLength: summary.content.length }, 'entries summarized');
      return summary;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'LLM summarization failed — using simple concat');
      return {
        id: randomUUID(),
        content: entries.map((e) => e.content).join(' | ').slice(0, maxOutputLength),
        type: 'semantic',
        importance: Math.max(...entries.map((e) => e.importance)),
        accessCount: 0,
        lastAccessed: new Date(),
        createdAt: new Date(),
        metadata: { consolidatedFrom: entries.map((e) => e.id), fallback: true },
      };
    }
  }

  async summarizeConversation(
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const transcript = messages
      .map((m) => `[${m.role}] ${m.content.slice(0, 500)}`)
      .join('\n');

    try {
      const result = await this.deps.llm.complete([
        {
          role: 'system',
          content: 'Summarize this conversation in 2-3 sentences. Focus on: what was asked, what was decided, and the outcome.',
        },
        { role: 'user', content: transcript.slice(0, 6000) },
      ]);

      return result.content;
    } catch {
      return `Conversation with ${messages.length} messages`;
    }
  }
}
