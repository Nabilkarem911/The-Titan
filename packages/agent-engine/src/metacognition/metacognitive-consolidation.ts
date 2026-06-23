import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { metacognitiveReflections as mcRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'metacognitive-consolidation' });

export interface InstanceReflection {
  id: string;
  taskId: string;
  outcome: 'success' | 'failure';
  reasoning: string;
  whatWorked: string[];
  whatFailed: string[];
  lessons: string[];
  createdAt: Date;
}

export interface MicroLesson {
  id: string;
  lessons: string[];
  pattern: string;
  frequency: number;
  confidence: number;
  createdAt: Date;
}

export interface MetaKnowledge {
  id: string;
  knowledge: string;
  category: string;
  confidence: number;
  evidenceCount: number;
  lastUpdated: Date;
  source: 'instance' | 'batch' | 'global';
}

export interface ConsolidationResult {
  id: string;
  instancesProcessed: number;
  microLessonsGenerated: number;
  metaKnowledgeUpdated: number;
  newMetaKnowledge: MetaKnowledge[];
  proceduralized: boolean;
  reasoning: string;
  createdAt: Date;
}

export interface ConsolidationStats {
  totalReflections: number;
  totalMicroLessons: number;
  totalMetaKnowledge: number;
  byCategory: Array<{ category: string; count: number }>;
  avgConfidence: number;
  lastConsolidation: Date | null;
}

const REFLECT_PROMPT = `You are a metacognitive reflection module. Reflect on a completed reasoning instance.

Given the task, outcome, and reasoning trace, extract:
1. What worked well
2. What failed or was inefficient
3. Reusable lessons for future tasks

Respond in JSON:
{
  "whatWorked": ["strategy/approach that succeeded"],
  "whatFailed": ["what went wrong or was suboptimal"],
  "lessons": ["transferable lesson with context"],
  "pattern": "the general pattern this represents"
}`;

const CONSOLIDATE_PROMPT = `You are a metacognitive consolidation module. Given a batch of instance-level reflections, consolidate them into batch-level micro-lessons.

Group similar lessons, identify patterns, and extract higher-level principles.

Respond in JSON:
{
  "microLessons": [
    { "lessons": ["lesson1", "lesson2"], "pattern": "common pattern", "confidence": 0-1 }
  ],
  "reasoning": "explanation of consolidation"
}`;

const PROCEDURALIZE_PROMPT = `You are a metacognitive proceduralization module. Given accumulated meta-knowledge, convert it into reusable procedural knowledge.

Transform declarative lessons into actionable procedures that can be applied to future tasks.

Respond in JSON:
{
  "procedures": [
    { "knowledge": "procedural knowledge", "category": "category", "confidence": 0-1 }
  ],
  "reasoning": "explanation"
}`;

export class MetacognitiveConsolidation {
  private reflections: InstanceReflection[] = [];
  private microLessons: MicroLesson[] = [];
  private metaKnowledge: Map<string, MetaKnowledge> = new Map();
  private maxReflections = 500;
  private maxMicroLessons = 100;
  private lastConsolidation: Date | null = null;

  constructor(private llm: LlmProvider) {}

  async reflect(
    taskId: string,
    outcome: 'success' | 'failure',
    reasoningTrace: string,
  ): Promise<InstanceReflection> {
    const reflectionId = randomUUID().slice(0, 8);

    try {
      const response = await this.llm.complete([
        { role: 'system', content: REFLECT_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({ taskId, outcome, reasoningTrace: reasoningTrace.slice(0, 1500) }),
        },
      ], { temperature: 0.2, maxTokens: 400 });

      const parsed = this.parseReflection(response.content);

      const reflection: InstanceReflection = {
        id: reflectionId,
        taskId,
        outcome,
        reasoning: reasoningTrace.slice(0, 500),
        whatWorked: parsed.whatWorked,
        whatFailed: parsed.whatFailed,
        lessons: parsed.lessons,
        createdAt: new Date(),
      };

      this.reflections.push(reflection);
      if (this.reflections.length > this.maxReflections) {
        this.reflections = this.reflections.slice(-this.maxReflections);
      }
      mcRepo.insert(reflection.id, { category: outcome, content: reflection.reasoning, confidence: 0.5, lesson: reflection.lessons.join('; ') }).catch(() => {});

      incCounter('mc_reflection', 'Metacognitive reflections', 1, { outcome });
      log.info({ reflectionId, taskId, outcome, lessons: parsed.lessons.length }, 'instance reflection complete');

      return reflection;
    } catch (err) {
      log.error({ err, reflectionId }, 'reflection failed');
      return {
        id: reflectionId,
        taskId,
        outcome,
        reasoning: reasoningTrace.slice(0, 500),
        whatWorked: [],
        whatFailed: [],
        lessons: [],
        createdAt: new Date(),
      };
    }
  }

