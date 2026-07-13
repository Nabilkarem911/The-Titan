import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { modelRouterUsage as mruRepo } from '@titan/database';

const log = getLogger().child({ component: 'multi-model-router' });

export type RouterModelTier = 'slm' | 'medium' | 'large' | 'xlarge';

export interface RouterModelConfig {
  id: string;
  tier: RouterModelTier;
  provider: string;
  model: string;
  maxTokens: number;
  costPer1kTokens: number;
  latencyMs: number;
  capabilities: string[];
}

export interface RoutingDecision {
  modelId: string;
  tier: RouterModelTier;
  reasoning: string;
  estimatedCost: number;
  estimatedLatency: number;
  complexityScore: number;
  routingFactors: Record<string, number>;
}

export interface RoutingStats {
  totalRequests: number;
  byTier: Array<{ tier: RouterModelTier; count: number; pct: number }>;
  byModel: Array<{ modelId: string; count: number }>;
  totalCost: number;
  avgLatency: number;
  costSavingsVsLargeOnly: number;
  avgComplexityScore: number;
}

interface ModelUsageRecord {
  modelId: string;
  tier: RouterModelTier;
  cost: number;
  latency: number;
  complexityScore: number;
  timestamp: Date;
}

const DEFAULT_MODELS: RouterModelConfig[] = [
  {
    id: 'slm-1',
    tier: 'slm',
    provider: 'openai-compatible',
    model: 'gpt-4o-mini',
    maxTokens: 16000,
    costPer1kTokens: 0.00015,
    latencyMs: 200,
    capabilities: ['simple-qa', 'classification', 'formatting', 'extraction'],
  },
  {
    id: 'medium-1',
    tier: 'medium',
    provider: 'openai-compatible',
    model: 'gpt-4o',
    maxTokens: 128000,
    costPer1kTokens: 0.005,
    latencyMs: 800,
    capabilities: ['reasoning', 'coding', 'analysis', 'summarization', 'translation'],
  },
  {
    id: 'large-1',
    tier: 'large',
    provider: 'openai-compatible',
    model: 'o3',
    maxTokens: 200000,
    costPer1kTokens: 0.015,
    latencyMs: 3000,
    capabilities: ['complex-reasoning', 'multi-step-planning', 'debugging', 'architecture', 'research'],
  },
  {
    id: 'xlarge-1',
    tier: 'xlarge',
    provider: 'anthropic',
    model: 'claude-opus-4',
    maxTokens: 200000,
    costPer1kTokens: 0.075,
    latencyMs: 6000,
    capabilities: ['ultra-complex', 'creative', 'long-context', 'agentic', 'multi-agent'],
  },
];

export class SmartModelRouter {
  private models: Map<string, RouterModelConfig> = new Map();
  private usage: ModelUsageRecord[] = [];
  private maxUsageRecords = 1000;

  constructor(models?: RouterModelConfig[]) {
    const modelList = models ?? DEFAULT_MODELS;
    for (const m of modelList) {
      this.models.set(m.id, m);
    }
    log.info({ modelCount: this.models.size }, 'SmartModelRouter initialized');
  }

  route(
    input: string,
    opts?: {
      taskType?: string;
      maxLatencyMs?: number;
      maxCost?: number;
      requiredCapabilities?: string[];
      preferTier?: RouterModelTier;
    },
  ): RoutingDecision {
    const complexity = this.assessComplexity(input, opts?.taskType);
    const factors: Record<string, number> = {
      inputLength: Math.min(1, input.length / 5000),
      complexityScore: complexity,
      capabilityMatch: 0,
      latencyConstraint: opts?.maxLatencyMs ? 1 : 0,
      costConstraint: opts?.maxCost ? 1 : 0,
    };

    let bestModel: RouterModelConfig | null = null;
    let bestScore = -Infinity;
    let reasoning = '';

    for (const model of this.models.values()) {
      if (opts?.maxLatencyMs && model.latencyMs > opts.maxLatencyMs) continue;
      if (opts?.maxCost && model.costPer1kTokens > opts.maxCost) continue;

      if (opts?.requiredCapabilities) {
        const hasAll = opts.requiredCapabilities.every((c) => model.capabilities.includes(c));
        if (!hasAll) continue;
      }

      let score = 0;
      const tierMatch = this.tierToScore(model.tier);
      const complexityMatch = 1 - Math.abs(tierMatch - complexity);
      score += complexityMatch * 0.5;

      if (opts?.preferTier === model.tier) score += 0.2;

      const capabilityOverlap = opts?.taskType && model.capabilities.includes(opts.taskType) ? 0.15 : 0;
      score += capabilityOverlap;

      const costEfficiency = 1 - (model.costPer1kTokens / 0.075);
      score += costEfficiency * 0.15;

      if (score > bestScore) {
        bestScore = score;
        bestModel = model;
        reasoning = `Complexity ${complexity.toFixed(2)} → tier ${model.tier} (match: ${(complexityMatch * 100).toFixed(0)}%)`;
      }
    }

    if (!bestModel) {
      bestModel = this.models.get('medium-1') ?? DEFAULT_MODELS[1];
      reasoning = 'Fallback to medium tier (no model matched constraints)';
    }

    factors.capabilityMatch = bestModel.capabilities.length / 10;

    const estimatedCost = bestModel.costPer1kTokens * Math.min(bestModel.maxTokens, input.length / 4);
    const estimatedLatency = bestModel.latencyMs;

    const decision: RoutingDecision = {
      modelId: bestModel.id,
      tier: bestModel.tier,
      reasoning,
      estimatedCost: Math.round(estimatedCost * 10000) / 10000,
      estimatedLatency,
      complexityScore: Math.round(complexity * 100) / 100,
      routingFactors: factors,
    };

    this.recordUsage(decision, estimatedCost, estimatedLatency);
    incCounter('mmr_route', 'Model routing decisions', 1, { tier: decision.tier });
    log.info({ modelId: decision.modelId, tier: decision.tier, complexity: decision.complexityScore }, 'routing decision');

    return decision;
  }

