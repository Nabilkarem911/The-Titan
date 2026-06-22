import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider, LlmMessage } from '../types.js';
import type { DigitalTwin } from './digital-twin.js';

const log = getLogger().child({ component: 'what-if-engine' });

export interface WhatIfResult {
  scenarios: Array<{
    id: string;
    name: string;
    action: string;
    probability: number;
    confidenceInterval: [number, number];
    outcomes: string[];
    risks: string[];
    duration: string;
  }>;
  recommendation: string;
  tokensUsed: number;
}

const WHAT_IF_PROMPT = `You are a What-If simulation engine for Titan's Digital Twin.

Given the current system state and a hypothetical action, generate 2-3 possible scenarios.
For each scenario, provide:
- Name (short label)
- Probability (0-1)
- Confidence interval (lower, upper)
- Likely outcomes (bullet points)
- Risks (bullet points)
- Estimated duration

Also provide an overall recommendation.

Respond in JSON:
{
  "scenarios": [
    {
      "name": "Best Case",
      "action": "what happens",
      "probability": 0.0-1.0,
      "confidenceInterval": [0.0, 1.0],
      "outcomes": ["outcome1", "outcome2"],
      "risks": ["risk1"],
      "duration": "estimated time"
    }
  ],
  "recommendation": "overall recommendation"
}`;

const MAX_SCENARIOS = 3;
const MAX_TOKENS = 800;
const SIMULATION_TIMEOUT_MS = 30_000;

export class WhatIfEngine {
  private twin: DigitalTwin;
  private llm: LlmProvider;

  constructor(twin: DigitalTwin, llm: LlmProvider) {
    this.twin = twin;
    this.llm = llm;
  }

  async simulate(
    action: string,
    target: string,
    params?: Record<string, unknown>,
  ): Promise<WhatIfResult> {
    incCounter('what_if_simulations', 'What-If simulations run', 1);

    const state = this.twin.getState();
    const lastSnapshot = state.lastSnapshot;

    const context = {
      action,
      target,
      params: params ?? {},
      systemState: lastSnapshot ? {
        cpuUsage: lastSnapshot.cpuUsage,
        memoryUsed: lastSnapshot.memoryUsed,
        memoryTotal: lastSnapshot.memoryTotal,
        memoryFree: lastSnapshot.memoryFree,
        processCount: lastSnapshot.processes?.length ?? 0,
      } : 'no data',
      trends: state.trends.map((t) => ({
        metric: t.metric,
        trend: t.trend,
        severity: t.severity,
        hoursToThreshold: t.hoursToThreshold,
      })),
      anomalies: state.anomalies.map((a) => ({
        metric: a.metric,
        type: a.anomalyType,
        description: a.description,
      })),
      activeAlerts: state.alerts.map((a) => ({
        severity: a.severity,
        message: a.message,
      })),
    };

    const messages: LlmMessage[] = [
      { role: 'system', content: WHAT_IF_PROMPT },
      { role: 'user', content: `Simulate this action:\n${JSON.stringify(context, null, 2)}` },
    ];

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Simulation timeout')), SIMULATION_TIMEOUT_MS),
      );

      const completion = await Promise.race([
        this.llm.complete(messages, { temperature: 0.2, maxTokens: MAX_TOKENS }),
        timeoutPromise,
      ]);

      const parsed = this.parseResult(completion.content, action);

      if (parsed.scenarios.length === 0) {
        log.warn({ action }, 'LLM returned no parseable scenarios — using heuristics');
        return {
          scenarios: this.generateHeuristicScenarios(action, target, state),
          recommendation: parsed.recommendation || 'Unable to parse simulation results. Proceed with caution.',
          tokensUsed: completion.tokensUsed,
        };
      }

      log.info({
        action,
        scenarioCount: parsed.scenarios.length,
        tokensUsed: completion.tokensUsed,
      }, 'what-if simulation completed');

      return {
        scenarios: parsed.scenarios.slice(0, MAX_SCENARIOS),
        recommendation: parsed.recommendation,
        tokensUsed: completion.tokensUsed,
      };
    } catch (err) {
      log.error({ err, action }, 'what-if simulation failed');

      // Fallback: heuristic-based scenarios
      return {
        scenarios: this.generateHeuristicScenarios(action, target, state),
        recommendation: 'Unable to run full simulation. Proceed with caution and monitor closely.',
        tokensUsed: 0,
      };
    }
  }

  private parseResult(content: string, action: string): WhatIfResult {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { scenarios: [], recommendation: content.slice(0, 500), tokensUsed: 0 };
      }

      const raw = JSON.parse(jsonMatch[0]) as {
        scenarios?: Array<{
          name?: string;
          action?: string;
          probability?: number;
          confidenceInterval?: [number, number];
          outcomes?: string[];
          risks?: string[];
          duration?: string;
        }>;
        recommendation?: string;
      };

      const scenarios = (raw.scenarios ?? []).map((s, i) => ({
        id: `scenario-${i}-${Date.now()}`,
        name: s.name ?? `Scenario ${i + 1}`,
        action: s.action ?? action,
        probability: Math.max(0, Math.min(1, s.probability ?? 0.5)),
        confidenceInterval: s.confidenceInterval ?? [0, 1] as [number, number],
        outcomes: Array.isArray(s.outcomes) ? s.outcomes : [],
        risks: Array.isArray(s.risks) ? s.risks : [],
        duration: s.duration ?? 'unknown',
      }));

      return {
        scenarios,
        recommendation: raw.recommendation ?? 'No recommendation available',
        tokensUsed: 0,
      };
    } catch {
      return { scenarios: [], recommendation: 'Failed to parse simulation results', tokensUsed: 0 };
    }
  }

  private generateHeuristicScenarios(
    action: string,
    target: string,
    state: { trends: Array<{ metric: string; severity: string }>; anomalies: Array<{ metric: string; isAnomaly: boolean }> },
  ): WhatIfResult['scenarios'] {
    const hasCriticalTrend = state.trends.some((t) => t.severity === 'critical');
    const hasAnomaly = state.anomalies.some((a) => a.isAnomaly);

    return [
      {
        id: `heuristic-best-${Date.now()}`,
        name: 'Best Case',
        action: `${action} on ${target}`,
        probability: hasCriticalTrend ? 0.3 : 0.7,
        confidenceInterval: [0.5, 0.9],
        outcomes: ['Action completes successfully', 'System remains stable'],
        risks: hasAnomaly ? ['Existing anomalies may worsen'] : [],
        duration: '1-5 minutes',
      },
      {
        id: `heuristic-worst-${Date.now()}`,
        name: 'Worst Case',
        action: `${action} on ${target}`,
        probability: hasCriticalTrend ? 0.4 : 0.1,
        confidenceInterval: [0.05, 0.3],
        outcomes: ['Action fails', 'System may become unstable'],
        risks: ['Service downtime', 'Data loss possible', 'Cascading failures'],
        duration: '10-30 minutes recovery',
      },
    ];
  }
}
