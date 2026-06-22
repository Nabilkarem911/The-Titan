import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'temporal-intelligence' });

export interface TemporalEvent {
  id: string;
  timestamp: Date;
  description: string;
  category: string;
  metadata: Record<string, unknown>;
}

export interface TimelineBranch {
  id: string;
  name: string;
  probability: number;
  events: TemporalEvent[];
  outcome: string;
  confidence: number;
}

export interface TemporalPrediction {
  id: string;
  event: string;
  confidence: number;
  timeHorizon: string;
  expectedTime: Date | null;
  basedOn: string[];
}

export interface TemporalPattern {
  id: string;
  pattern: string;
  frequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
  confidence: number;
  examples: string[];
}

const MAX_BRANCHES = 5;
const MAX_SIMULATION_MS = 30_000;

const PREDICTION_PROMPT = `You are a temporal intelligence engine. Analyze past events and predict future outcomes.

Respond in JSON:
{
  "predictions": [{"event": "...", "confidence": 0.0-1.0, "timeHorizon": "hours|days|weeks", "basedOn": ["reason1"]}],
  "patterns": [{"pattern": "...", "frequency": "daily|weekly|monthly|irregular", "confidence": 0.0-1.0, "examples": ["ex1"]}]
}`;

export class TemporalIntelligence {
  private llm: LlmProvider;
  private events: TemporalEvent[] = [];
  private predictions: TemporalPrediction[] = [];
  private patterns: TemporalPattern[] = [];

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  recordEvent(description: string, category: string, metadata?: Record<string, unknown>): TemporalEvent {
    const event: TemporalEvent = {
      id: randomUUID(),
      timestamp: new Date(),
      description,
      category,
      metadata: metadata ?? {},
    };
    this.events.push(event);
    incCounter('temporal_events_recorded', 'Temporal events recorded', 1);
    return event;
  }

  recordHistoricalEvent(timestamp: Date, description: string, category: string, metadata?: Record<string, unknown>): TemporalEvent {
    const event: TemporalEvent = {
      id: randomUUID(),
      timestamp,
      description,
      category,
      metadata: metadata ?? {},
    };
    this.events.push(event);
    this.events.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    return event;
  }

  getEvents(): TemporalEvent[] {
    return [...this.events];
  }

  getEventsByCategory(category: string): TemporalEvent[] {
    return this.events.filter((e) => e.category === category);
  }

  getEventsInRange(start: Date, end: Date): TemporalEvent[] {
    return this.events.filter((e) => e.timestamp >= start && e.timestamp <= end);
  }

  analyzePast(): { totalEvents: number; categories: string[]; oldestEvent: Date | null; newestEvent: Date | null } {
    if (this.events.length === 0) {
      return { totalEvents: 0, categories: [], oldestEvent: null, newestEvent: null };
    }

    const categories = [...new Set(this.events.map((e) => e.category))];
    const oldest = this.events[0].timestamp;
    const newest = this.events[this.events.length - 1].timestamp;

    return {
      totalEvents: this.events.length,
      categories,
      oldestEvent: oldest,
      newestEvent: newest,
    };
  }

  async predictFuture(): Promise<{ predictions: TemporalPrediction[]; patterns: TemporalPattern[] }> {
    if (this.events.length === 0) {
      return { predictions: [], patterns: [] };
    }

    try {
      const eventsSummary = this.events.slice(-50).map((e) => ({
        time: e.timestamp.toISOString(),
        desc: e.description,
        cat: e.category,
      }));

      const completion = await this.llm.complete([
        { role: 'system', content: PREDICTION_PROMPT },
        { role: 'user', content: `Events:\n${JSON.stringify(eventsSummary, null, 2)}` },
      ], { temperature: 0.3, maxTokens: 1000 });

      const parsed = this.parsePredictions(completion.content);
      this.predictions = parsed.predictions;
      this.patterns = parsed.patterns;

      incCounter('temporal_predictions', 'Temporal predictions made', parsed.predictions.length);
      observeHistogram('temporal_prediction_confidence', 'Prediction confidence', parsed.predictions.reduce((s, p) => s + p.confidence, 0) / Math.max(1, parsed.predictions.length));

      return parsed;
    } catch (err) {
      log.error({ err }, 'prediction failed');
      return { predictions: [], patterns: [] };
    }
  }

