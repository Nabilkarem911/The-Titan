import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { tomAnalyses as tomRepo, tomModels as tomModelsRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'theory-of-mind' });

export interface BeliefState {
  entityId: string;
  beliefs: Record<string, unknown>;
  desires: string[];
  intentions: string[];
  knowledge: string[];
  uncertainties: string[];
  emotions?: Record<string, number>;
  confidence: number;
  updatedAt: Date;
}

export interface PerspectiveModel {
  id: string;
  entityId: string;
  entityType: 'user' | 'agent' | 'system';
  beliefState: BeliefState;
  predictedActions: Array<{ action: string; probability: number; reasoning: string }>;
  perspectiveChain: string[];
  createdAt: Date;
}

export interface ToMAnalysisResult {
  id: string;
  targetEntityId: string;
  inferredBeliefs: Record<string, unknown>;
  inferredDesires: string[];
  inferredKnowledge: string[];
  predictedNextAction: string;
  predictionConfidence: number;
  recommendedResponse: string;
  perspectiveDepth: number;
  reasoning: string;
  createdAt: Date;
}

export interface ToMStats {
  totalAnalyses: number;
  avgConfidence: number;
  trackedEntities: number;
  predictionsMade: number;
  correctPredictions: number;
  accuracyRate: number;
}

const TOM_PROMPT = `You are a Theory of Mind module. Your job is to model the mental states of other entities (users, agents, systems).

Given:
1. The entity's recent messages/actions
2. The current context
3. Any known background

Infer:
1. What the entity believes (beliefs about the world, about you, about the task)
2. What the entity desires (goals, wants)
3. What the entity knows (factual knowledge they possess)
4. What the entity is uncertain about
5. What the entity will likely do next
6. How you should respond given their mental state

Consider nested beliefs (e.g., "they think I think they want X").

Respond in JSON:
{
  "inferredBeliefs": { "key": "value" },
  "inferredDesires": ["desire1", "desire2"],
  "inferredKnowledge": ["fact1", "fact2"],
  "uncertainties": ["uncertainty1"],
  "predictedNextAction": "what they'll likely do",
  "predictionConfidence": 0-1,
  "recommendedResponse": "how to respond",
  "perspectiveDepth": 1-3,
  "reasoning": "explanation"
}`;

export class TheoryOfMind {
  private models: Map<string, PerspectiveModel> = new Map();
  private analyses: ToMAnalysisResult[] = [];
  private maxAnalyses = 200;
  private predictionsMade = 0;
  private correctPredictions = 0;

  constructor(private llm: LlmProvider) {}

