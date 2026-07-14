import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { metaLearningResults as mlrRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'meta-learning' });

interface LearningConfig {
  id: string;
  learningRate: number;
  explorationRate: number;
  batchSize: number;
  strategyWeights: Map<string, number>;
  toolPreferences: Map<string, number>;
  promptTemplates: Map<string, string>;
  updatedAt: Date;
}

interface OptimizationResult {
  id: string;
  configBefore: { learningRate: number; explorationRate: number; batchSize: number };
  configAfter: { learningRate: number; explorationRate: number; batchSize: number };
  strategyChanges: Array<{ strategy: string; oldWeight: number; newWeight: number; reason: string }>;
  toolChanges: Array<{ tool: string; oldPref: number; newPref: number; reason: string }>;
  promptChanges: Array<{ key: string; oldTemplate: string; newTemplate: string }>;
  improvement: number;
  confidence: number;
  reasoning: string;
  createdAt: Date;
}

interface MetaLearningStats {
  totalOptimizations: number;
  currentLearningRate: number;
  currentExplorationRate: number;
  currentBatchSize: number;
  strategyCount: number;
  toolCount: number;
  promptCount: number;
  avgImprovement: number;
  bestImprovement: number;
}

const OPTIMIZE_PROMPT = `You are a meta-learning optimizer. Given the agent's recent performance data and current configuration, propose optimal adjustments.

Meta-learning principles:
1. If success rate is high → decrease exploration (exploit what works)
2. If success rate is low → increase exploration (try new things)
3. If a strategy consistently fails → reduce its weight
4. If a strategy consistently succeeds → increase its weight
5. Adjust learning rate based on performance volatility
6. Optimize batch size based on data volume

Respond in JSON:
{
  "learningRate": 0.001-1.0,
  "explorationRate": 0.01-0.5,
  "batchSize": 1-100,
  "strategyAdjustments": [
    { "strategy": "name", "newWeight": 0-1, "reason": "why" }
  ],
  "toolAdjustments": [
    { "tool": "name", "newPreference": 0-1, "reason": "why" }
  ],
  "promptAdjustments": [
    { "key": "template key", "newTemplate": "improved prompt" }
  ],
  "improvement": -100 to 100,
  "confidence": 0-1,
  "reasoning": "overall explanation"
}`;

export class MetaLearningOptimizer {
  private config: LearningConfig;
  private results: OptimizationResult[] = [];
  private maxResults = 100;

  constructor(private llm: LlmProvider) {
    this.config = {
      id: randomUUID().slice(0, 8),
      learningRate: 0.01,
      explorationRate: 0.1,
      batchSize: 32,
      strategyWeights: new Map(),
      toolPreferences: new Map(),
      promptTemplates: new Map(),
      updatedAt: new Date(),
    };
  }

