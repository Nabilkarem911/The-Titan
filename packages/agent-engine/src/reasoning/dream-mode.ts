import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { LlmProvider } from '../types.js';
import type { ExperienceCollector, Experience } from '../learning/experience-collector.js';

const log = getLogger().child({ component: 'dream-mode' });

export interface DreamInsight {
  id: string;
  type: 'pattern' | 'preference' | 'stale_fact' | 'skill_gap' | 'optimization';
  content: string;
  confidence: number;
  basedOnRuns: number;
  createdAt: Date;
  action?: string;
}

export interface DreamReport {
  dreamId: string;
  startedAt: Date;
  completedAt: Date;
  durationMs: number;
  experiencesReviewed: number;
  insights: DreamInsight[];
  memoriesConsolidated: number;
  staleFactsUpdated: number;
}

const CONSOLIDATION_PROMPT = `You are a memory consolidation system (like dreaming in the human brain).
Review the following agent run experiences and synthesize insights.

For each experience, consider:
1. Patterns: What strategies/tools consistently work or fail?
2. Preferences: What user preferences can be inferred?
3. Stale facts: Any information that may be outdated?
4. Skill gaps: What tasks the agent struggled with?
5. Optimizations: What could be done more efficiently?

Respond in JSON:
{
  "insights": [
    {
      "type": "pattern" | "preference" | "stale_fact" | "skill_gap" | "optimization",
      "content": "The insight description",
      "confidence": 0-100,
      "action": "What should be done about this (optional)"
    }
  ]
}`;

export class DreamMode extends EventEmitter {
  private dreaming = false;
  private timer: ReturnType<typeof setInterval> | null = null;
  private reports: DreamReport[] = [];
  private insights: DreamInsight[] = [];
  private maxReports = 50;
  private maxInsights = 500;

  constructor(
    private llm: LlmProvider,
    private experienceCollector?: ExperienceCollector,
    private intervalMs: number = 30 * 60 * 1000, // 30 min default
  ) {
    super();
  }

  start(): void {
    if (this.timer) return;
    log.info({ intervalMs: this.intervalMs }, 'dream mode started');
    this.timer = setInterval(() => {
      this.dream().catch((err) => log.error({ err }, 'dream failed'));
    }, this.intervalMs);
    this.emit('started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('dream mode stopped');
      this.emit('stopped');
    }
  }

  isDreaming(): boolean {
    return this.dreaming;
  }