  async consolidate(): Promise<ConsolidationResult> {
    const consolidationId = randomUUID().slice(0, 8);
    const batch = this.reflections.slice(-50);

    if (batch.length === 0) {
      return {
        id: consolidationId,
        instancesProcessed: 0,
        microLessonsGenerated: 0,
        metaKnowledgeUpdated: 0,
        newMetaKnowledge: [],
        proceduralized: false,
        reasoning: 'No reflections to consolidate',
        createdAt: new Date(),
      };
    }

    try {
      const response = await this.llm.complete([
        { role: 'system', content: CONSOLIDATE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            reflections: batch.map((r) => ({
              outcome: r.outcome,
              lessons: r.lessons,
              whatWorked: r.whatWorked,
              whatFailed: r.whatFailed,
            })),
          }),
        },
      ], { temperature: 0.2, maxTokens: 600 });

      const parsed = this.parseConsolidation(response.content);
      const newMetaKnowledge: MetaKnowledge[] = [];

      for (const ml of parsed.microLessons) {
        const microLesson: MicroLesson = {
          id: randomUUID().slice(0, 8),
          lessons: ml.lessons,
          pattern: ml.pattern,
          frequency: 1,
          confidence: ml.confidence,
          createdAt: new Date(),
        };
        this.microLessons.push(microLesson);

        for (const lesson of ml.lessons) {
          const existing = this.metaKnowledge.get(lesson);
          if (existing) {
            existing.evidenceCount++;
            existing.confidence = Math.min(1, existing.confidence + 0.05);
            existing.lastUpdated = new Date();
          } else {
            const mk: MetaKnowledge = {
              id: randomUUID().slice(0, 8),
              knowledge: lesson,
              category: ml.pattern,
              confidence: ml.confidence,
              evidenceCount: 1,
              lastUpdated: new Date(),
              source: 'batch',
            };
            this.metaKnowledge.set(lesson, mk);
            newMetaKnowledge.push(mk);
          }
        }
      }

      if (this.microLessons.length > this.maxMicroLessons) {
        this.microLessons = this.microLessons.slice(-this.maxMicroLessons);
      }

      this.lastConsolidation = new Date();
      incCounter('mc_consolidation', 'Metacognitive consolidations', 1);

      log.info(
        { consolidationId, instancesProcessed: batch.length, microLessons: parsed.microLessons.length, newMeta: newMetaKnowledge.length },
        'consolidation complete',
      );

