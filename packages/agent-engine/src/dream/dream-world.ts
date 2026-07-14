import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'dream-world' });

export interface DreamCycle {
  id: string;
  startTime: Date;
  endTime: Date | null;
  durationMs: number;
  visualDreams: VisualDream[];
  codeDreams: CodeDream[];
  crossModalSyntheses: CrossModalSynthesis[];
  hypotheses: DreamHypothesis[];
  creativeOutputs: CreativeDreamOutput[];
  memoryConsolidations: MemoryConsolidation[];
  insights: DreamWorldInsight[];
  insightPropagated: boolean;
}

export interface VisualDream {
  id: string;
  description: string;
  generatedImagePrompt: string;
  analysisResult: string;
}

export interface CodeDream {
  id: string;
  originalCode: string;
  alternativeArchitecture: string;
  analysisResult: string;
}

export interface CrossModalSynthesis {
  id: string;
  modalA: string;
  modalB: string;
  pattern: string;
  description: string;
}

export interface DreamHypothesis {
  id: string;
  hypothesis: string;
  testable: boolean;
  testResult: 'pending' | 'confirmed' | 'refuted' | 'inconclusive';
  confidence: number;
}

export interface CreativeDreamOutput {
  id: string;
  type: 'art' | 'music' | 'code';
  content: string;
  inspiredBy: string;
}

export interface MemoryConsolidation {
  id: string;
  memoriesMerged: number;
  memoriesForgotten: number;
  memoriesSynthesized: number;
  description: string;
}

export interface DreamWorldInsight {
  id: string;
  insight: string;
  category: string;
  confidence: number;
  validated: boolean;
}

const MAX_DURATION_MS = 30 * 60 * 1000; // 30 min
const DREAM_PROMPT = `You are Titan's dream synthesis engine. During idle time, Titan dreams.

Generate creative, cross-modal insights by combining experiences. Respond in JSON:
{
  "visualDreams": [{"description": "...", "generatedImagePrompt": "...", "analysisResult": "..."}],
  "codeDreams": [{"originalCode": "...", "alternativeArchitecture": "...", "analysisResult": "..."}],
  "crossModalSyntheses": [{"modalA": "...", "modalB": "...", "pattern": "...", "description": "..."}],
  "hypotheses": [{"hypothesis": "...", "testable": true, "confidence": 0.0-1.0}],
  "creativeOutputs": [{"type": "art|music|code", "content": "...", "inspiredBy": "..."}],
  "memoryConsolidations": [{"memoriesMerged": 0, "memoriesForgotten": 0, "memoriesSynthesized": 0, "description": "..."}],
  "insights": [{"insight": "...", "category": "...", "confidence": 0.0-1.0}]
}`;

export class DreamWorld {
  private llm: LlmProvider;
  private cycles: DreamCycle[] = [];
  private isDreaming = false;
  private maxDurationMs: number;

  constructor(llm: LlmProvider, maxDurationMs?: number) {
    this.llm = llm;
    this.maxDurationMs = maxDurationMs ?? MAX_DURATION_MS;
  }

  isIdle(): boolean {
    return !this.isDreaming;
  }

  async dream(experiences: string[]): Promise<DreamCycle> {
    const cycle: DreamCycle = {
      id: randomUUID(),
      startTime: new Date(),
      endTime: null,
      durationMs: 0,
      visualDreams: [],
      codeDreams: [],
      crossModalSyntheses: [],
      hypotheses: [],
      creativeOutputs: [],
      memoryConsolidations: [],
      insights: [],
      insightPropagated: false,
    };

    this.isDreaming = true;
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Dream timeout')), this.maxDurationMs),
      );

      const completion = await Promise.race([
        this.llm.complete([
          { role: 'system', content: DREAM_PROMPT },
          { role: 'user', content: `Recent experiences:\n${experiences.slice(0, 20).join('\n')}` },
        ], { temperature: 0.8, maxTokens: 2000 }),
        timeoutPromise,
      ]);

      const parsed = this.parseDream(completion.content);
      cycle.visualDreams = parsed.visualDreams;
      cycle.codeDreams = parsed.codeDreams;
      cycle.crossModalSyntheses = parsed.crossModalSyntheses;
      cycle.hypotheses = parsed.hypotheses;
      cycle.creativeOutputs = parsed.creativeOutputs;
      cycle.memoryConsolidations = parsed.memoryConsolidations;
      cycle.insights = parsed.insights;