  async analyze(
    targetEntityId: string,
    context: {
      entityType?: 'user' | 'agent' | 'system';
      messages: Array<{ role: string; content: string }>;
      actions?: string[];
      background?: string;
      currentTask?: string;
    },
  ): Promise<ToMAnalysisResult> {
    const analysisId = randomUUID().slice(0, 8);

    log.info({ analysisId, targetEntityId }, 'ToM analysis started');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: TOM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            targetEntityId,
            entityType: context.entityType ?? 'user',
            messages: context.messages.slice(-10),
            actions: context.actions ?? [],
            background: context.background ?? '',
            currentTask: context.currentTask ?? '',
          }),
        },
      ], { temperature: 0.2, maxTokens: 600 });

      const parsed = this.parseAnalysis(response.content);

      const result: ToMAnalysisResult = {
        id: analysisId,
        targetEntityId,
        inferredBeliefs: parsed.inferredBeliefs,
        inferredDesires: parsed.inferredDesires,
        inferredKnowledge: parsed.inferredKnowledge,
        predictedNextAction: parsed.predictedNextAction,
        predictionConfidence: parsed.predictionConfidence,
        recommendedResponse: parsed.recommendedResponse,
        perspectiveDepth: parsed.perspectiveDepth,
        reasoning: parsed.reasoning,
        createdAt: new Date(),
      };

      this.analyses.push(result);
      if (this.analyses.length > this.maxAnalyses) {
        this.analyses = this.analyses.slice(-this.maxAnalyses);
      }
      tomRepo.insert(result.id, { entity_id: targetEntityId, perspective: result.recommendedResponse, confidence: result.predictionConfidence, prediction: result.predictedNextAction, correct: null }).catch(() => {});

      this.predictionsMade++;
      this.updateModel(targetEntityId, parsed, context.entityType ?? 'user');

      incCounter('tom_analysis', 'Theory of Mind analyses', 1);
      log.info({ analysisId, confidence: parsed.predictionConfidence, depth: parsed.perspectiveDepth }, 'ToM analysis complete');

      return result;
    } catch (err) {
      log.error({ err, analysisId }, 'ToM analysis failed');
      return {
        id: analysisId,
        targetEntityId,
        inferredBeliefs: {},
        inferredDesires: [],
        inferredKnowledge: [],
        predictedNextAction: 'unknown',
        predictionConfidence: 0,
        recommendedResponse: 'Proceed normally',
        perspectiveDepth: 0,
        reasoning: 'Analysis failed',
        createdAt: new Date(),
      };
    }
  }

  recordPredictionOutcome(targetEntityId: string, actualAction: string, predictedAction: string): void {
    const correct = actualAction.toLowerCase().includes(predictedAction.toLowerCase().slice(0, 20)) ||
      predictedAction.toLowerCase().includes(actualAction.toLowerCase().slice(0, 20));
    if (correct) this.correctPredictions++;
    log.info({ targetEntityId, correct, actualAction, predictedAction }, 'prediction outcome recorded');
  }

  getModel(entityId: string): PerspectiveModel | null {
    return this.models.get(entityId) ?? null;
  }

  getAllModels(): PerspectiveModel[] {
    return Array.from(this.models.values());
  }

  getAnalyses(targetEntityId?: string): ToMAnalysisResult[] {
    if (targetEntityId) return this.analyses.filter((a) => a.targetEntityId === targetEntityId);
    return this.analyses;
  }

  stats(): ToMStats {
    const total = this.analyses.length;
    const avgConf = total > 0
      ? Math.round((this.analyses.reduce((s, a) => s + a.predictionConfidence, 0) / total) * 100) / 100
      : 0;

    return {
      totalAnalyses: total,
      avgConfidence: avgConf,
      trackedEntities: this.models.size,
      predictionsMade: this.predictionsMade,
      correctPredictions: this.correctPredictions,
      accuracyRate: this.predictionsMade > 0
        ? Math.round((this.correctPredictions / this.predictionsMade) * 100)
        : 0,
    };
  }

  clear(): void {
    this.analyses = [];
    this.models.clear();
  }

  private updateModel(
    entityId: string,
    parsed: {
      inferredBeliefs: Record<string, unknown>;
      inferredDesires: string[];
      inferredKnowledge: string[];
      predictedNextAction: string;
      predictionConfidence: number;
      recommendedResponse: string;
      perspectiveDepth: number;
      reasoning: string;
    },
    entityType: 'user' | 'agent' | 'system',
  ): void {
    const existing = this.models.get(entityId);
    const beliefState: BeliefState = {
      entityId,
      beliefs: parsed.inferredBeliefs,
      desires: parsed.inferredDesires,
      intentions: [parsed.predictedNextAction],
      knowledge: parsed.inferredKnowledge,
      uncertainties: [],
      confidence: parsed.predictionConfidence,
      updatedAt: new Date(),
    };

    this.models.set(entityId, {
      id: randomUUID().slice(0, 8),
      entityId,
      entityType,
      beliefState,
      predictedActions: [{
        action: parsed.predictedNextAction,
        probability: parsed.predictionConfidence,
        reasoning: parsed.reasoning,
      }],
      perspectiveChain: existing?.perspectiveChain ?? [],
      createdAt: existing?.createdAt ?? new Date(),
    });
    tomModelsRepo.upsert(entityId, entityType, beliefState).catch(() => {});
  }

  private parseAnalysis(content: string): {
    inferredBeliefs: Record<string, unknown>;
    inferredDesires: string[];
    inferredKnowledge: string[];
    predictedNextAction: string;
    predictionConfidence: number;
    recommendedResponse: string;
    perspectiveDepth: number;
    reasoning: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        inferredBeliefs: raw.inferredBeliefs as Record<string, unknown> ?? {},
        inferredDesires: Array.isArray(raw.inferredDesires) ? raw.inferredDesires.map(String) : [],
        inferredKnowledge: Array.isArray(raw.inferredKnowledge) ? raw.inferredKnowledge.map(String) : [],
        predictedNextAction: String(raw.predictedNextAction ?? 'unknown'),
        predictionConfidence: Math.max(0, Math.min(1, Number(raw.predictionConfidence ?? 0.5))),
        recommendedResponse: String(raw.recommendedResponse ?? ''),
        perspectiveDepth: Math.max(0, Math.min(3, Number(raw.perspectiveDepth ?? 1))),
        reasoning: String(raw.reasoning ?? ''),
      };
    } catch {
      return {
        inferredBeliefs: {},
        inferredDesires: [],
        inferredKnowledge: [],
        predictedNextAction: 'unknown',
        predictionConfidence: 0,
        recommendedResponse: '',
        perspectiveDepth: 0,
        reasoning: 'Parse failed',
      };
    }
  }
}
