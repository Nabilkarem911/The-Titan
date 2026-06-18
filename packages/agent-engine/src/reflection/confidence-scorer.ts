import { getLogger } from '@titan/logging';
import type { LlmProvider, AgentRun } from '../types.js';
import type { ConfidenceScore } from './types.js';

const log = getLogger().child({ component: 'confidence-scorer' });

const SCORE_PROMPT = `You are a calibrated confidence estimator. Given a task and an AI agent's answer, score the confidence.

Score each dimension from 0 to 100:
- factualAccuracy: How likely are the facts to be correct?
- completeness: Does it cover all aspects of the question?
- relevance: Is it on-topic and addresses what was asked?
- coherence: Is the reasoning logical and well-structured?

Respond ONLY with JSON:
{
  "overall": 0-100,
  "dimensions": {
    "factualAccuracy": 0-100,
    "completeness": 0-100,
    "relevance": 0-100,
    "coherence": 0-100
  },
  "explanation": "Brief explanation of the score"
}`;

export class ConfidenceScorer {
  constructor(private llm: LlmProvider) {}

  async score(run: AgentRun): Promise<ConfidenceScore> {
    if (!run.finalAnswer) {
      return this.zeroScore('No answer produced');
    }

    const heuristicScore = this.heuristicScore(run);

    try {
      const stepsContext = run.steps
        .filter((s) => s.action || s.reflection)
        .map((s, i) => {
          const parts = [`Step ${i + 1}:`];
          if (s.action) parts.push(`  Tool: ${s.action.name} → ${s.observation?.success ? 'success' : 'failed'}`);
          if (s.reflection) parts.push(`  Reflection: ${s.reflection.slice(0, 200)}`);
          return parts.join('\n');
        })
        .join('\n');

      const completion = await this.llm.complete([
        { role: 'system', content: SCORE_PROMPT },
        {
          role: 'user',
          content: `Task: ${run.prompt}\n\nSteps taken:\n${stepsContext}\n\nFinal answer:\n${run.finalAnswer.slice(0, 2000)}`,
        },
      ], { temperature: 0 });

      const llmScore = this.parseScore(completion.content);

      const blended = this.blendScores(heuristicScore, llmScore);
      log.info({ runId: run.id, overall: blended.overall }, 'confidence scored');
      return blended;
    } catch (err) {
      log.warn({ runId: run.id, err: err instanceof Error ? err.message : 'Unknown' }, 'LLM scoring failed — using heuristic');
      return heuristicScore;
    }
  }

  heuristicScore(run: AgentRun): ConfidenceScore {
    let factualAccuracy = 50;
    let completeness = 50;
    let relevance = 70;
    let coherence = 60;

    const successfulTools = run.steps.filter((s) => s.observation?.success).length;
    const failedTools = run.steps.filter((s) => s.observation && !s.observation.success).length;
    const totalTools = successfulTools + failedTools;

    if (totalTools > 0) {
      factualAccuracy = Math.round((successfulTools / totalTools) * 80 + 20);
    }

    if (run.steps.length > 0 && run.finalAnswer) {
      completeness = Math.min(90, 40 + run.steps.length * 10);
    }

    if (run.finalAnswer) {
      const answerLen = run.finalAnswer.length;
      if (answerLen < 20) relevance = 30;
      else if (answerLen < 100) relevance = 60;
      else relevance = 80;
    }

    if (failedTools === 0 && run.status === 'completed') {
      coherence = 80;
    } else if (failedTools > successfulTools) {
      coherence = 30;
    }

    if (run.finalAnswer?.includes('Max steps reached') || run.finalAnswer?.includes('Token budget exhausted')) {
      completeness = Math.max(20, completeness - 30);
    }

    const overall = Math.round(
      factualAccuracy * 0.35 + completeness * 0.25 + relevance * 0.25 + coherence * 0.15,
    );

    return {
      overall,
      dimensions: { factualAccuracy, completeness, relevance, coherence },
      explanation: 'Heuristic score based on tool success rate, answer length, and completion status',
    };
  }

  private blendScores(heuristic: ConfidenceScore, llm: ConfidenceScore): ConfidenceScore {
    const w = 0.7; // LLM weight

    return {
      overall: Math.round(llm.overall * w + heuristic.overall * (1 - w)),
      dimensions: {
        factualAccuracy: Math.round(llm.dimensions.factualAccuracy * w + heuristic.dimensions.factualAccuracy * (1 - w)),
        completeness: Math.round(llm.dimensions.completeness * w + heuristic.dimensions.completeness * (1 - w)),
        relevance: Math.round(llm.dimensions.relevance * w + heuristic.dimensions.relevance * (1 - w)),
        coherence: Math.round(llm.dimensions.coherence * w + heuristic.dimensions.coherence * (1 - w)),
      },
      explanation: llm.explanation,
    };
  }

  private parseScore(content: string): ConfidenceScore {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return this.zeroScore('Could not parse score');

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const dims = parsed.dimensions as Record<string, unknown> | undefined;

      return {
        overall: this.clamp(Number(parsed.overall) || 0),
        dimensions: {
          factualAccuracy: this.clamp(Number(dims?.factualAccuracy) || 0),
          completeness: this.clamp(Number(dims?.completeness) || 0),
          relevance: this.clamp(Number(dims?.relevance) || 0),
          coherence: this.clamp(Number(dims?.coherence) || 0),
        },
        explanation: String(parsed.explanation ?? ''),
      };
    } catch {
      return this.zeroScore('Parse error');
    }
  }

  private clamp(n: number): number {
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  private zeroScore(explanation: string): ConfidenceScore {
    return {
      overall: 0,
      dimensions: { factualAccuracy: 0, completeness: 0, relevance: 0, coherence: 0 },
      explanation,
    };
  }
}