  async exploreTimelineBranches(
    currentSituation: string,
    possibleActions: string[],
  ): Promise<TimelineBranch[]> {
    const limitedActions = possibleActions.slice(0, MAX_BRANCHES);

    const branches: TimelineBranch[] = [];

    for (const action of limitedActions) {
      const startTime = Date.now();

      try {
        if (Date.now() - startTime > MAX_SIMULATION_MS) break;

        const completion = await this.llm.complete([
          {
            role: 'system',
            content: 'You are a timeline simulation engine. Simulate the outcome of an action. Respond in JSON: {"outcome": "...", "probability": 0.0-1.0, "confidence": 0.0-1.0}',
          },
          {
            role: 'user',
            content: `Situation: ${currentSituation}\nAction: ${action}\n\nSimulate the timeline branch.`,
          },
        ], { temperature: 0.4, maxTokens: 500 });

        const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
        let outcome = 'Unknown outcome';
        let probability = 0.5;
        let confidence = 0.5;

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          outcome = parsed.outcome ?? outcome;
          probability = Math.max(0, Math.min(1, parsed.probability ?? 0.5));
          confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
        }

        branches.push({
          id: randomUUID(),
          name: action,
          probability,
          events: [],
          outcome,
          confidence,
        });
      } catch (err) {
        log.warn({ err, action }, 'timeline branch simulation failed');
      }
    }

    // Sort by probability * confidence
    branches.sort((a, b) => (b.probability * b.confidence) - (a.probability * a.confidence));

    incCounter('temporal_branches', 'Timeline branches explored', branches.length);
    return branches;
  }

  temporalReason(statement: string): { isTimeAware: boolean; reasoning: string } {
    const timeKeywords = ['yesterday', 'today', 'tomorrow', 'before', 'after', 'since', 'until', 'was', 'will', 'now', 'then', 'changed', 'became', 'previously'];
    const lower = statement.toLowerCase();
    const hasTimeKeyword = timeKeywords.some((k) => lower.includes(k));

    return {
      isTimeAware: hasTimeKeyword,
      reasoning: hasTimeKeyword
        ? 'Statement contains temporal references — time-aware reasoning applied'
        : 'No temporal references detected — static reasoning',
    };
  }

  scheduleOptimalTime(task: string, workingHours: { start: number; end: number }, timezone: string): { suggestedTime: string; reasoning: string } {
    const now = new Date();
    const currentHour = now.getHours();

    if (currentHour >= workingHours.start && currentHour < workingHours.end) {
      return {
        suggestedTime: `Now (${timezone})`,
        reasoning: 'Within working hours — execute immediately',
      };
    }

    if (currentHour < workingHours.start) {
      return {
        suggestedTime: `Today at ${workingHours.start}:00 (${timezone})`,
        reasoning: 'Before working hours — schedule for start of work day',
      };
    }

    return {
      suggestedTime: `Tomorrow at ${workingHours.start}:00 (${timezone})`,
      reasoning: 'After working hours — schedule for next work day',
    };
  }

  getPredictions(): TemporalPrediction[] {
    return [...this.predictions];
  }

  getPatterns(): TemporalPattern[] {
    return [...this.patterns];
  }

  getStats(): { events: number; predictions: number; patterns: number; categories: number } {
    return {
      events: this.events.length,
      predictions: this.predictions.length,
      patterns: this.patterns.length,
      categories: new Set(this.events.map((e) => e.category)).size,
    };
  }

  reset(): void {
    this.events = [];
    this.predictions = [];
    this.patterns = [];
  }

  private parsePredictions(content: string): { predictions: TemporalPrediction[]; patterns: TemporalPattern[] } {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { predictions: [], patterns: [] };

      const raw = JSON.parse(jsonMatch[0]);

      const predictions: TemporalPrediction[] = Array.isArray(raw.predictions) ? raw.predictions.map((p: any) => ({
        id: randomUUID(),
        event: p.event ?? 'unknown',
        confidence: Math.max(0, Math.min(1, p.confidence ?? 0.5)),
        timeHorizon: p.timeHorizon ?? 'unknown',
        expectedTime: null,
        basedOn: Array.isArray(p.basedOn) ? p.basedOn : [],
      })) : [];

      const patterns: TemporalPattern[] = Array.isArray(raw.patterns) ? raw.patterns.map((p: any) => ({
        id: randomUUID(),
        pattern: p.pattern ?? 'unknown',
        frequency: ['daily', 'weekly', 'monthly', 'irregular'].includes(p.frequency) ? p.frequency : 'irregular',
        confidence: Math.max(0, Math.min(1, p.confidence ?? 0.5)),
        examples: Array.isArray(p.examples) ? p.examples : [],
      })) : [];

      return { predictions, patterns };
    } catch {
      return { predictions: [], patterns: [] };
    }
  }
}