  async optimize(performanceData: {
    successRate: number;
    avgDuration: number;
    avgTokens: number;
    strategyStats: Array<{ strategy: string; successRate: number; uses: number }>;
    toolStats: Array<{ tool: string; successRate: number; uses: number }>;
    recentErrors: string[];
  }): Promise<OptimizationResult> {
    const optimizationId = randomUUID().slice(0, 8);
    const configBefore = {
      learningRate: this.config.learningRate,
      explorationRate: this.config.explorationRate,
      batchSize: this.config.batchSize,
    };

    log.info({ optimizationId, successRate: performanceData.successRate }, 'meta-learning optimization started');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: OPTIMIZE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            currentConfig: {
              learningRate: this.config.learningRate,
              explorationRate: this.config.explorationRate,
              batchSize: this.config.batchSize,
              strategyWeights: Object.fromEntries(this.config.strategyWeights),
              toolPreferences: Object.fromEntries(this.config.toolPreferences),
            },
            performance: performanceData,
          }),
        },
      ], { temperature: 0.2, maxTokens: 1000 });

      const parsed = this.parseOptimization(response.content);

      // Apply new configuration
      this.config.learningRate = parsed.learningRate;
      this.config.explorationRate = parsed.explorationRate;
      this.config.batchSize = parsed.batchSize;

      // Apply strategy weight changes
      const strategyChanges: OptimizationResult['strategyChanges'] = [];
      for (const adj of parsed.strategyAdjustments) {
        const oldWeight = this.config.strategyWeights.get(adj.strategy) ?? 0.5;
        this.config.strategyWeights.set(adj.strategy, adj.newWeight);
        strategyChanges.push({
          strategy: adj.strategy,
          oldWeight,
          newWeight: adj.newWeight,
          reason: adj.reason,
        });
      }

      // Apply tool preference changes
      const toolChanges: OptimizationResult['toolChanges'] = [];
      for (const adj of parsed.toolAdjustments) {
        const oldPref = this.config.toolPreferences.get(adj.tool) ?? 0.5;
        this.config.toolPreferences.set(adj.tool, adj.newPreference);
        toolChanges.push({
          tool: adj.tool,
          oldPref,
          newPref: adj.newPreference,
          reason: adj.reason,
        });
      }

      // Apply prompt template changes
      const promptChanges: OptimizationResult['promptChanges'] = [];
      for (const adj of parsed.promptAdjustments) {
        const oldTemplate = this.config.promptTemplates.get(adj.key) ?? '';
        this.config.promptTemplates.set(adj.key, adj.newTemplate);
        promptChanges.push({
          key: adj.key,
          oldTemplate,
          newTemplate: adj.newTemplate,
        });
      }

      this.config.updatedAt = new Date();

      const result: OptimizationResult = {
        id: optimizationId,
        configBefore,
        configAfter: {
          learningRate: this.config.learningRate,
          explorationRate: this.config.explorationRate,
          batchSize: this.config.batchSize,
        },
        strategyChanges,
        toolChanges,
        promptChanges,
        improvement: parsed.improvement,
        confidence: parsed.confidence,
        reasoning: parsed.reasoning,
        createdAt: new Date(),
      };

      this.results.push(result);
      if (this.results.length > this.maxResults) {
        this.results = this.results.slice(-this.maxResults);
      }
      mlrRepo.insert(result.id, { optimization_type: 'meta-learning', target: '', before_score: 0, after_score: 0, improvement: result.improvement, config: JSON.stringify(result.configAfter) }).catch((err) => log.error({ err }, 'DB write failed'));

      incCounter('meta_learning_optimization', 'Meta-learning optimizations', 1, {
        improved: parsed.improvement > 0 ? 'true' : 'false',
      });

      log.info(
        { optimizationId, improvement: parsed.improvement, confidence: parsed.confidence },
        'meta-learning optimization complete',
      );

      return result;
    } catch (err) {
      log.error({ err, optimizationId }, 'meta-learning optimization failed');
      return {
        id: optimizationId,
        configBefore,
        configAfter: configBefore,
        strategyChanges: [],
        toolChanges: [],
        promptChanges: [],
        improvement: 0,
        confidence: 0,
        reasoning: 'Optimization failed',
        createdAt: new Date(),
      };
    }
  }

  getConfig(): LearningConfig {
    return this.config;
  }

  getStrategyWeight(strategy: string): number {
    return this.config.strategyWeights.get(strategy) ?? 0.5;
  }

  getToolPreference(tool: string): number {
    return this.config.toolPreferences.get(tool) ?? 0.5;
  }

  getPromptTemplate(key: string): string | undefined {
    return this.config.promptTemplates.get(key);
  }

  getResults(): OptimizationResult[] {
    return this.results;
  }

  stats(): MetaLearningStats {
    const total = this.results.length;
    const improvements = this.results.map((r) => r.improvement);
    const avgImprovement = total > 0 ? improvements.reduce((s, i) => s + i, 0) / total : 0;
    const bestImprovement = total > 0 ? Math.max(...improvements) : 0;

    return {
      totalOptimizations: total,
      currentLearningRate: this.config.learningRate,
      currentExplorationRate: this.config.explorationRate,
      currentBatchSize: this.config.batchSize,
      strategyCount: this.config.strategyWeights.size,
      toolCount: this.config.toolPreferences.size,
      promptCount: this.config.promptTemplates.size,
      avgImprovement: Math.round(avgImprovement * 100) / 100,
      bestImprovement: Math.round(bestImprovement * 100) / 100,
    };
  }

  clear(): void {
    this.results = [];
  }

  private parseOptimization(content: string): {
    learningRate: number;
    explorationRate: number;
    batchSize: number;
    strategyAdjustments: Array<{ strategy: string; newWeight: number; reason: string }>;
    toolAdjustments: Array<{ tool: string; newPreference: number; reason: string }>;
    promptAdjustments: Array<{ key: string; newTemplate: string }>;
    improvement: number;
    confidence: number;
    reasoning: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);

      return {
        learningRate: Math.max(0.001, Math.min(1, Number(raw.learningRate ?? 0.01))),
        explorationRate: Math.max(0.01, Math.min(0.5, Number(raw.explorationRate ?? 0.1))),
        batchSize: Math.max(1, Math.min(100, Math.round(Number(raw.batchSize ?? 32)))),
        strategyAdjustments: Array.isArray(raw.strategyAdjustments)
          ? raw.strategyAdjustments.map((a: Record<string, unknown>) => ({
              strategy: String(a.strategy ?? ''),
              newWeight: Math.max(0, Math.min(1, Number(a.newWeight ?? 0.5))),
              reason: String(a.reason ?? ''),
            }))
          : [],
        toolAdjustments: Array.isArray(raw.toolAdjustments)
          ? raw.toolAdjustments.map((a: Record<string, unknown>) => ({
              tool: String(a.tool ?? ''),
              newPreference: Math.max(0, Math.min(1, Number(a.newPreference ?? 0.5))),
              reason: String(a.reason ?? ''),
            }))
          : [],
        promptAdjustments: Array.isArray(raw.promptAdjustments)
          ? raw.promptAdjustments.map((a: Record<string, unknown>) => ({
              key: String(a.key ?? ''),
              newTemplate: String(a.newTemplate ?? ''),
            }))
          : [],
        improvement: Math.max(-100, Math.min(100, Number(raw.improvement ?? 0))),
        confidence: Math.max(0, Math.min(1, Number(raw.confidence ?? 0.5))),
        reasoning: String(raw.reasoning ?? ''),
      };
    } catch {
      return {
        learningRate: this.config.learningRate,
        explorationRate: this.config.explorationRate,
        batchSize: this.config.batchSize,
        strategyAdjustments: [],
        toolAdjustments: [],
        promptAdjustments: [],
        improvement: 0,
        confidence: 0,
        reasoning: 'Parse failed',
      };
    }
  }
}
