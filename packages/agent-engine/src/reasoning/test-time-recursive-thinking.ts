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
  solverMode: 'fast' | 'slow';
  depth: number;
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
  abstained: boolean;
  abstentionReason?: string;
  solverMode: 'fast' | 'slow';
}

export interface TRTStats {
  totalProblems: number;
  avgRounds: number;
  convergenceRate: number;
  avgConfidence: number;
  totalKnowledgeGained: number;
  abstentionRate: number;
  fastSolverUsage: number;
  slowSolverUsage: number;
}

const FAST_SOLVER_PROMPT = `You are a fast solver. Solve the problem quickly using intuition and pattern matching.

Respond in JSON:
{
  "answer": "your solution",
  "selfVerification": "quick check",
  "passed": true/false,
  "failureModes": [],
  "knowledgeGained": "lesson or none",
  "confidence": 0-100
}`;

const STRATEGY_PROMPT = `You are a test-time recursive thinking module. Solve the problem using a specific strategy.

Strategy: {strategy}
Accumulated knowledge from previous attempts: {knowledge}
Previous failure modes: {failures}
Depth: {depth}

Solve the problem. Then self-verify your answer.

Respond in JSON:
{
  "answer": "your solution",
  "selfVerification": "why you think this is correct or not",
  "passed": true/false,
  "failureModes": ["what went wrong if not passed"],
  "knowledgeGained": "what lesson to carry forward",
  "confidence": 0-100
}`;

