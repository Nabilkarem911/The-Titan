import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { hyperAgentCycles as hacRepo, hyperAgentPatterns as hapRepo, hyperAgentPerformance as hapfRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'hyper-agent' });

interface HyperAgentCycle {
  id: string;
  cycleNumber: number;
  phase: 'introspect' | 'improve' | 'evaluate' | 'decide';
  introspection: {
    weaknesses: string[];
    strengths: string[];
    improvementTargets: string[];
  };
  improvements: Array<{
    target: string;
    change: string;
    rationale: string;
    expectedGain: number;
  }>;
  evaluation: {
    applied: boolean;
    actualGain: number;
    regression: boolean;
    rolledBack: boolean;
  };
  decision: 'keep' | 'rollback' | 'defer';
  timestamp: Date;
}

interface HyperAgentStats {
  totalCycles: number;
  totalImprovements: number;
  keptImprovements: number;
  rolledBackImprovements: number;
  avgGain: number;
  bestGain: number;
  currentPerformance: number;
  improvementHistory: Array<{ cycle: number; gain: number; kept: boolean }>;
}

const INTROSPECT_PROMPT = `You are a HyperAgent introspection module. Analyze the agent's recent performance and identify:

1. Weaknesses — areas where the agent underperformed
2. Strengths — areas where the agent excelled
3. Improvement targets — specific, actionable changes that could improve performance

Recent performance data: {performance}
Recent failure patterns: {failures}
Recent success patterns: {successes}

Respond in JSON:
{
  "weaknesses": ["specific weakness 1", ...],
  "strengths": ["specific strength 1", ...],
  "improvementTargets": ["specific actionable target 1", ...]
}`;

const IMPROVE_PROMPT = `You are a HyperAgent improvement module. Given improvement targets, propose concrete changes.

Improvement targets: {targets}
Current configuration: {config}

For each target, propose a specific change with expected gain.

Respond in JSON:
{
  "improvements": [
    { "target": "the target", "change": "specific change", "rationale": "why", "expectedGain": 0-1 }
  ]
}`;

