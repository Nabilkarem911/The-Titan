import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'peer-review' });

interface ReviewRequest {
  authorRole: string;
  reviewerRole: string;
  content: string;
  context: string;
  criteria?: string[];
}

interface ReviewFeedback {
  approved: boolean;
  score: number;
  strengths: string[];
  issues: Array<{ severity: 'critical' | 'major' | 'minor'; description: string; suggestion: string }>;
  summary: string;
}

class PeerReview {
  constructor(private llm: LlmProvider) {}

  async review(request: ReviewRequest): Promise<ReviewFeedback> {
    const criteria = request.criteria?.join(', ') ?? 'correctness, completeness, clarity, efficiency';

    try {
      const completion = await this.llm.complete([
        {
          role: 'system',
          content: `You are a ${request.reviewerRole} reviewing work by a ${request.authorRole}. Evaluate based on: ${criteria}.

You MUST check for these specific issues and flag them:
- range(len()) anti-pattern: Using range(len(x)) instead of enumerate(x) — ALWAYS flag as a major issue
- Missing error handling: No try/except or error checks for operations that can fail (file I/O, network, DB) — flag as critical or major
- Missing type hints: Python functions without type annotations — flag as minor
- N+1 database queries: Loops that make individual DB queries instead of batch queries — flag as critical
- Missing docstrings: Public functions/classes without docstrings — flag as minor

Scoring rules:
- If ANY critical issue exists → score MUST be ≤ 40, approved = false
- If ANY major issue exists → score MUST be ≤ 70, approved = false
- If only minor issues → score can be up to 85, approved = true
- A perfect score (90+) requires ZERO issues found
- NEVER give score 100 unless the code is truly flawless with no issues at all

Respond ONLY with JSON:
{
  "approved": true/false,
  "score": 0-100,
  "strengths": ["..."],
  "issues": [{"severity": "critical|major|minor", "description": "...", "suggestion": "..."}],
  "summary": "..."
}`,
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

    return { approved: false, score: 0, strengths: [], issues: [], summary: 'Review could not be completed' };
  }
}
