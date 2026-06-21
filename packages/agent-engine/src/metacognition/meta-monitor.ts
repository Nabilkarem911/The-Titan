import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider, AgentRun, AgentStep } from '../types.js';

const log = getLogger().child({ component: 'meta-monitor' });

export interface StepConfidence {
  stepIndex: number;
  confidence: number;
  reason: string;
  shouldRetry: boolean;
  shouldSwitchStrategy: boolean;
}

export interface MetaAssessment {
  overallConfidence: number;
  stepAssessments: StepConfidence[];
  recommendation: 'proceed' | 'retry' | 'switch_strategy' | 'ask_user' | 'stop';
  reason: string;
}

const META_PROMPT = `You are a metacognitive monitor. You evaluate the quality of reasoning in agent steps.

For each step, assess:
1. Is the thought logical and well-reasoned?
2. Is the tool call appropriate for the task?
3. Is the observation being used correctly?
4. Is the agent making progress toward the goal?

Respond in JSON:
{
  "overallConfidence": 0-100,
  "stepAssessments": [
    { "stepIndex": 0, "confidence": 0-100, "reason": "...", "shouldRetry": false, "shouldSwitchStrategy": false }
  ],
  "recommendation": "proceed" | "retry" | "switch_strategy" | "ask_user" | "stop",
  "reason": "..."
}`;

export class MetaMonitor {
  private lowConfidenceThreshold: number;
  private retryThreshold: number;

  constructor(
    private llm: LlmProvider,
    opts?: { lowConfidenceThreshold?: number; retryThreshold?: number },
  ) {
    this.lowConfidenceThreshold = opts?.lowConfidenceThreshold ?? 40;
    this.retryThreshold = opts?.retryThreshold ?? 25;
  }

  async assess(run: AgentRun): Promise<MetaAssessment> {
    if (run.steps.length === 0) {
      return {
        overallConfidence: 50,
        stepAssessments: [],
        recommendation: 'proceed',
        reason: 'No steps yet',
      };
    }

    try {
      const stepsSummary = run.steps.map((s, i) => ({
        index: i,
        thought: s.thought?.slice(0, 200),
        tool: s.action?.name,
        observation: s.observation?.success ? 'success' : 'error',
        reflection: s.reflection?.slice(0, 200),
      }));

      const response = await this.llm.complete([
        { role: 'system', content: META_PROMPT },
        { role: 'user', content: JSON.stringify({ prompt: run.prompt, steps: stepsSummary }) },
      ], {
        temperature: 0.1,
        maxTokens: 1000,
      });

      const parsed = this.parseResponse(response.content);
      if (parsed) {
        incCounter('meta_monitor_assessment', 'Metacognitive assessments', 1, {
          recommendation: parsed.recommendation,
        });

        if (parsed.overallConfidence < this.lowConfidenceThreshold) {
          log.warn({ runId: run.id, confidence: parsed.overallConfidence }, 'low confidence detected');
        }

        return parsed;
      }
    } catch (err) {
      log.warn({ err }, 'meta-monitor assessment failed — returning default');
    }

    return {
      overallConfidence: 50,
      stepAssessments: [],
      recommendation: 'proceed',
      reason: 'Assessment unavailable',
    };
  }

  assessStep(step: AgentStep, index: number): StepConfidence {
    let confidence = 70;

    if (step.observation && !step.observation.success) {
      confidence -= 30;
    }

    if (!step.thought || step.thought.length < 20) {
      confidence -= 15;
    }

    if (step.reflection && step.reflection.includes('not sure')) {
      confidence -= 20;
    }

    if (step.reflection && step.reflection.includes('confident')) {
      confidence += 10;
    }

    confidence = Math.max(0, Math.min(100, confidence));

    return {
      stepIndex: index,
      confidence,
      reason: confidence < this.retryThreshold ? 'Very low confidence' : 'Acceptable',
      shouldRetry: confidence < this.retryThreshold,
      shouldSwitchStrategy: confidence < this.lowConfidenceThreshold,
    };
  }

  private parseResponse(content: string): MetaAssessment | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const raw = JSON.parse(jsonMatch[0]);

      return {
        overallConfidence: Math.max(0, Math.min(100, Number(raw.overallConfidence ?? 50))),
        stepAssessments: Array.isArray(raw.stepAssessments) ? raw.stepAssessments : [],
        recommendation: raw.recommendation ?? 'proceed',
        reason: raw.reason ?? '',
      };
    } catch {
      return null;
    }
  }
}
