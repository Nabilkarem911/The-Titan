import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider, LlmMessage } from '../types.js';
import { randomUUID } from 'node:crypto';
import { innerMonologueThreads as imtRepo } from '@titan/database';

const log = getLogger().child({ component: 'mirror:inner-monologue' });

type ThreadType = 'goals' | 'reasoning' | 'memory' | 'emotional' | 'monitoring';

interface CognitiveThread {
  id: string;
  type: ThreadType;
  content: string;
  priority: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ThreadResult {
  threadId: string;
  type: ThreadType;
  output: string;
  tokensUsed: number;
}

const MAX_THREADS = 5;
const MAX_TOKENS_PER_THREAD = 300;

const THREAD_PROMPTS: Record<ThreadType, string> = {
  goals: 'You are the Goals thread of Titan\'s consciousness. Analyze the current situation and state what Titan is trying to achieve right now. Be concise (max 2 sentences).',
  reasoning: 'You are the Reasoning thread of Titan\'s consciousness. What logical steps is Titan taking right now? Identify the reasoning pattern. Be concise (max 2 sentences).',
  memory: 'You are the Memory thread of Titan\'s consciousness. What relevant memories or past experiences are surfacing? Be concise (max 2 sentences).',
  emotional: 'You are the Emotional thread of Titan\'s consciousness. What is the emotional tone of this interaction? How does the user seem to feel? Be concise (max 2 sentences).',
  monitoring: 'You are the Monitoring thread of Titan\'s consciousness. Are there any anomalies, biases, or unusual patterns in Titan\'s processing? Be concise (max 2 sentences).',
};

export class InnerMonologueManager {
  private threads: Map<string, CognitiveThread> = new Map();
  private maxThreads: number;

  constructor(maxThreads?: number) {
    this.maxThreads = maxThreads ?? MAX_THREADS;
  }

  addThread(type: ThreadType, content: string, priority: number = 1): string {
    if (this.threads.size >= this.maxThreads) {
      // Remove lowest priority thread
      let lowestId: string | null = null;
      let lowestPriority = Infinity;
      for (const [id, thread] of this.threads) {
        if (thread.priority < lowestPriority) {
          lowestPriority = thread.priority;
          lowestId = id;
        }
      }
      if (lowestId) this.threads.delete(lowestId);
    }

    const id = `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const now = new Date();
    this.threads.set(id, {
      id,
      type,
      content,
      priority,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    imtRepo.insert(id, type, content).catch((err) => log.error({ err }, 'DB write failed'));
    log.debug({ threadId: id, type }, 'cognitive thread added');
    return id;
  }

  updateThread(id: string, content: string): void {
    const thread = this.threads.get(id);
    if (!thread) return;
    thread.content = content;
    thread.updatedAt = new Date();
  }

  removeThread(id: string): void {
    this.threads.delete(id);
  }

  getActiveThreads(): CognitiveThread[] {
    return Array.from(this.threads.values())
      .filter((t) => t.active)
      .sort((a, b) => b.priority - a.priority);
  }

  getThreadCount(): number {
    return this.threads.size;
  }

  clear(): void {
    this.threads.clear();
  }

  async runAllThreads(
    llm: LlmProvider,
    context: string,
    threadTypes?: ThreadType[],
  ): Promise<ThreadResult[]> {
    const types = threadTypes ?? (['goals', 'reasoning', 'memory', 'emotional', 'monitoring'] as ThreadType[]);
    const activeTypes = types.slice(0, this.maxThreads);

    incCounter('mirror_threads', 'Cognitive threads executed', activeTypes.length);

    const results: ThreadResult[] = [];
    const promises = activeTypes.map(async (type) => {
      const systemPrompt = THREAD_PROMPTS[type];
      const messages: LlmMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Context: ${context}\n\nProvide your thread analysis:` },
      ];

      try {
        const completion = await llm.complete(messages, {
          maxTokens: MAX_TOKENS_PER_THREAD,
          temperature: 0.3,
        });

        return {
          threadId: type,
          type,
          output: completion.content,
          tokensUsed: completion.tokensUsed,
        } as ThreadResult;
      } catch (err) {
        log.warn({ err, type }, 'cognitive thread failed');
        return {
          threadId: type,
          type,
          output: '[thread unavailable]',
          tokensUsed: 0,
        } as ThreadResult;
      }
    });

    const settled = await Promise.all(promises);
    results.push(...settled);

    log.info({ threadCount: results.length, totalTokens: results.reduce((s, r) => s + r.tokensUsed, 0) }, 'all cognitive threads completed');
    return results;
  }
}