      incCounter('dream_cycles', 'Dream cycles completed', 1);
      observeHistogram('dream_insights', 'Dream insights generated', cycle.insights.length);
    } catch (err) {
      log.warn({ err }, 'dream cycle failed or timed out — returning partial results');
    }

    cycle.endTime = new Date();
    cycle.durationMs = Date.now() - startTime;
    this.isDreaming = false;

    this.cycles.push(cycle);
    log.info({
      cycleId: cycle.id,
      durationMs: cycle.durationMs,
      insights: cycle.insights.length,
      visualDreams: cycle.visualDreams.length,
    }, 'dream cycle completed');

    return cycle;
  }

  propagateInsights(cycle: DreamCycle): DreamWorldInsight[] {
    const validated = cycle.insights.map((i) => ({
      ...i,
      validated: i.confidence > 0.7,
    }));

    cycle.insights = validated;
    cycle.insightPropagated = true;

    const validCount = validated.filter((i) => i.validated).length;
    incCounter('dream_insights_propagated', 'Dream insights propagated', validCount);

    log.info({ cycleId: cycle.id, propagated: validCount, total: validated.length }, 'insights propagated');

    return validated.filter((i) => i.validated);
  }

  getCycles(): DreamCycle[] {
    return [...this.cycles];
  }

  getLastCycle(): DreamCycle | null {
    return this.cycles.length > 0 ? this.cycles[this.cycles.length - 1] : null;
  }

  getStats(): {
    totalCycles: number;
    totalInsights: number;
    totalVisualDreams: number;
    totalCodeDreams: number;
    totalHypotheses: number;
    avgDurationMs: number;
  } {
    const totalInsights = this.cycles.reduce((s, c) => s + c.insights.length, 0);
    const totalVisual = this.cycles.reduce((s, c) => s + c.visualDreams.length, 0);
    const totalCode = this.cycles.reduce((s, c) => s + c.codeDreams.length, 0);
    const totalHypotheses = this.cycles.reduce((s, c) => s + c.hypotheses.length, 0);
    const avgDuration = this.cycles.length > 0
      ? this.cycles.reduce((s, c) => s + c.durationMs, 0) / this.cycles.length
      : 0;

    return {
      totalCycles: this.cycles.length,
      totalInsights,
      totalVisualDreams: totalVisual,
      totalCodeDreams: totalCode,
      totalHypotheses,
      avgDurationMs: avgDuration,
    };
  }

  reset(): void {
    this.cycles = [];
    this.isDreaming = false;
  }

  private parseDream(content: string): Omit<DreamCycle, 'id' | 'startTime' | 'endTime' | 'durationMs' | 'insightPropagated'> {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return this.emptyDream();

      const raw = JSON.parse(jsonMatch[0]);

      return {
        visualDreams: Array.isArray(raw.visualDreams) ? raw.visualDreams.map((v: any) => ({
          id: randomUUID(),
          description: v.description ?? '',
          generatedImagePrompt: v.generatedImagePrompt ?? '',
          analysisResult: v.analysisResult ?? '',
        })) : [],
        codeDreams: Array.isArray(raw.codeDreams) ? raw.codeDreams.map((v: any) => ({
          id: randomUUID(),
          originalCode: v.originalCode ?? '',
          alternativeArchitecture: v.alternativeArchitecture ?? '',
          analysisResult: v.analysisResult ?? '',
        })) : [],
        crossModalSyntheses: Array.isArray(raw.crossModalSyntheses) ? raw.crossModalSyntheses.map((v: any) => ({
          id: randomUUID(),
          modalA: v.modalA ?? '',
          modalB: v.modalB ?? '',
          pattern: v.pattern ?? '',
          description: v.description ?? '',
        })) : [],
        hypotheses: Array.isArray(raw.hypotheses) ? raw.hypotheses.map((v: any) => ({
          id: randomUUID(),
          hypothesis: v.hypothesis ?? '',
          testable: v.testable ?? false,
          testResult: 'pending' as const,
          confidence: Math.max(0, Math.min(1, v.confidence ?? 0.5)),
        })) : [],
        creativeOutputs: Array.isArray(raw.creativeOutputs) ? raw.creativeOutputs.map((v: any) => ({
          id: randomUUID(),
          type: v.type ?? 'art',
          content: v.content ?? '',
          inspiredBy: v.inspiredBy ?? '',
        })) : [],
        memoryConsolidations: Array.isArray(raw.memoryConsolidations) ? raw.memoryConsolidations.map((v: any) => ({
          id: randomUUID(),
          memoriesMerged: v.memoriesMerged ?? 0,
          memoriesForgotten: v.memoriesForgotten ?? 0,
          memoriesSynthesized: v.memoriesSynthesized ?? 0,
          description: v.description ?? '',
        })) : [],
        insights: Array.isArray(raw.insights) ? raw.insights.map((v: any) => ({
          id: randomUUID(),
          insight: v.insight ?? '',
          category: v.category ?? 'general',
          confidence: Math.max(0, Math.min(1, v.confidence ?? 0.5)),
          validated: false,
        })) : [],
      };
    } catch {
      return this.emptyDream();
    }
  }

  private emptyDream() {
    return {
      visualDreams: [],
      codeDreams: [],
      crossModalSyntheses: [],
      hypotheses: [],
      creativeOutputs: [],
      memoryConsolidations: [],
      insights: [],
    };
  }
}
