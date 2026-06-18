import { getLogger } from '@titan/logging';
import type { CostEntry, CostReport } from './types.js';

const log = getLogger().child({ component: 'cost-tracker' });

// Pricing per 1M tokens (approximate, as of 2025)
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10, output: 30 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-4-8': { input: 15, output: 75 },
  'claude-haiku-4-5': { input: 0.8, output: 4 },
  'default': { input: 1, output: 3 },
};

export class CostTracker {
  private entries: CostEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries = 10000) {
    this.maxEntries = maxEntries;
  }

  record(entry: Omit<CostEntry, 'estimatedCost'>): void {
    const pricing = MODEL_PRICING[entry.model] ?? MODEL_PRICING['default'];
    const estimatedCost = (entry.inputTokens * pricing.input + entry.outputTokens * pricing.output) / 1_000_000;

    this.entries.push({ ...entry, estimatedCost });

    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    log.debug({
      runId: entry.runId,
      model: entry.model,
      tokens: entry.totalTokens,
      cost: `$${estimatedCost.toFixed(6)}`,
    }, 'cost recorded');
  }

  recordSimple(runId: string, model: string, tokensUsed: number): void {
    const inputRatio = 0.6;
    this.record({
      runId,
      model,
      inputTokens: Math.round(tokensUsed * inputRatio),
      outputTokens: Math.round(tokensUsed * (1 - inputRatio)),
      totalTokens: tokensUsed,
      timestamp: new Date(),
    });
  }

  getReport(from?: Date, to?: Date): CostReport {
    const now = new Date();
    const periodFrom = from ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const periodTo = to ?? now;

    const filtered = this.entries.filter(
      (e) => e.timestamp >= periodFrom && e.timestamp <= periodTo,
    );

    const byModel: CostReport['byModel'] = {};
    let totalCost = 0;
    let totalTokens = 0;

    for (const entry of filtered) {
      totalCost += entry.estimatedCost;
      totalTokens += entry.totalTokens;

      if (!byModel[entry.model]) {
        byModel[entry.model] = { cost: 0, tokens: 0, calls: 0 };
      }
      byModel[entry.model].cost += entry.estimatedCost;
      byModel[entry.model].tokens += entry.totalTokens;
      byModel[entry.model].calls++;
    }

    return {
      period: { from: periodFrom, to: periodTo },
      totalCost,
      totalTokens,
      byModel,
      entries: filtered.length,
    };
  }

  getTotalCost(): number {
    return this.entries.reduce((s, e) => s + e.estimatedCost, 0);
  }

  getRunCost(runId: string): number {
    return this.entries
      .filter((e) => e.runId === runId)
      .reduce((s, e) => s + e.estimatedCost, 0);
  }

  clear(): void {
    this.entries = [];
  }
}
