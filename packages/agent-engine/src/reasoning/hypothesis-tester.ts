import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'hypothesis-tester' });

export interface Hypothesis {
  id: string;
  statement: string;
  rationale: string;
  testAction: string;
  expectedIfTrue: string;
  expectedIfFalse: string;
  confidence: number;
  status: 'proposed' | 'testing' | 'confirmed' | 'refuted' | 'inconclusive';
  result?: string;
  testedAt?: Date;
}

export interface HypothesisTestResult {
  hypothesis: Hypothesis;
  testOutput: string;
  conclusion: 'confirmed' | 'refuted' | 'inconclusive';
  reasoning: string;
  nextSteps: string[];
}

const HYPOTHESIS_PROMPT = `You are a scientific reasoning agent. Given a problem, generate hypotheses and design tests.

Follow the scientific method:
1. Observe the problem
2. Form multiple hypotheses (at least 2-3)
3. For each hypothesis, design a test that would confirm or refute it
4. Specify what evidence would prove/disprove each hypothesis

Respond in JSON:
{
  "hypotheses": [
    {
      "statement": "Hypothesis statement",
      "rationale": "Why this might be the cause",
      "testAction": "What command/action to run to test this",
      "expectedIfTrue": "What we'd see if hypothesis is true",
      "expectedIfFalse": "What we'd see if hypothesis is false",
      "confidence": 0-100
    }
  ]
}`;

const CONCLUSION_PROMPT = `You are evaluating test results against hypotheses.

Given the hypothesis, the test action, the expected outcomes, and the actual test output, determine:
1. Is the hypothesis confirmed, refuted, or inconclusive?
2. What reasoning supports this conclusion?
3. What should the agent do next?

Respond in JSON:
{
  "conclusion": "confirmed" | "refuted" | "inconclusive",
  "reasoning": "Why this conclusion",
  "nextSteps": ["action1", "action2"]
}`;

export class HypothesisTester {
  private history: Hypothesis[] = [];
  private maxHistory = 200;

  constructor(private llm: LlmProvider) {}

  async generateHypotheses(problem: string, context?: string): Promise<Hypothesis[]> {
    log.info({ problem: problem.slice(0, 100) }, 'generating hypotheses');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: HYPOTHESIS_PROMPT },
        { role: 'user', content: JSON.stringify({ problem, context: context ?? '' }) },
      ], {
        temperature: 0.3,
        maxTokens: 1500,
      });

      const parsed = this.parseHypotheses(response.content);
      if (parsed.length === 0) {
        log.warn('no hypotheses generated');
        return [];
      }

      incCounter('hypothesis_generated', 'Hypotheses generated', parsed.length);
      this.history.push(...parsed);
      if (this.history.length > this.maxHistory) {
        this.history = this.history.slice(-this.maxHistory);
      }

      return parsed;
    } catch (err) {
      log.error({ err }, 'hypothesis generation failed');
      return [];
    }
  }

  async evaluateResult(
    hypothesis: Hypothesis,
    testOutput: string,
  ): Promise<HypothesisTestResult> {
    log.info({ hypothesisId: hypothesis.id }, 'evaluating hypothesis test result');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: CONCLUSION_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            hypothesis: hypothesis.statement,
            testAction: hypothesis.testAction,
            expectedIfTrue: hypothesis.expectedIfTrue,
            expectedIfFalse: hypothesis.expectedIfFalse,
            testOutput: testOutput.slice(0, 2000),
          }),
        },
      ], {
        temperature: 0.1,
        maxTokens: 800,
      });

      const parsed = this.parseConclusion(response.content);
      hypothesis.status = parsed.conclusion;
      hypothesis.result = parsed.reasoning;
      hypothesis.testedAt = new Date();

      incCounter('hypothesis_evaluated', 'Hypotheses evaluated', 1, {
        conclusion: parsed.conclusion,
      });

      return {
        hypothesis,
        testOutput,
        conclusion: parsed.conclusion,
        reasoning: parsed.reasoning,
        nextSteps: parsed.nextSteps,
      };
    } catch (err) {
      log.error({ err }, 'hypothesis evaluation failed');
      hypothesis.status = 'inconclusive';
      return {
        hypothesis,
        testOutput,
        conclusion: 'inconclusive',
        reasoning: 'Evaluation failed',
        nextSteps: [],
      };
    }
  }

  getHistory(): Hypothesis[] {
    return this.history;
  }

  getConfirmed(): Hypothesis[] {
    return this.history.filter((h) => h.status === 'confirmed');
  }

  getRefuted(): Hypothesis[] {
    return this.history.filter((h) => h.status === 'refuted');
  }

  private parseHypotheses(content: string): Hypothesis[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw.hypotheses)) return [];

      return raw.hypotheses.map((h: Record<string, unknown>) => ({
        id: `hyp-${Math.random().toString(36).slice(2, 10)}`,
        statement: String(h.statement ?? ''),
        rationale: String(h.rationale ?? ''),
        testAction: String(h.testAction ?? ''),
        expectedIfTrue: String(h.expectedIfTrue ?? ''),
        expectedIfFalse: String(h.expectedIfFalse ?? ''),
        confidence: Math.max(0, Math.min(100, Number(h.confidence ?? 50))),
        status: 'proposed' as const,
      }));
    } catch {
      return [];
    }
  }

  private parseConclusion(content: string): {
    conclusion: 'confirmed' | 'refuted' | 'inconclusive';
    reasoning: string;
    nextSteps: string[];
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { conclusion: 'inconclusive', reasoning: 'Parse failed', nextSteps: [] };

      const raw = JSON.parse(jsonMatch[0]);
      return {
        conclusion: (raw.conclusion as 'confirmed' | 'refuted' | 'inconclusive') ?? 'inconclusive',
        reasoning: String(raw.reasoning ?? ''),
        nextSteps: Array.isArray(raw.nextSteps) ? raw.nextSteps : [],
      };
    } catch {
      return { conclusion: 'inconclusive', reasoning: 'Parse failed', nextSteps: [] };
    }
  }
}
