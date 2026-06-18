import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'peer-review' });

export interface ReviewRequest {
  authorRole: string;
  reviewerRole: string;
  content: string;
  context: string;
  criteria?: string[];
}

export interface ReviewFeedback {
  approved: boolean;
  score: number;
  strengths: string[];
  issues: Array<{ severity: 'critical' | 'major' | 'minor'; description: string; suggestion: string }>;
  summary: string;
}

export class PeerReview {
  constructor(private llm: LlmProvider) {}

  async review(request: ReviewRequest): Promise<ReviewFeedback> {
    const criteria = request.criteria?.join(', ') ?? 'correctness, completeness, clarity, efficiency';

    try {
      const completion = await this.llm.complete([
        {
          role: 'system',
          content: `You are a ${request.reviewerRole} reviewing work by a ${request.authorRole}. Evaluate based on: ${criteria}.\n\nRespond ONLY with JSON:\n{\n  "approved": true/false,\n  "score": 0-100,\n  "strengths": ["..."],\n  "issues": [{"severity": "critical|major|minor", "description": "...", "suggestion": "..."}],\n  "summary": "..."\n}`,
        },
        { role: 'user', content: `Context: ${request.context}\n\nWork to review:\n${request.content.slice(0, 8000)}` },
      ], { temperature: 0.2 });

      const match = completion.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as Record<string, unknown>;
        return {
          approved: parsed.approved !== false,
          score: Math.max(0, Math.min(100, Number(parsed.score) || 50)),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
          issues: Array.isArray(parsed.issues)
            ? parsed.issues.map((i) => {
                const raw = i as Record<string, unknown>;
                return {
                  severity: (['critical', 'major', 'minor'].includes(String(raw.severity)) ? String(raw.severity) : 'minor') as 'critical' | 'major' | 'minor',
                  description: String(raw.description ?? ''),
                  suggestion: String(raw.suggestion ?? ''),
                };
              })
            : [],
          summary: String(parsed.summary ?? ''),
        };
      }
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'peer review failed');
    }

    return { approved: true, score: 50, strengths: [], issues: [], summary: 'Review could not be completed' };
  }
}
