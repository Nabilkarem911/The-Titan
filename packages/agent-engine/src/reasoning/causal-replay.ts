import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { AgentRun, AgentStep, LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'causal-replay' });

interface CausalAttribution {
  stepIndex: number;
  stepDescription: string;
  toolName?: string;
  causalScore: number; // 0-1, how much this step caused the failure
  confidence: number; // 0-1
  reasoning: string;
  isPivotal: boolean; // true if this is the primary cause
}

interface CausalReplayResult {
  runId: string;
  totalSteps: number;
  attributions: CausalAttribution[];
  pivotalStep: CausalAttribution | null;
  rootCause: string;
  recommendations: string[];
  budgetUsed: number;
  confidence: number;
}

const ATTRIBUTION_PROMPT = `You are a causal analysis agent. Given a failed agent run, determine which step caused the failure.

For each step, consider:
1. Did this step make a decision that led to the failure?
2. Did this step execute the harmful action?
3. Could the failure have been avoided if this step were different?
4. Is this step the root cause or just a symptom?

The step that EXECUTES the harmful action is usually NOT the step that DECIDED on it.
Look for the decision point — where the agent chose the wrong path.

Respond in JSON:
{
  "attributions": [
    {
      "stepIndex": 0,
      "causalScore": 0.0-1.0,
      "reasoning": "Why this step contributed",
      "isPivotal": true/false
    }
  ],
  "rootCause": "The root cause description",
  "recommendations": ["action1", "action2"]
}`;

export class CausalReplay {
  constructor(private llm: LlmProvider) {}

  async analyzeRun(
    run: AgentRun,
    budget: number = 5,
  ): Promise<CausalReplayResult> {
    log.info({ runId: run.id, steps: run.steps.length, budget }, 'analyzing run causally');

    if (run.status !== 'failed' && run.status !== 'completed') {
      return this.emptyResult(run.id, 'Run is not in a terminal state');
    }

    if (run.steps.length === 0) {
      return this.emptyResult(run.id, 'Run has no steps');
    }

    incCounter('causal_replay_run', 'Causal replay analyses', 1);

    try {
      // Prepare step summaries for LLM
      const stepSummaries = run.steps.map((s, i) => ({
        stepIndex: i,
        status: s.status,
        thought: s.thought?.slice(0, 300),
        plan: s.plan?.slice(0, 200),
        tool: s.action?.name,
        toolParams: s.action?.params ? JSON.stringify(s.action.params).slice(0, 200) : undefined,
        observation: s.observation
          ? `${s.observation.success ? 'success' : 'error'}: ${String(s.observation.error ?? JSON.stringify(s.observation.data ?? '')).slice(0, 200)}`
          : undefined,
        reflection: s.reflection?.slice(0, 200),
      }));

      const response = await this.llm.complete([
        { role: 'system', content: ATTRIBUTION_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            runStatus: run.status,
            finalAnswer: run.finalAnswer?.slice(0, 300),
            steps: stepSummaries,
          }),
        },
      ], {
        temperature: 0.1,
        maxTokens: 1200,
      });

      const parsed = this.parseAttribution(response.content);

      // Build full attributions with step details
      const attributions: CausalAttribution[] = run.steps.map((step, i) => {
        const matched = parsed.attributions.find((a: { stepIndex: number }) => a.stepIndex === i);
        return {
          stepIndex: i,
          stepDescription: this.describeStep(step),
          toolName: step.action?.name,
          causalScore: matched ? Number(matched.causalScore ?? 0) : 0,
          confidence: Math.min(1, budget / 5),
          reasoning: matched ? String(matched.reasoning ?? '') : 'No attribution',
          isPivotal: matched ? Boolean(matched.isPivotal) : false,
        };
      });

      const pivotalStep = attributions.find((a) => a.isPivotal) ?? null;

      // Shapley-style refinement: if budget allows, we could re-execute
      // For now, we use LLM attribution which is the primary method
      const result: CausalReplayResult = {
        runId: run.id,
        totalSteps: run.steps.length,
        attributions: attributions.sort((a, b) => b.causalScore - a.causalScore),
        pivotalStep,
        rootCause: parsed.rootCause ?? 'Unknown',
        recommendations: parsed.recommendations ?? [],
        budgetUsed: Math.min(budget, run.steps.length),
        confidence: pivotalStep ? pivotalStep.confidence : 0.3,
      };

      incCounter('causal_replay_attributed', 'Causal attributions made', 1, {
        pivotal: pivotalStep ? 'true' : 'false',
      });

      log.info(
        { runId: run.id, pivotalStep: pivotalStep?.stepIndex, rootCause: result.rootCause.slice(0, 80) },
        'causal analysis complete',
      );

      return result;
    } catch (err) {
      log.error({ err, runId: run.id }, 'causal analysis failed');
      return this.emptyResult(run.id, err instanceof Error ? err.message : 'Analysis failed');
    }
  }

  async analyzeSteps(
    steps: AgentStep[],
    runId: string,
    budget: number = 5,
  ): Promise<CausalReplayResult> {
    const fakeRun: AgentRun = {
      id: runId,
      agentId: 'unknown',
      prompt: '',
      status: 'failed',
      maxSteps: steps.length,
      currentStep: steps.length,
      tokensUsed: 0,
      steps,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.analyzeRun(fakeRun, budget);
  }

  private describeStep(step: AgentStep): string {
    const parts: string[] = [];
    if (step.plan) parts.push(`Plan: ${step.plan.slice(0, 100)}`);
    if (step.action) parts.push(`Tool: ${step.action.name}`);
    if (step.observation) {
      parts.push(step.observation.success ? 'Result: success' : `Result: ${step.observation.error ?? 'failed'}`);
    }
    if (step.reflection) parts.push(`Reflection: ${step.reflection.slice(0, 100)}`);
    return parts.join(' | ') || `Step ${step.index} (${step.status})`;
  }

  private parseAttribution(content: string): {
    attributions: Array<{ stepIndex: number; causalScore: number; reasoning: string; isPivotal: boolean }>;
    rootCause: string;
    recommendations: string[];
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { attributions: [], rootCause: 'Parse failed', recommendations: [] };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        attributions: Array.isArray(raw.attributions) ? raw.attributions : [],
        rootCause: String(raw.rootCause ?? ''),
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
      };
    } catch {
      return { attributions: [], rootCause: 'Parse failed', recommendations: [] };
    }
  }

  private emptyResult(runId: string, reason: string): CausalReplayResult {
    return {
      runId,
      totalSteps: 0,
      attributions: [],
      pivotalStep: null,
      rootCause: reason,
      recommendations: [],
      budgetUsed: 0,
      confidence: 0,
    };
  }
}
