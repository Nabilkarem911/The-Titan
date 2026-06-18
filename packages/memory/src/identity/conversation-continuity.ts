import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'conversation-continuity' });

export interface ConversationSummary {
  sessionId: string;
  userId: string;
  summary: string;
  topics: string[];
  decisions: string[];
  mood: 'positive' | 'neutral' | 'frustrated' | 'excited';
  timestamp: Date;
}

export class ConversationContinuity {
  private summaries: Map<string, ConversationSummary[]> = new Map();
  private maxPerUser = 50;

  addSummary(summary: ConversationSummary): void {
    const list = this.summaries.get(summary.userId) ?? [];
    list.push(summary);

    if (list.length > this.maxPerUser) {
      list.splice(0, list.length - this.maxPerUser);
    }

    this.summaries.set(summary.userId, list);
  }

  getRecent(userId: string, limit = 5): ConversationSummary[] {
    const list = this.summaries.get(userId) ?? [];
    return list.slice(-limit);
  }

  getByTopic(userId: string, topic: string): ConversationSummary[] {
    const list = this.summaries.get(userId) ?? [];
    const lower = topic.toLowerCase();
    return list.filter((s) => s.topics.some((t) => t.toLowerCase().includes(lower)));
  }

  buildContinuityContext(userId: string): string {
    const recent = this.getRecent(userId, 3);
    if (recent.length === 0) return '';

    return recent
      .map((s) => `[${s.timestamp.toLocaleDateString()}] ${s.summary} (topics: ${s.topics.join(', ')})`)
      .join('\n');
  }

  detectMood(messages: string[]): ConversationSummary['mood'] {
    const combined = messages.join(' ').toLowerCase();

    if (combined.match(/(مش عارف|مش فاهم|frustrated|stuck|broken|error|fail|مضايق|زهقت)/)) {
      return 'frustrated';
    }
    if (combined.match(/(ممتاز|perfect|amazing|great|awesome|تمام|حلو|يا سلام|excited)/)) {
      return 'excited';
    }
    if (combined.match(/(شكرا|thanks|nice|good|كويس|حلو)/)) {
      return 'positive';
    }
    return 'neutral';
  }

  extractTopics(messages: string[]): string[] {
    const combined = messages.join(' ').toLowerCase();
    const topics: string[] = [];

    const patterns: Array<[RegExp, string]> = [
      [/(deploy|deployment|ديبلوي)/, 'deployment'],
      [/(docker|container|حاوي)/, 'docker'],
      [/(database|postgres|sql|داتابيز)/, 'database'],
      [/(api|endpoint|route)/, 'api'],
      [/(bug|fix|error|إيرور|مشكل)/, 'bugfix'],
      [/(test|testing|اختبار)/, 'testing'],
      [/(auth|login|jwt|token)/, 'authentication'],
      [/(frontend|dashboard|react|واجه)/, 'frontend'],
      [/(performance|speed|بطيء|سرع)/, 'performance'],
      [/(security|أمان|حماي)/, 'security'],
    ];

    for (const [pattern, topic] of patterns) {
      if (pattern.test(combined) && !topics.includes(topic)) {
        topics.push(topic);
      }
    }

    return topics;
  }
}
