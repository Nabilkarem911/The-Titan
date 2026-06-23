import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { heuristics as heuristicsRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'heuristic-extractor' });

export interface Heuristic {
  id: string;
  content: string;
  category: string;
  source: 'success' | 'failure';
  taskType: string;
  confidence: number;
  usageCount: number;
  successRate: number;
  createdAt: Date;
  lastUsed: Date | null;
}

export interface HeuristicMatch {
  heuristic: Heuristic;
  relevanceScore: number;
  matchedKeywords: string[];
}

export interface ExtractionResult {
  id: string;
  taskId: string;
  outcome: 'success' | 'failure';
  extractedHeuristics: Heuristic[];
  reasoning: string;
  createdAt: Date;
}

export interface HeuristicStats {
  totalHeuristics: number;
  fromSuccess: number;
  fromFailure: number;
  byCategory: Array<{ category: string; count: number }>;
  byTaskType: Array<{ taskType: string; count: number }>;
  avgConfidence: number;
  avgSuccessRate: number;
  totalUsage: number;
}

const EXTRACT_PROMPT = `You are a heuristic extraction module. Given a task trajectory and its outcome, extract transferable heuristics.

Heuristics are actionable lessons that can be applied to future tasks. They should be:
- Specific enough to be actionable
- General enough to transfer across tasks
- Focused on what worked (from success) or what to avoid (from failure)

Respond in JSON:
{
  "heuristics": [
    { "content": "the heuristic", "category": "planning|execution|debugging|optimization|communication", "confidence": 0-1 }
  ],
  "reasoning": "explanation"
}`;

export class HeuristicExtractor {
  private heuristics: Map<string, Heuristic> = new Map();
  private extractions: ExtractionResult[] = [];
  private maxExtractions = 200;

  constructor(private llm: LlmProvider) {}

  async extract(
    taskId: string,
    outcome: 'success' | 'failure',
    trajectory: string,
    taskType: string = 'general',
  ): Promise<ExtractionResult> {
    const extractionId = randomUUID().slice(0, 8);

    try {
      const response = await this.llm.complete([
        { role: 'system', content: EXTRACT_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            taskId,
            outcome,
            taskType,
            trajectory: trajectory.slice(0, 2000),
          }),
        },
      ], { temperature: 0.2, maxTokens: 500 });

      const parsed = this.parseExtraction(response.content);
      const extracted: Heuristic[] = [];

      for (const h of parsed.heuristics) {
        const id = randomUUID().slice(0, 8);
        const heuristic: Heuristic = {
          id,
          content: h.content,
          category: h.category,
          source: outcome,
          taskType,
          confidence: h.confidence,
          usageCount: 0,
          successRate: 0,
          createdAt: new Date(),
          lastUsed: null,
        };
        this.heuristics.set(id, heuristic);
        extracted.push(heuristic);
        heuristicsRepo.upsert({
          id: heuristic.id,
          content: heuristic.content,
          category: heuristic.category,
          source: heuristic.source,
          taskType: heuristic.taskType,
          confidence: heuristic.confidence,
          usageCount: heuristic.usageCount,
          successRate: heuristic.successRate,
          createdAt: heuristic.createdAt,
          lastUsed: heuristic.lastUsed,
        }).catch((err) => log.warn({ err, id: heuristic.id }, 'failed to persist heuristic'));
      }

      const result: ExtractionResult = {
        id: extractionId,
        taskId,
        outcome,
        extractedHeuristics: extracted,
        reasoning: parsed.reasoning,
        createdAt: new Date(),
      };

      this.extractions.push(result);
      if (this.extractions.length > this.maxExtractions) {
        this.extractions = this.extractions.slice(-this.maxExtractions);
      }

      incCounter('heuristic_extracted', 'Heuristics extracted', extracted.length, { outcome });
      log.info({ extractionId, taskId, outcome, count: extracted.length }, 'heuristics extracted');