      return {
        id: consolidationId,
        instancesProcessed: batch.length,
        microLessonsGenerated: parsed.microLessons.length,
        metaKnowledgeUpdated: this.metaKnowledge.size - newMetaKnowledge.length,
        newMetaKnowledge,
        proceduralized: false,
        reasoning: parsed.reasoning,
        createdAt: new Date(),
      };
    } catch (err) {
      log.error({ err, consolidationId }, 'consolidation failed');
      return {
        id: consolidationId,
        instancesProcessed: batch.length,
        microLessonsGenerated: 0,
        metaKnowledgeUpdated: 0,
        newMetaKnowledge: [],
        proceduralized: false,
        reasoning: 'Consolidation failed',
        createdAt: new Date(),
      };
    }
  }

  async proceduralize(): Promise<{ updated: number; newProcedures: MetaKnowledge[] }> {
    if (this.metaKnowledge.size === 0) {
      return { updated: 0, newProcedures: [] };
    }

    try {
      const knowledgeArray = Array.from(this.metaKnowledge.values());
      const response = await this.llm.complete([
        { role: 'system', content: PROCEDURALIZE_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            metaKnowledge: knowledgeArray.map((k) => ({ knowledge: k.knowledge, category: k.category, confidence: k.confidence })),
          }),
        },
      ], { temperature: 0.2, maxTokens: 600 });

      const parsed = this.parseProceduralization(response.content);
      const newProcedures: MetaKnowledge[] = [];
      let updated = 0;

      for (const proc of parsed.procedures) {
        const existing = this.metaKnowledge.get(proc.knowledge);
        if (existing) {
          existing.source = 'global';
          existing.confidence = Math.max(existing.confidence, proc.confidence);
          existing.lastUpdated = new Date();
          updated++;
        } else {
          const mk: MetaKnowledge = {
            id: randomUUID().slice(0, 8),
            knowledge: proc.knowledge,
            category: proc.category,
            confidence: proc.confidence,
            evidenceCount: 1,
            lastUpdated: new Date(),
            source: 'global',
          };
          this.metaKnowledge.set(proc.knowledge, mk);
          newProcedures.push(mk);
        }
      }

      incCounter('mc_proceduralization', 'Metacognitive proceduralizations', 1);
      log.info({ updated, newProcedures: newProcedures.length }, 'proceduralization complete');

      return { updated, newProcedures };
    } catch (err) {
      log.error({ err }, 'proceduralization failed');
      return { updated: 0, newProcedures: [] };
    }
  }

  getRelevantKnowledge(taskDescription: string, topK: number = 5): MetaKnowledge[] {
    const taskLower = taskDescription.toLowerCase();
    return Array.from(this.metaKnowledge.values())
      .map((mk) => {
        const knowledgeLower = mk.knowledge.toLowerCase();
        const categoryLower = mk.category.toLowerCase();
        let score = 0;
        for (const word of taskLower.split(/\s+/).filter((w) => w.length > 3)) {
          if (knowledgeLower.includes(word)) score += 2;
          if (categoryLower.includes(word)) score += 1;
        }
        score += mk.confidence * 0.5 + mk.evidenceCount * 0.1;
        return { mk, score };
      })
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
      .map((s) => s.mk);
  }

  getReflections(): InstanceReflection[] {
    return this.reflections;
  }

  getMicroLessons(): MicroLesson[] {
    return this.microLessons;
  }

  getMetaKnowledge(): MetaKnowledge[] {
    return Array.from(this.metaKnowledge.values());
  }

  stats(): ConsolidationStats {
    const byCategoryMap = new Map<string, number>();
    for (const mk of this.metaKnowledge.values()) {
      byCategoryMap.set(mk.category, (byCategoryMap.get(mk.category) ?? 0) + 1);
    }
    const avgConf = this.metaKnowledge.size > 0
      ? Math.round((Array.from(this.metaKnowledge.values()).reduce((s, mk) => s + mk.confidence, 0) / this.metaKnowledge.size) * 100) / 100
      : 0;

    return {
      totalReflections: this.reflections.length,
      totalMicroLessons: this.microLessons.length,
      totalMetaKnowledge: this.metaKnowledge.size,
      byCategory: Array.from(byCategoryMap.entries()).map(([category, count]) => ({ category, count })),
      avgConfidence: avgConf,
      lastConsolidation: this.lastConsolidation,
    };
  }

  clear(): void {
    this.reflections = [];
    this.microLessons = [];
    this.metaKnowledge.clear();
  }

  private parseReflection(content: string): { whatWorked: string[]; whatFailed: string[]; lessons: string[] } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        whatWorked: Array.isArray(raw.whatWorked) ? raw.whatWorked.map(String) : [],
        whatFailed: Array.isArray(raw.whatFailed) ? raw.whatFailed.map(String) : [],
        lessons: Array.isArray(raw.lessons) ? raw.lessons.map(String) : [],
      };
    } catch {
      return { whatWorked: [], whatFailed: [], lessons: [] };
    }
  }

  private parseConsolidation(content: string): {
    microLessons: Array<{ lessons: string[]; pattern: string; confidence: number }>;
    reasoning: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        microLessons: Array.isArray(raw.microLessons)
          ? raw.microLessons.map((ml: Record<string, unknown>) => ({
              lessons: Array.isArray(ml.lessons) ? ml.lessons.map(String) : [],
              pattern: String(ml.pattern ?? ''),
              confidence: Math.max(0, Math.min(1, Number(ml.confidence ?? 0.5))),
            }))
          : [],
        reasoning: String(raw.reasoning ?? ''),
      };
    } catch {
      return { microLessons: [], reasoning: 'Parse failed' };
    }
  }

  private parseProceduralization(content: string): {
    procedures: Array<{ knowledge: string; category: string; confidence: number }>;
    reasoning: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        procedures: Array.isArray(raw.procedures)
          ? raw.procedures.map((p: Record<string, unknown>) => ({
              knowledge: String(p.knowledge ?? ''),
              category: String(p.category ?? 'general'),
              confidence: Math.max(0, Math.min(1, Number(p.confidence ?? 0.5))),
            }))
          : [],
        reasoning: String(raw.reasoning ?? ''),
      };
    } catch {
      return { procedures: [], reasoning: 'Parse failed' };
    }
  }
}
