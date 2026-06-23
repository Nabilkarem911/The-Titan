import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'meta-evolution' });

export interface EvolutionEntry {
  id: string;
  timestamp: Date;
  promptBefore: string;
  promptAfter: string;
  fitnessBefore: number;
  fitnessAfter: number;
  applied: boolean;
  rolledBack: boolean;
  domain: string;
}

export interface ABTestResult {
  id: string;
  variantA: string;
  variantB: string;
  scoresA: number[];
  scoresB: number[];
  winner: 'A' | 'B' | 'tie';
  confidence: number;
}

export interface CrossDomainTransfer {
  id: string;
  sourceDomain: string;
  targetDomain: string;
  pattern: string;
  adaptedPattern: string;
  confidence: number;
  applied: boolean;
}

const META_PROMPT = `You are Titan's meta-evolution engine. You modify your own improvement prompt to get better at self-improvement.

Analyze the current improvement prompt and propose a modified version that would produce better improvements.

Respond in JSON:
{
  "modifiedPrompt": "the new improvement prompt",
  "reasoning": "why this change should improve results",
  "expectedGain": 0.0-1.0
}`;

const TRANSFER_PROMPT = `You are a cross-domain transfer engine. Take a learning from one domain and adapt it for another.

Respond in JSON:
{
  "adaptedPattern": "the pattern adapted for the target domain",
  "confidence": 0.0-1.0,
  "reasoning": "why this transfer should work"
}`;

export class MetaEvolution {
  private llm: LlmProvider;
  private improvementPrompt: string;
  private evolutionArchive: EvolutionEntry[] = [];
  private abTestResults: ABTestResult[] = [];
  private transfers: CrossDomainTransfer[] = [];
  private maxArchiveSize = 1000;

  constructor(llm: LlmProvider, initialPrompt?: string) {
    this.llm = llm;
    this.improvementPrompt = initialPrompt ?? 'Analyze the task result and propose concrete improvements to the approach, tools, or strategy used.';
  }

  getImprovementPrompt(): string {
    return this.improvementPrompt;
  }

  async selfModifyPrompt(recentPerformance: { successRate: number; avgScore: number }): Promise<EvolutionEntry> {
    const entry: EvolutionEntry = {
      id: randomUUID(),
      timestamp: new Date(),
      promptBefore: this.improvementPrompt,
      promptAfter: this.improvementPrompt,
      fitnessBefore: recentPerformance.avgScore,
      fitnessAfter: recentPerformance.avgScore,
      applied: false,
      rolledBack: false,
      domain: 'meta-prompt',
    };

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: META_PROMPT },
        { role: 'user', content: `Current prompt: "${this.improvementPrompt}"\n\nRecent performance: success=${recentPerformance.successRate}%, avgScore=${recentPerformance.avgScore}` },
      ], { temperature: 0.3, maxTokens: 500 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const newPrompt = parsed.modifiedPrompt ?? this.improvementPrompt;
        const expectedGain = Math.max(0, Math.min(1, parsed.expectedGain ?? 0));

        entry.promptAfter = newPrompt;
        entry.fitnessAfter = recentPerformance.avgScore + expectedGain * 10;

        // Only apply if expected gain is positive
        if (expectedGain > 0.05) {
          this.improvementPrompt = newPrompt;
          entry.applied = true;
          log.info({ expectedGain, newPrompt: newPrompt.slice(0, 100) }, 'meta-prompt upgraded');
        } else {
          entry.applied = false;
          log.info({ expectedGain }, 'meta-prompt change rejected — insufficient expected gain');
        }
      }
    } catch (err) {
      log.error({ err }, 'meta-prompt modification failed');
    }

    this.addToArchive(entry);
    incCounter('meta_evolution_cycles', 'Meta-evolution cycles', 1);
    return entry;
  }

  async abTest(variantA: string, variantB: string, evaluator: (v: string) => number, runs: number = 5): Promise<ABTestResult> {
    const scoresA: number[] = [];
    const scoresB: number[] = [];

    for (let i = 0; i < runs; i++) {
      scoresA.push(evaluator(variantA));
      scoresB.push(evaluator(variantB));
    }

    const avgA = scoresA.reduce((s, v) => s + v, 0) / runs;
    const avgB = scoresB.reduce((s, v) => s + v, 0) / runs;
    const diff = Math.abs(avgA - avgB);
    const confidence = Math.min(1, diff / 10);

    const result: ABTestResult = {
      id: randomUUID(),
      variantA,
      variantB,
      scoresA,
      scoresB,
      winner: diff < 0.5 ? 'tie' : avgA > avgB ? 'A' : 'B',
      confidence,
    };

    this.abTestResults.push(result);
    incCounter('ab_tests', 'A/B tests run', 1);

    log.info({ winner: result.winner, confidence, avgA, avgB }, 'A/B test completed');
    return result;
  }

  async crossDomainTransfer(
    sourceDomain: string,
    targetDomain: string,
    pattern: string,
  ): Promise<CrossDomainTransfer> {
    const transfer: CrossDomainTransfer = {
      id: randomUUID(),
      sourceDomain,
      targetDomain,
      pattern,
      adaptedPattern: pattern,
      confidence: 0,
      applied: false,
    };

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: TRANSFER_PROMPT },
        { role: 'user', content: `Source: ${sourceDomain}\nTarget: ${targetDomain}\nPattern: "${pattern}"` },
      ], { temperature: 0.3, maxTokens: 500 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        transfer.adaptedPattern = parsed.adaptedPattern ?? pattern;
        transfer.confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
        transfer.applied = transfer.confidence > 0.4;
      }
    } catch (err) {
      log.error({ err }, 'cross-domain transfer failed');
    }

    this.transfers.push(transfer);
    incCounter('cross_domain_transfers', 'Cross-domain transfers', 1);
    return transfer;
  }

  rollbackLastEvolution(): EvolutionEntry | null {
    const last = this.evolutionArchive[this.evolutionArchive.length - 1];
    if (!last || !last.applied) return null;

    this.improvementPrompt = last.promptBefore;
    last.rolledBack = true;
    incCounter('meta_evolution_rollbacks', 'Meta-evolution rollbacks', 1);
    log.info({ entryId: last.id }, 'rolled back last evolution');
    return last;
  }

  getArchive(): EvolutionEntry[] {
    return [...this.evolutionArchive];
  }

  getABTestResults(): ABTestResult[] {
    return [...this.abTestResults];
  }

  getTransfers(): CrossDomainTransfer[] {
    return [...this.transfers];
  }

  getStats(): {
    totalEvolutions: number;
    appliedEvolutions: number;
    rolledBackEvolutions: number;
    abTests: number;
    transfers: number;
    appliedTransfers: number;
  } {
    return {
      totalEvolutions: this.evolutionArchive.length,
      appliedEvolutions: this.evolutionArchive.filter((e) => e.applied).length,
      rolledBackEvolutions: this.evolutionArchive.filter((e) => e.rolledBack).length,
      abTests: this.abTestResults.length,
      transfers: this.transfers.length,
      appliedTransfers: this.transfers.filter((t) => t.applied).length,
    };
  }

  reset(): void {
    this.evolutionArchive = [];
    this.abTestResults = [];
    this.transfers = [];
  }

  private addToArchive(entry: EvolutionEntry): void {
    this.evolutionArchive.push(entry);
    if (this.evolutionArchive.length > this.maxArchiveSize) {
      this.evolutionArchive.shift();
    }
    observeHistogram('meta_evolution_fitness', 'Evolution fitness', entry.fitnessAfter);
  }
}