      return result;
    } catch (err) {
      log.error({ err, extractionId }, 'heuristic extraction failed');
      return {
        id: extractionId,
        taskId,
        outcome,
        extractedHeuristics: [],
        reasoning: 'Extraction failed',
        createdAt: new Date(),
      };
    }
  }

  retrieve(taskDescription: string, topK: number = 5): HeuristicMatch[] {
    const taskLower = taskDescription.toLowerCase();
    const results: HeuristicMatch[] = [];

    for (const heuristic of this.heuristics.values()) {
      const contentLower = heuristic.content.toLowerCase();
      const keywords = contentLower.split(/\s+/).filter((w) => w.length > 3);
      const matchedKeywords: string[] = [];
      let score = 0;

      for (const kw of keywords) {
        if (taskLower.includes(kw)) {
          score += 2;
          matchedKeywords.push(kw);
        }
      }

      score += heuristic.confidence * 0.5;
      score += Math.min(0.3, heuristic.usageCount * 0.05);
      if (heuristic.successRate > 0) score += heuristic.successRate * 0.3;

      if (score > 0) {
        results.push({ heuristic, relevanceScore: score, matchedKeywords });
      }
    }

    const top = results.sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, topK);

    for (const match of top) {
      match.heuristic.usageCount++;
      match.heuristic.lastUsed = new Date();
    }

    return top;
  }

  recordUsage(heuristicId: string, success: boolean): void {
    const heuristic = this.heuristics.get(heuristicId);
    if (!heuristic) return;
    const total = heuristic.usageCount;
    heuristic.successRate = total > 0
      ? Math.round(((heuristic.successRate * (total - 1) + (success ? 1 : 0)) / total) * 100) / 100
      : success ? 1 : 0;
  }

  getHeuristic(id: string): Heuristic | null {
    return this.heuristics.get(id) ?? null;
  }

  getAllHeuristics(): Heuristic[] {
    return Array.from(this.heuristics.values());
  }

  getExtractions(): ExtractionResult[] {
    return this.extractions;
  }

  removeHeuristic(id: string): boolean {
    return this.heuristics.delete(id);
  }

  stats(): HeuristicStats {
    const all = Array.from(this.heuristics.values());
    const byCategoryMap = new Map<string, number>();
    const byTaskTypeMap = new Map<string, number>();

    for (const h of all) {
      byCategoryMap.set(h.category, (byCategoryMap.get(h.category) ?? 0) + 1);
      byTaskTypeMap.set(h.taskType, (byTaskTypeMap.get(h.taskType) ?? 0) + 1);
    }

    return {
      totalHeuristics: all.length,
      fromSuccess: all.filter((h) => h.source === 'success').length,
      fromFailure: all.filter((h) => h.source === 'failure').length,
      byCategory: Array.from(byCategoryMap.entries()).map(([category, count]) => ({ category, count })),
      byTaskType: Array.from(byTaskTypeMap.entries()).map(([taskType, count]) => ({ taskType, count })),
      avgConfidence: all.length > 0
        ? Math.round((all.reduce((s, h) => s + h.confidence, 0) / all.length) * 100) / 100
        : 0,
      avgSuccessRate: all.length > 0
        ? Math.round((all.reduce((s, h) => s + h.successRate, 0) / all.length) * 100) / 100
        : 0,
      totalUsage: all.reduce((s, h) => s + h.usageCount, 0),
    };
  }

  clear(): void {
    this.extractions = [];
    this.heuristics.clear();
  }

  private parseExtraction(content: string): {
    heuristics: Array<{ content: string; category: string; confidence: number }>;
    reasoning: string;
  } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('no JSON');
      const raw = JSON.parse(jsonMatch[0]);
      return {
        heuristics: Array.isArray(raw.heuristics)
          ? raw.heuristics.map((h: Record<string, unknown>) => ({
              content: String(h.content ?? ''),
              category: String(h.category ?? 'general'),
              confidence: Math.max(0, Math.min(1, Number(h.confidence ?? 0.5))),
            }))
          : [],
        reasoning: String(raw.reasoning ?? ''),
      };
    } catch {
      return { heuristics: [], reasoning: 'Parse failed' };
    }
  }
}