  addModel(config: RouterModelConfig): void {
    this.models.set(config.id, config);
    log.info({ modelId: config.id, tier: config.tier }, 'model added');
  }

  removeModel(id: string): boolean {
    return this.models.delete(id);
  }

  getModels(): RouterModelConfig[] {
    return Array.from(this.models.values());
  }

  getModelsByTier(tier: RouterModelTier): RouterModelConfig[] {
    return this.getModels().filter((m) => m.tier === tier);
  }

  stats(): RoutingStats {
    const total = this.usage.length;
    if (total === 0) {
      return {
        totalRequests: 0,
        byTier: [],
        byModel: [],
        totalCost: 0,
        avgLatency: 0,
        costSavingsVsLargeOnly: 0,
        avgComplexityScore: 0,
      };
    }

    const byTierMap = new Map<RouterModelTier, number>();
    const byModelMap = new Map<string, number>();
    let totalCost = 0;
    let totalLatency = 0;
    let totalComplexity = 0;
    let largeOnlyCost = 0;

    const largeModel = this.models.get('large-1');
    const largeCost = largeModel?.costPer1kTokens ?? 0.015;

    for (const rec of this.usage) {
      byTierMap.set(rec.tier, (byTierMap.get(rec.tier) ?? 0) + 1);
      byModelMap.set(rec.modelId, (byModelMap.get(rec.modelId) ?? 0) + 1);
      totalCost += rec.cost;
      totalLatency += rec.latency;
      totalComplexity += rec.complexityScore;
      largeOnlyCost += largeCost * 1000;
    }

    return {
      totalRequests: total,
      byTier: Array.from(byTierMap.entries()).map(([tier, count]) => ({
        tier,
        count,
        pct: Math.round((count / total) * 100),
      })),
      byModel: Array.from(byModelMap.entries()).map(([modelId, count]) => ({ modelId, count })),
      totalCost: Math.round(totalCost * 10000) / 10000,
      avgLatency: Math.round(totalLatency / total),
      costSavingsVsLargeOnly: largeOnlyCost > 0 ? Math.round(((largeOnlyCost - totalCost) / largeOnlyCost) * 100) : 0,
      avgComplexityScore: Math.round((totalComplexity / total) * 100) / 100,
    };
  }

  clearUsage(): void {
    this.usage = [];
  }

  private assessComplexity(input: string, taskType?: string): number {
    let score = 0;
    score += Math.min(0.3, input.length / 10000);
    const questionMarks = (input.match(/\?/g) ?? []).length;
    score += Math.min(0.1, questionMarks * 0.03);
    const codeBlocks = (input.match(/```/g) ?? []).length / 2;
    score += Math.min(0.15, codeBlocks * 0.05);
    const multiStep = /\b(step|then|after|next|finally|first|second)\b/gi;
    const multiStepCount = (input.match(multiStep) ?? []).length;
    score += Math.min(0.15, multiStepCount * 0.03);
    const complexKeywords = /\b(architect|design|optimize|debug|analyze|refactor|integrate|orchestrat)\b/gi;
    const complexCount = (input.match(complexKeywords) ?? []).length;
    score += Math.min(0.2, complexCount * 0.05);
    if (taskType) {
      const complexTypes = ['complex-reasoning', 'multi-step-planning', 'debugging', 'architecture', 'research', 'ultra-complex', 'agentic'];
      if (complexTypes.includes(taskType)) score += 0.2;
    }
    return Math.min(1, score);
  }

  private tierToScore(tier: RouterModelTier): number {
    switch (tier) {
      case 'slm': return 0.15;
      case 'medium': return 0.45;
      case 'large': return 0.75;
      case 'xlarge': return 0.95;
    }
  }

  private recordUsage(decision: RoutingDecision, cost: number, latency: number): void {
    this.usage.push({
      modelId: decision.modelId,
      tier: decision.tier,
      cost,
      latency,
      complexityScore: decision.complexityScore,
      timestamp: new Date(),
    });
    if (this.usage.length > this.maxUsageRecords) {
      this.usage = this.usage.slice(-this.maxUsageRecords);
    }
    mruRepo.insert(randomUUID().slice(0, 12), { model: decision.modelId, task_type: decision.tier, tokens_used: 0, latency_ms: latency, success: true }).catch((err) => log.error({ err }, 'DB write failed'));
  }
}