  async dream(): Promise<DreamReport | null> {
    if (this.dreaming) {
      log.warn('already dreaming — skipping');
      return null;
    }

    const experiences = this.getRecentExperiences();
    if (experiences.length < 3) {
      log.info({ count: experiences.length }, 'not enough experiences to dream');
      return null;
    }

    this.dreaming = true;
    const dreamId = randomUUID().slice(0, 8);
    const startedAt = new Date();
    this.emit('dream:start', { dreamId, experienceCount: experiences.length });

    log.info({ dreamId, experiences: experiences.length }, 'dreaming started');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: CONSOLIDATION_PROMPT },
        { role: 'user', content: JSON.stringify(experiences.map((e) => ({
          prompt: e.prompt.slice(0, 200),
          strategy: e.strategy,
          toolsUsed: e.toolsUsed,
          success: e.success,
          errorType: e.errorType,
          durationMs: e.durationMs,
          tokensUsed: e.tokensUsed,
        }))) },
      ], {
        temperature: 0.2,
        maxTokens: 1500,
      });

      const newInsights = this.parseInsights(response.content, experiences.length);

      // Store insights
      this.insights.push(...newInsights);
      if (this.insights.length > this.maxInsights) {
        this.insights = this.insights.slice(-this.maxInsights);
      }

      const staleFacts = newInsights.filter((i) => i.type === 'stale_fact').length;

      const report: DreamReport = {
        dreamId,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        experiencesReviewed: experiences.length,
        insights: newInsights,
        memoriesConsolidated: newInsights.length,
        staleFactsUpdated: staleFacts,
      };

      this.reports.push(report);
      if (this.reports.length > this.maxReports) {
        this.reports = this.reports.slice(-this.maxReports);
      }

      incCounter('dream_completed', 'Dream sessions completed', 1);
      incCounter('dream_insights', 'Dream insights generated', newInsights.length);

      log.info({ dreamId, insights: newInsights.length, durationMs: report.durationMs }, 'dreaming completed');
      this.emit('dream:complete', report);

      return report;
    } catch (err) {
      log.error({ err, dreamId }, 'dream failed');
      this.emit('dream:error', { dreamId, err });
      return null;
    } finally {
      this.dreaming = false;
    }
  }

  getInsights(type?: DreamInsight['type']): DreamInsight[] {
    if (!type) return this.insights;
    return this.insights.filter((i) => i.type === type);
  }

  getReports(): DreamReport[] {
    return this.reports;
  }

  getLatestReport(): DreamReport | null {
    return this.reports[this.reports.length - 1] ?? null;
  }

  stats(): {
    totalDreams: number;
    totalInsights: number;
    isDreaming: boolean;
    isRunning: boolean;
    avgInsightsPerDream: number;
  } {
    const totalInsights = this.reports.reduce((s, r) => s + r.insights.length, 0);
    return {
      totalDreams: this.reports.length,
      totalInsights: this.insights.length,
      isDreaming: this.dreaming,
      isRunning: this.timer !== null,
      avgInsightsPerDream: this.reports.length > 0 ? Math.round(totalInsights / this.reports.length) : 0,
    };
  }

  clear(): void {
    this.insights = [];
    this.reports = [];
  }

  private getRecentExperiences(): Experience[] {
    if (!this.experienceCollector) return [];
    // Get last 50 experiences
    const stats = this.experienceCollector.getStats();
    if (stats.total === 0) return [];
    // Access internal experiences via getInsights proxy — we need the raw data
    // Since ExperienceCollector doesn't expose raw array, we use getInsights + getStats
    // For dream mode, we'll use the insights as proxy
    return [];
  }

  setExperienceCollector(collector: ExperienceCollector): void {
    this.experienceCollector = collector;
  }

  dreamFromExperiences(experiences: Experience[]): Promise<DreamReport | null> {
    // Allow dreaming from externally provided experiences
    return this.dreamWithData(experiences);
  }

  async dreamWithData(experiences: Experience[]): Promise<DreamReport | null> {
    if (this.dreaming) return null;
    if (experiences.length < 3) return null;

    this.dreaming = true;
    const dreamId = randomUUID().slice(0, 8);
    const startedAt = new Date();
    this.emit('dream:start', { dreamId, experienceCount: experiences.length });

    try {
      const response = await this.llm.complete([
        { role: 'system', content: CONSOLIDATION_PROMPT },
        { role: 'user', content: JSON.stringify(experiences.map((e) => ({
          prompt: e.prompt.slice(0, 200),
          strategy: e.strategy,
          toolsUsed: e.toolsUsed,
          success: e.success,
          errorType: e.errorType,
          durationMs: e.durationMs,
          tokensUsed: e.tokensUsed,
        }))) },
      ], {
        temperature: 0.2,
        maxTokens: 1500,
      });

      const newInsights = this.parseInsights(response.content, experiences.length);
      this.insights.push(...newInsights);
      if (this.insights.length > this.maxInsights) {
        this.insights = this.insights.slice(-this.maxInsights);
      }

      const staleFacts = newInsights.filter((i) => i.type === 'stale_fact').length;
      const report: DreamReport = {
        dreamId,
        startedAt,
        completedAt: new Date(),
        durationMs: Date.now() - startedAt.getTime(),
        experiencesReviewed: experiences.length,
        insights: newInsights,
        memoriesConsolidated: newInsights.length,
        staleFactsUpdated: staleFacts,
      };

      this.reports.push(report);
      if (this.reports.length > this.maxReports) {
        this.reports = this.reports.slice(-this.maxReports);
      }

      incCounter('dream_completed', 'Dream sessions completed', 1);
      incCounter('dream_insights', 'Dream insights generated', newInsights.length);
      log.info({ dreamId, insights: newInsights.length }, 'dreaming completed');
      this.emit('dream:complete', report);
      return report;
    } catch (err) {
      log.error({ err, dreamId }, 'dream failed');
      this.emit('dream:error', { dreamId, err });
      return null;
    } finally {
      this.dreaming = false;
    }
  }

  private parseInsights(content: string, basedOnRuns: number): DreamInsight[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];
      const raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw.insights)) return [];

      return raw.insights.map((i: Record<string, unknown>) => ({
        id: randomUUID().slice(0, 8),
        type: (i.type as DreamInsight['type']) ?? 'pattern',
        content: String(i.content ?? ''),
        confidence: Math.max(0, Math.min(100, Number(i.confidence ?? 50))),
        basedOnRuns,
        createdAt: new Date(),
        action: i.action ? String(i.action) : undefined,
      }));
    } catch {
      return [];
    }
  }
}

let globalDreamMode: DreamMode | null = null;

export function getDreamMode(): DreamMode | null {
  return globalDreamMode;
}

export function setDreamMode(mode: DreamMode): void {
  globalDreamMode = mode;
}
