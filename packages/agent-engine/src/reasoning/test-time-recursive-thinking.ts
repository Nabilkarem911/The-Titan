import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'test-time-recursive-thinking' });

export interface TRTAttempt {
  round: number;
  strategy: string;
  answer: string;
  selfVerification: string;
  passed: boolean;
  failureModes: string[];
  knowledgeGained: string;
  tokensUsed: number;
}

export interface TRTResult {
  id: string;
  problem: string;
  attempts: TRTAttempt[];
  finalAnswer: string;
  totalRounds: number;
  converged: boolean;
  confidence: number;
  accumulatedKnowledge: string[];
  durationMs: number;
  success: boolean;
}

export interface TRTStats {
  totalProblems: number;
  avgRounds: number;
  convergenceRate: number;
  avgConfidence: number;
  totalKnowledgeGained: number;
}

const STRATEGY_PROMPT = `You are a test-time recursive thinking module. Solve the problem using a specific strategy.

Strategy: {strategy}
Accumulated knowledge from previous attempts: {knowledge}
Previous failure modes: {failures}

Solve the problem. Then self-verify your answer.

Respond in JSON:
{
  "answer": "your solution",
  "selfVerification": "why you think this is correct or not",
  "passed": true/false,
  "failureModes": ["what went wrong if not passed"],
  "knowledgeGained": "what lesson to carry forward"
}`;

const STRATEGIES = [
  'direct approach — solve step by step',
  'decomposition — break into sub-problems',
  'analogy — find a similar solved problem',
  'backtracking — work backwards from the goal',
  'edge-case analysis — consider boundary conditions',
  'alternative framing — rephrase the problem',
];

export class TestTimeRecursiveThinking {
  private results: TRTResult[] = [];
  private maxResults = 100;
  private globalKnowledge: string[] = [];
  private maxGlobalKnowledge = 200;

  constructor(private llm: LlmProvider, private maxRounds: number = 5) {}

  async solve(problem: string, opts?: {
    maxRounds?: number;
    strategies?: string[];
  }): Promise<TRTResult> {
    const id = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const rounds = opts?.maxRounds ?? this.maxRounds;
    const strategies = opts?.strategies ?? STRATEGIES;
    const attempts: TRTAttempt[] = [];
    const accumulatedKnowledge: string[] = [];
    let converged = false;
    let finalAnswer = '';
    let confidence = 0;

    log.info({ id, problem: problem.slice(0, 80), maxRounds: rounds }, 'TRT started');

    for (let round = 0; round < rounds; round++) {
      const strategy = strategies[round % strategies.length];
      const previousFailures = attempts
        .filter((a) => !a.passed)
        .flatMap((a) => a.failureModes);

      const response = await this.llm.complete([
        {
          role: 'system',
          content: STRATEGY_PROMPT
            .replace('{strategy}', strategy)
            .replace('{knowledge}', accumulatedKnowledge.join('; ') || 'none')
            .replace('{failures}', previousFailures.join('; ') || 'none'),
        },
        { role: 'user', content: problem },
      ], { temperature: 0.2 + round * 0.05, maxTokens: 800 });

      const parsed = this.parseAttempt(response.content, round, strategy, response.tokensUsed);
      attempts.push(parsed);

      if (parsed.knowledgeGained && parsed.knowledgeGained !== 'none') {
        accumulatedKnowledge.push(parsed.knowledgeGained);
      }

      incCounter('trt_attempt', 'TRT attempts', 1, { passed: parsed.passed ? 'true' : 'false' });

      if (parsed.passed) {
        converged = true;
        finalAnswer = parsed.answer;
        confidence = Math.min(0.99, 0.5 + (round === 0 ? 0.4 : 0.3 - round * 0.05));
        log.info({ id, round, strategy }, 'TRT converged');
        break;
      }

      finalAnswer = parsed.answer;
    }

    if (!converged) {
      const passedAttempts = attempts.filter((a) => a.passed);
      if (passedAttempts.length > 0) {
        finalAnswer = passedAttempts[passedAttempts.length - 1].answer;
        converged = true;
        confidence = 0.6;
      } else {
        confidence = 0.3;
      }
    }

    for (const k of accumulatedKnowledge) {
      if (!this.globalKnowledge.includes(k)) {
        this.globalKnowledge.push(k);
      }
    }
    if (this.globalKnowledge.length > this.maxGlobalKnowledge) {
      this.globalKnowledge = this.globalKnowledge.slice(-this.maxGlobalKnowledge);
    }

    const result: TRTResult = {
      id,
      problem,
      attempts,
      finalAnswer,
      totalRounds: attempts.length,
      converged,
      confidence,
      accumulatedKnowledge,
      durationMs: Date.now() - startedAt,
      success: converged,
    };

    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }

    incCounter('trt_solve', 'TRT solves', 1, { converged: converged ? 'true' : 'false' });
    log.info({ id, converged, rounds: attempts.length, confidence, durationMs: result.durationMs }, 'TRT complete');

    return result;
  }

  getResults(): TRTResult[] {
    return this.results;
  }

  getGlobalKnowledge(): string[] {
    return this.globalKnowledge;
  }

  stats(): TRTStats {
    const total = this.results.length;
    const converged = this.results.filter((r) => r.converged).length;
    const avgRounds = total > 0
      ? Math.round((this.results.reduce((s, r) => s + r.totalRounds, 0) / total) * 100) / 100
      : 0;
    const avgConf = total > 0
      ? Math.round((this.results.reduce((s, r) => s + r.confidence, 0) / total) * 100) / 100
      : 0;

    return {
      totalProblems: total,
      avgRounds,
      convergenceRate: total > 0 ? Math.round((converged / total) * 100) : 0,
      avgConfidence: avgConf,
      totalKnowledgeGained: this.globalKnowledge.length,
    };
  }

  clear(): void {
    this.results = [];
  }

  private parseAttempt(content: string, round: number, strategy: string, tokensUsed: number): TRTAttempt {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        round,
        strategy,
        answer: String(raw.answer ?? ''),
        selfVerification: String(raw.selfVerification ?? ''),
        passed: Boolean(raw.passed ?? false),
        failureModes: Array.isArray(raw.failureModes) ? raw.failureModes.map(String) : [],
        knowledgeGained: String(raw.knowledgeGained ?? 'none'),
        tokensUsed,
      };
    } catch {
      return {
        round,
        strategy,
        answer: content.slice(0, 500),
        selfVerification: 'parse failed',
        passed: false,
        failureModes: ['Failed to parse response'],
        knowledgeGained: 'none',
        tokensUsed,
      };
    }
  }
}