export class HyperAgent {
  private cycles: HyperAgentCycle[] = [];
  private maxCycles = 100;
  private currentPerformance = 0.5;
  private performanceHistory: number[] = [];
  private failurePatterns: string[] = [];
  private successPatterns: string[] = [];
  private currentConfig: Record<string, unknown> = {};
  private running = false;
  private intervalMs = 60000;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private llm: LlmProvider) {}

  async runCycle(): Promise<HyperAgentCycle> {
    const cycleId = randomUUID().slice(0, 8);
    const cycleNumber = this.cycles.length + 1;
    const startedAt = new Date();

    log.info({ cycleId, cycleNumber }, 'HyperAgent cycle started');

    // Phase 1: Introspect
    const introspection = await this.introspect(cycleId, cycleNumber);

    // Phase 2: Improve
    const improvements = await this.proposeImprovements(cycleId, cycleNumber, introspection.improvementTargets);

    // Phase 3: Evaluate (simulate)
    const evaluation = this.evaluateImprovements(improvements);

    // Phase 4: Decide
    const decision: 'keep' | 'rollback' | 'defer' = evaluation.regression
      ? 'rollback'
      : evaluation.actualGain > 0.01 ? 'keep' : 'defer';

    if (decision === 'keep') {
      this.currentPerformance = Math.min(1, this.currentPerformance + evaluation.actualGain);
      for (const imp of improvements) {
        this.successPatterns.push(imp.change);
        hapRepo.insert('success', imp.change).catch((err) => log.error({ err }, 'DB write failed'));
      }
    } else if (decision === 'rollback') {
      for (const imp of improvements) {
        this.failurePatterns.push(imp.change);
        hapRepo.insert('failure', imp.change).catch((err) => log.error({ err }, 'DB write failed'));
      }
    }

    this.performanceHistory.push(this.currentPerformance);
    hapfRepo.insert(this.currentPerformance).catch((err) => log.error({ err }, 'DB write failed'));
    if (this.performanceHistory.length > 50) {
      this.performanceHistory = this.performanceHistory.slice(-50);
    }

    const cycle: HyperAgentCycle = {
      id: cycleId,
      cycleNumber,
      phase: 'decide',
      introspection,
      improvements,
      evaluation,
      decision,
      timestamp: startedAt,
    };

    this.cycles.push(cycle);
    if (this.cycles.length > this.maxCycles) {
      this.cycles = this.cycles.slice(-this.maxCycles);
    }
    hacRepo.insert(cycle.id, { cycle: cycle.cycleNumber, improvement: cycle.improvements.map(i => i.change).join('; '), gain: cycle.evaluation.actualGain, kept: cycle.decision === 'keep', config: JSON.stringify(this.currentConfig) }).catch((err) => log.error({ err }, 'DB write failed'));

    incCounter('hyperagent_cycle', 'HyperAgent cycles', 1, { decision });
    log.info({ cycleId, cycleNumber, decision, gain: evaluation.actualGain, performance: this.currentPerformance }, 'HyperAgent cycle complete');

    return cycle;
  }

  start(intervalMs?: number): void {
    if (this.running) return;
    this.running = true;
    if (intervalMs) this.intervalMs = intervalMs;
    this.timer = setInterval(() => {
      this.runCycle().catch((err) => log.error({ err }, 'HyperAgent cycle failed'));
    }, this.intervalMs);
    log.info({ intervalMs: this.intervalMs }, 'HyperAgent started');
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    log.info('HyperAgent stopped');
  }

  isRunning(): boolean {
    return this.running;
  }

  getCycles(): HyperAgentCycle[] {
    return this.cycles;
  }

  getPerformanceHistory(): number[] {
    return this.performanceHistory;
  }

  setConfig(config: Record<string, unknown>): void {
    this.currentConfig = config;
  }

  getConfig(): Record<string, unknown> {
    return this.currentConfig;
  }

  stats(): HyperAgentStats {
    const kept = this.cycles.filter((c) => c.decision === 'keep');
    const rolledBack = this.cycles.filter((c) => c.decision === 'rollback');
    const gains = kept.map((c) => c.evaluation.actualGain);

    return {
      totalCycles: this.cycles.length,
      totalImprovements: this.cycles.reduce((s, c) => s + c.improvements.length, 0),
      keptImprovements: kept.length,
      rolledBackImprovements: rolledBack.length,
      avgGain: gains.length > 0 ? Math.round((gains.reduce((s, g) => s + g, 0) / gains.length) * 100) / 100 : 0,
      bestGain: gains.length > 0 ? Math.max(...gains) : 0,
      currentPerformance: Math.round(this.currentPerformance * 100) / 100,
      improvementHistory: this.cycles.slice(-20).map((c) => ({
        cycle: c.cycleNumber,
        gain: c.evaluation.actualGain,
        kept: c.decision === 'keep',
      })),
    };
  }

  private async introspect(cycleId: string, _cycleNumber: number): Promise<HyperAgentCycle['introspection']> {
    try {
      const response = await this.llm.complete([
        {
          role: 'system',
          content: INTROSPECT_PROMPT
            .replace('{performance}', String(this.currentPerformance))
            .replace('{failures}', JSON.stringify(this.failurePatterns.slice(-10)))
            .replace('{successes}', JSON.stringify(this.successPatterns.slice(-10))),
        },
        { role: 'user', content: 'Run introspection cycle.' },
      ], { temperature: 0.3, maxTokens: 400 });

      const parsed = this.parseIntrospection(response.content);
      log.info({ cycleId, weaknesses: parsed.weaknesses.length, targets: parsed.improvementTargets.length }, 'introspection complete');
      return parsed;
    } catch (err) {
      log.error({ err, cycleId }, 'introspection failed');
      return { weaknesses: [], strengths: [], improvementTargets: [] };
    }
  }

  private async proposeImprovements(
    cycleId: string,
    _cycleNumber: number,
    targets: string[],
  ): Promise<HyperAgentCycle['improvements']> {
    if (targets.length === 0) return [];

    try {
      const response = await this.llm.complete([
        {
          role: 'system',
          content: IMPROVE_PROMPT
            .replace('{targets}', JSON.stringify(targets))
            .replace('{config}', JSON.stringify(this.currentConfig)),
        },
        { role: 'user', content: 'Propose improvements.' },
      ], { temperature: 0.4, maxTokens: 500 });

      const parsed = this.parseImprovements(response.content);
      log.info({ cycleId, improvements: parsed.length }, 'improvements proposed');
      return parsed;
    } catch (err) {
      log.error({ err, cycleId }, 'improvement proposal failed');
      return [];
    }
  }

  private evaluateImprovements(improvements: HyperAgentCycle['improvements']): HyperAgentCycle['evaluation'] {
    const expectedGain = improvements.reduce((s, i) => s + i.expectedGain, 0);
    const actualGain = expectedGain * (0.7 + Math.random() * 0.5);
    const regression = actualGain < -0.05;
    const applied = true;

    return {
      applied,
      actualGain: Math.round(actualGain * 100) / 100,
      regression,
      rolledBack: regression,
    };
  }

  private parseIntrospection(content: string): HyperAgentCycle['introspection'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        weaknesses: Array.isArray(raw.weaknesses) ? raw.weaknesses.map(String) : [],
        strengths: Array.isArray(raw.strengths) ? raw.strengths.map(String) : [],
        improvementTargets: Array.isArray(raw.improvementTargets) ? raw.improvementTargets.map(String) : [],
      };
    } catch {
      return { weaknesses: [], strengths: [], improvementTargets: [] };
    }
  }

  private parseImprovements(content: string): HyperAgentCycle['improvements'] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return Array.isArray(raw.improvements)
        ? raw.improvements.map((i: Record<string, unknown>) => ({
            target: String(i.target ?? ''),
            change: String(i.change ?? ''),
            rationale: String(i.rationale ?? ''),
            expectedGain: Math.max(0, Math.min(1, Number(i.expectedGain ?? 0.1))),
          }))
        : [];
    } catch {
      return [];
    }
  }
}
