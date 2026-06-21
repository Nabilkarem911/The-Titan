import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider } from '../types.js';
import type { EnvironmentGraph, ObservedEvent } from './environment-graph.js';

const log = getLogger().child({ component: 'world-simulator' });

export interface SimulationResult {
  action: string;
  predictedOutcome: 'success' | 'failure' | 'risky' | 'unknown';
  confidence: number;
  risks: string[];
  recommendations: string[];
  similarPastEvents: ObservedEvent[];
  shouldProceed: boolean;
}

const SIMULATOR_PROMPT = `You are a world model simulator for an AI agent. You predict what will happen if a specific action is taken.

Based on the action description and past event history, predict:
1. Will this action succeed or fail?
2. What are the risks?
3. What precautions should be taken?

Respond in JSON:
{
  "predictedOutcome": "success" | "failure" | "risky" | "unknown",
  "confidence": 0-100,
  "risks": ["risk1", "risk2"],
  "recommendations": ["rec1", "rec2"],
  "shouldProceed": true | false
}`;

const DANGEROUS_PATTERNS = [
  'rm ', 'delete', 'drop', 'shutdown', 'reboot', 'kill', 'truncate',
  'overwrite', 'force', 'reset', 'wipe', 'destroy', 'purge',
];

export class WorldSimulator {
  private graph: EnvironmentGraph;

  constructor(
    private llm: LlmProvider,
    graph: EnvironmentGraph,
  ) {
    this.graph = graph;
  }

  async simulate(action: string, target: string, params?: Record<string, unknown>): Promise<SimulationResult> {
    // 1. Check past events for similar actions
    const pastEvents = this.graph.getRecentEvents(200).filter(
      (e) => e.action.includes(action) || e.target.includes(target),
    );

    // 2. Get impact graph
    const impact = this.graph.getImpactGraph(action, target);

    // 3. Heuristic risk assessment
    const isDangerous = DANGEROUS_PATTERNS.some((p) => action.toLowerCase().includes(p));
    const pastFailures = pastEvents.filter((e) => e.result === 'failure');
    const failureRate = pastEvents.length > 0 ? pastFailures.length / pastEvents.length : 0;

    // 4. If low risk and no history of failures, fast-path
    if (!isDangerous && failureRate < 0.2 && pastEvents.length > 3) {
      return {
        action,
        predictedOutcome: 'success',
        confidence: 80,
        risks: [],
        recommendations: [],
        similarPastEvents: pastEvents.slice(-5),
        shouldProceed: true,
      };
    }

    // 5. LLM-based simulation for risky/unknown actions
    try {
      const response = await this.llm.complete([
        { role: 'system', content: SIMULATOR_PROMPT },
        { role: 'user', content: JSON.stringify({
          action,
          target,
          params: params ?? {},
          pastEvents: pastEvents.slice(-10).map((e) => ({
            action: e.action,
            result: e.result,
            durationMs: e.durationMs,
          })),
          impactScope: impact,
          isDangerous,
        }) },
      ], {
        temperature: 0.1,
        maxTokens: 800,
      });

      const parsed = this.parseSimulation(response.content);
      if (parsed) {
        incCounter('world_simulator_run', 'World simulator predictions', 1, {
          outcome: parsed.predictedOutcome,
        });
        return { ...parsed, action, similarPastEvents: pastEvents.slice(-5) };
      }
    } catch (err) {
      log.warn({ err }, 'world simulator LLM call failed — using heuristics');
    }

    // 6. Fallback heuristic
    const predictedOutcome = isDangerous ? 'risky' : failureRate > 0.5 ? 'failure' : 'unknown';
    return {
      action,
      predictedOutcome,
      confidence: 50,
      risks: isDangerous ? ['Action contains dangerous pattern'] : [],
      recommendations: isDangerous ? ['Consider safer alternative', 'Backup before proceeding'] : [],
      similarPastEvents: pastEvents.slice(-5),
      shouldProceed: !isDangerous || failureRate < 0.5,
    };
  }

  private parseSimulation(content: string): Omit<SimulationResult, 'action' | 'similarPastEvents'> | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const raw = JSON.parse(jsonMatch[0]);

      return {
        predictedOutcome: raw.predictedOutcome ?? 'unknown',
        confidence: Math.max(0, Math.min(100, Number(raw.confidence ?? 50))),
        risks: Array.isArray(raw.risks) ? raw.risks : [],
        recommendations: Array.isArray(raw.recommendations) ? raw.recommendations : [],
        shouldProceed: Boolean(raw.shouldProceed ?? true),
      };
    } catch {
      return null;
    }
  }
}