const ABSTENTION_PROMPT = `You are an abstention gate. Given the problem, the best answer produced, and the confidence level, determine if the agent should answer or abstain.

Abstain if:
1. Confidence is below threshold
2. The problem is ambiguous or ill-posed
3. The answer might be harmful or misleading
4. Insufficient information to answer reliably

Respond in JSON:
{
  "shouldAbstain": true/false,
  "reason": "explanation"
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

  constructor(private llm: LlmProvider, private maxRounds: number = 5, private abstentionThreshold: number = 0.4) {}

  async solve(problem: string, opts?: {
    maxRounds?: number;
    strategies?: string[];
    fastSolverFirst?: boolean;
  }): Promise<TRTResult> {
    const id = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const rounds = opts?.maxRounds ?? this.maxRounds;
    const strategies = opts?.strategies ?? STRATEGIES;
    const useFastFirst = opts?.fastSolverFirst ?? true;
    const attempts: TRTAttempt[] = [];
    const accumulatedKnowledge: string[] = [];
    let converged = false;
    let finalAnswer = '';
    let confidence = 0;
    let solverMode: 'fast' | 'slow' = 'fast';

    log.info({ id, problem: problem.slice(0, 80), maxRounds: rounds, fastFirst: useFastFirst }, 'TRT started');

    // Phase 1: Fast solver attempt (round 0)
    if (useFastFirst) {
      const fastResponse = await this.llm.complete([
        { role: 'system', content: FAST_SOLVER_PROMPT },
        { role: 'user', content: problem },
      ], { temperature: 0.1, maxTokens: 400 });

      const fastAttempt = this.parseAttempt(fastResponse.content, 0, 'fast-solver', fastResponse.tokensUsed, 'fast', 0);
      attempts.push(fastAttempt);

      if (fastAttempt.knowledgeGained && fastAttempt.knowledgeGained !== 'none') {
        accumulatedKnowledge.push(fastAttempt.knowledgeGained);
      }

      incCounter('trt_attempt', 'TRT attempts', 1, { passed: fastAttempt.passed ? 'true' : 'false', solver: 'fast' });

      if (fastAttempt.passed) {
        converged = true;
        finalAnswer = fastAttempt.answer;
        confidence = 0.85;
        log.info({ id, round: 0, strategy: 'fast-solver' }, 'TRT converged (fast)');
      } else {
        solverMode = 'slow';
        log.info({ id }, 'fast solver failed — switching to slow solver');
      }
    }

    // Phase 2: Slow solver with recursive strategies
    if (!converged) {
      const startRound = useFastFirst ? 1 : 0;
      for (let round = startRound; round < rounds; round++) {
        const strategy = strategies[(round - (useFastFirst ? 1 : 0)) % strategies.length];
        const depth = round - (useFastFirst ? 1 : 0) + 1;
        const previousFailures = attempts
          .filter((a) => !a.passed)
          .flatMap((a) => a.failureModes);

        const response = await this.llm.complete([
          {
            role: 'system',
            content: STRATEGY_PROMPT
              .replace('{strategy}', strategy)
              .replace('{knowledge}', accumulatedKnowledge.join('; ') || 'none')
              .replace('{failures}', previousFailures.join('; ') || 'none')
              .replace('{depth}', String(depth)),
          },
          { role: 'user', content: problem },
        ], { temperature: 0.2 + (round - (useFastFirst ? 1 : 0)) * 0.05, maxTokens: 800 });

        const parsed = this.parseAttempt(response.content, round, strategy, response.tokensUsed, 'slow', depth);
        attempts.push(parsed);

        if (parsed.knowledgeGained && parsed.knowledgeGained !== 'none') {
          accumulatedKnowledge.push(parsed.knowledgeGained);
        }

        incCounter('trt_attempt', 'TRT attempts', 1, { passed: parsed.passed ? 'true' : 'false', solver: 'slow' });

        if (parsed.passed) {
          converged = true;
          finalAnswer = parsed.answer;
          confidence = Math.min(0.99, 0.5 + (round === 0 ? 0.4 : 0.3 - (round - (useFastFirst ? 1 : 0)) * 0.05));
          log.info({ id, round, strategy, depth }, 'TRT converged (slow)');
          break;
        }

        finalAnswer = parsed.answer;
      }
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

    // Phase 3: Abstention gate
    let abstained = false;
    let abstentionReason: string | undefined;

    if (confidence < this.abstentionThreshold) {
      abstained = true;
      abstentionReason = `Confidence ${confidence} below threshold ${this.abstentionThreshold}`;
      incCounter('trt_abstained', 'TRT abstentions', 1, { reason: 'low_confidence' });
      log.info({ id, confidence, threshold: this.abstentionThreshold }, 'TRT abstained — low confidence');
    } else {
      // LLM-based abstention check
      try {
        const abstResponse = await this.llm.complete([
          { role: 'system', content: ABSTENTION_PROMPT },
          {
            role: 'user',
            content: JSON.stringify({
              problem: problem.slice(0, 500),
              answer: finalAnswer.slice(0, 500),
              confidence,
            }),
          },
        ], { temperature: 0.1, maxTokens: 200 });

        const jsonMatch = abstResponse.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const abstParsed = JSON.parse(jsonMatch[0]);
          if (abstParsed.shouldAbstain === true) {
            abstained = true;
            abstentionReason = String(abstParsed.reason ?? 'Abstention gate triggered');
            incCounter('trt_abstained', 'TRT abstentions', 1, { reason: 'gate' });
            log.info({ id, reason: abstentionReason }, 'TRT abstained — gate triggered');
          }
        }
      } catch (err) {
        log.debug({ err, id }, 'abstention gate check failed — proceeding');
      }
    }

    const result: TRTResult = {
      id,
      problem,
      attempts,
      finalAnswer: abstained ? '' : finalAnswer,
      totalRounds: attempts.length,
      converged,
      confidence,
      accumulatedKnowledge,
      durationMs: Date.now() - startedAt,
      success: converged && !abstained,
      abstained,
      abstentionReason,
      solverMode,
    };

    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }

    incCounter('trt_solve', 'TRT solves', 1, { converged: converged ? 'true' : 'false', abstained: abstained ? 'true' : 'false', solver: solverMode });
    log.info({ id, converged, abstained, rounds: attempts.length, confidence, solverMode, durationMs: result.durationMs }, 'TRT complete');

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

    const abstained = this.results.filter((r) => r.abstained).length;
    const fastSolves = this.results.filter((r) => r.solverMode === 'fast').length;
    const slowSolves = this.results.filter((r) => r.solverMode === 'slow').length;

    return {
      totalProblems: total,
      avgRounds,
      convergenceRate: total > 0 ? Math.round((converged / total) * 100) : 0,
      avgConfidence: avgConf,
      totalKnowledgeGained: this.globalKnowledge.length,
      abstentionRate: total > 0 ? Math.round((abstained / total) * 100) : 0,
      fastSolverUsage: fastSolves,
      slowSolverUsage: slowSolves,
    };
  }

  clear(): void {
    this.results = [];
  }

  private parseAttempt(content: string, round: number, strategy: string, tokensUsed: number, solverMode: 'fast' | 'slow' = 'slow', depth: number = 0): TRTAttempt {
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
        solverMode,
        depth,
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
        solverMode,
        depth,
      };
    }
  }
}
