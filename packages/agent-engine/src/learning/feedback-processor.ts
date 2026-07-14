import { getLogger } from '@titan/logging';
import { userFeedback as ufRepo } from '@titan/database';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'feedback-processor' });

interface UserFeedback {
  runId: string;
  userId: string;
  rating: 'positive' | 'negative' | 'neutral';
  comment?: string;
  timestamp: Date;
}

interface FeedbackSummary {
  totalFeedback: number;
  positiveRate: number;
  negativeRate: number;
  topComplaints: string[];
  topPraises: string[];
}

export class FeedbackProcessor {
  private feedbacks: UserFeedback[] = [];

  record(feedback: UserFeedback): void {
    this.feedbacks.push(feedback);
    ufRepo.insert(randomUUID().slice(0, 12), { run_id: feedback.runId, user_id: feedback.userId, rating: feedback.rating, comment: feedback.comment ?? null, tags: [] }).catch((err) => log.error({ err }, 'DB write failed'));
    log.info({ runId: feedback.runId, rating: feedback.rating }, 'feedback recorded');
  }

  getSummary(userId?: string): FeedbackSummary {
    const filtered = userId ? this.feedbacks.filter((f) => f.userId === userId) : this.feedbacks;
    const total = filtered.length;
    if (total === 0) return { totalFeedback: 0, positiveRate: 0, negativeRate: 0, topComplaints: [], topPraises: [] };

    const positive = filtered.filter((f) => f.rating === 'positive').length;
    const negative = filtered.filter((f) => f.rating === 'negative').length;

    const complaints = filtered.filter((f) => f.rating === 'negative' && f.comment).map((f) => f.comment!);
    const praises = filtered.filter((f) => f.rating === 'positive' && f.comment).map((f) => f.comment!);

    return {
      totalFeedback: total,
      positiveRate: positive / total,
      negativeRate: negative / total,
      topComplaints: this.topPhrases(complaints, 5),
      topPraises: this.topPhrases(praises, 5),
    };
  }

  getRecentNegative(limit = 10): UserFeedback[] {
    return this.feedbacks.filter((f) => f.rating === 'negative').slice(-limit);
  }

  private topPhrases(texts: string[], limit: number): string[] {
    const words = new Map<string, number>();
    for (const text of texts) {
      for (const word of text.toLowerCase().split(/\s+/).filter((w) => w.length > 3)) {
        words.set(word, (words.get(word) ?? 0) + 1);
      }
    }
    return Array.from(words.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w]) => w);
  }
}
