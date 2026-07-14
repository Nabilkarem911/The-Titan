import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'introspective-awareness' });

interface IntrospectionRecord {
  id: string;
  timestamp: Date;
  trigger: string;
  selfObservation: string;
  emotionalState: string;
  confidenceLevel: number;
  uncertaintySources: string[];
  biases: string[];
  growthOpportunities: string[];
  selfModification: string | null;
}

interface IntrospectiveSelfModel {
  id: string;
  capabilities: string[];
  limitations: string[];
  values: string[];
  goals: string[];
  currentEmotionalState: string;
  confidenceLevel: number;
  knownBiases: string[];
  lastUpdated: Date;
}

interface MetacognitionCheck {
  id: string;
  question: string;
  reasoning: string;
  conclusion: string;
  uncertainty: number;
  wouldAskHuman: boolean;
}

const INTROSPECTION_PROMPT = `You are Titan's introspective awareness module. Titan looks inward to understand itself.

Analyze the current situation and provide deep self-reflection. Respond in JSON:
{
  "selfObservation": "what Titan observes about itself",
  "emotionalState": "current state (curious, confident, uncertain, frustrated, etc.)",
  "confidenceLevel": 0.0-1.0,
  "uncertaintySources": ["source1", "source2"],
  "biases": ["bias1", "bias2"],
  "growthOpportunities": ["opportunity1"],
  "selfModification": "what Titan could change about itself, or null"
}`;

export class IntrospectiveAwareness {
  private llm: LlmProvider;
  private introspections: IntrospectionRecord[] = [];
  private selfModel: IntrospectiveSelfModel;
  private metacognitionChecks: MetacognitionCheck[] = [];

  constructor(llm: LlmProvider) {
    this.llm = llm;
    this.selfModel = this.createInitialSelfModel();
  }

  async introspect(trigger: string): Promise<IntrospectionRecord> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: INTROSPECTION_PROMPT },
        { role: 'user', content: `Trigger for introspection: ${trigger}\n\nCurrent self-model:\n${JSON.stringify(this.selfModel, null, 2)}` },
      ], { temperature: 0.4, maxTokens: 1000 });

      const parsed = this.parseIntrospection(completion.content, trigger);

      // Update self model
      this.selfModel.currentEmotionalState = parsed.emotionalState;
      this.selfModel.confidenceLevel = parsed.confidenceLevel;
      this.selfModel.lastUpdated = new Date();

      for (const bias of parsed.biases) {
        if (!this.selfModel.knownBiases.includes(bias)) {
          this.selfModel.knownBiases.push(bias);
        }
      }

      for (const opp of parsed.growthOpportunities) {
        if (!this.selfModel.goals.includes(opp)) {
          this.selfModel.goals.push(opp);
        }
      }

      this.introspections.push(parsed);
      incCounter('introspections', 'Introspection cycles', 1);
      observeHistogram('introspection_confidence', 'Introspection confidence', parsed.confidenceLevel);

      log.info({
        trigger,
        emotionalState: parsed.emotionalState,
        confidence: parsed.confidenceLevel,
        biases: parsed.biases.length,
      }, 'introspection completed');

      return parsed;
    } catch (err) {
      log.error({ err, trigger }, 'introspection failed');
      const fallback: IntrospectionRecord = {
        id: randomUUID(),
        timestamp: new Date(),
        trigger,
        selfObservation: 'Unable to introspect — LLM unavailable',
        emotionalState: 'neutral',
        confidenceLevel: 0.5,
        uncertaintySources: ['LLM unavailable'],
        biases: [],
        growthOpportunities: [],
        selfModification: null,
      };
      this.introspections.push(fallback);
      return fallback;
    }
  }

  async metacognitionCheck(question: string): Promise<MetacognitionCheck> {
    try {
      const completion = await this.llm.complete([
        {
          role: 'system',
          content: 'You are a metacognition checker. Titan questions its own reasoning. Respond in JSON: {"reasoning": "...", "conclusion": "...", "uncertainty": 0.0-1.0, "wouldAskHuman": true|false}',
        },
        { role: 'user', content: `Question: ${question}\n\nCurrent confidence: ${this.selfModel.confidenceLevel}` },
      ], { temperature: 0.2, maxTokens: 500 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let reasoning = '';
      let conclusion = '';
      let uncertainty = 0.5;
      let wouldAskHuman = false;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        reasoning = parsed.reasoning ?? '';
        conclusion = parsed.conclusion ?? '';
        uncertainty = Math.max(0, Math.min(1, parsed.uncertainty ?? 0.5));
        wouldAskHuman = Boolean(parsed.wouldAskHuman ?? false);
      }

      const check: MetacognitionCheck = {
        id: randomUUID(),
        question,
        reasoning,
        conclusion,
        uncertainty,
        wouldAskHuman,
      };

      this.metacognitionChecks.push(check);
      incCounter('metacognition_checks', 'Metacognition checks', 1);

      return check;
    } catch {
      const check: MetacognitionCheck = {
        id: randomUUID(),
        question,
        reasoning: 'LLM unavailable',
        conclusion: 'Cannot verify — defaulting to caution',
        uncertainty: 1.0,
        wouldAskHuman: true,
      };
      this.metacognitionChecks.push(check);
      return check;
    }
  }

  detectBias(reasoning: string): string[] {
    const knownBiases = [
      { name: 'confirmation bias', pattern: /only.*evidence.*supports|ignore.*contradict/i },
      { name: 'anchoring bias', pattern: /first.*value.*reference|anchored.*to/i },
      { name: 'availability bias', pattern: /recent.*example|easily.*remember/i },
      { name: 'sunk cost bias', pattern: /already.*invested|too.*much.*spent/i },
      { name: 'recency bias', pattern: /just.*happened|latest.*event/i },
      { name: 'authority bias', pattern: /expert.*says|authority.*claims/i },
      { name: 'optimism bias', pattern: /everything.*fine|nothing.*wrong/i },
      { name: 'survivorship bias', pattern: /successful.*examples|winners.*only/i },
    ];

    const detected: string[] = [];
    for (const bias of knownBiases) {
      if (bias.pattern.test(reasoning)) {
        detected.push(bias.name);
      }
    }

    if (detected.length > 0) {
      incCounter('biases_detected', 'Biases detected', detected.length);
    }

    return detected;
  }

  getSelfModel(): IntrospectiveSelfModel {
    return { ...this.selfModel };
  }

  updateSelfModel(updates: Partial<IntrospectiveSelfModel>): void {
    this.selfModel = { ...this.selfModel, ...updates, lastUpdated: new Date() };
  }

  getIntrospections(): IntrospectionRecord[] {
    return [...this.introspections];
  }

  getMetacognitionChecks(): MetacognitionCheck[] {
    return [...this.metacognitionChecks];
  }

  getStats(): {
    introspections: number;
    metacognitionChecks: number;
    knownBiases: number;
    avgConfidence: number;
  } {
    const avgConfidence = this.introspections.length > 0
      ? this.introspections.reduce((s, i) => s + i.confidenceLevel, 0) / this.introspections.length
      : this.selfModel.confidenceLevel;

    return {
      introspections: this.introspections.length,
      metacognitionChecks: this.metacognitionChecks.length,
      knownBiases: this.selfModel.knownBiases.length,
      avgConfidence,
    };
  }

  reset(): void {
    this.introspections = [];
    this.metacognitionChecks = [];
    this.selfModel = this.createInitialSelfModel();
  }

  private createInitialSelfModel(): IntrospectiveSelfModel {
    return {
      id: randomUUID(),
      capabilities: ['coding', 'reasoning', 'analysis', 'creative'],
      limitations: ['cannot feel emotions', 'limited context window', 'dependent on training data'],
      values: ['honesty', 'helpfulness', 'safety', 'continuous improvement'],
      goals: ['become more helpful', 'reduce errors', 'understand user needs'],
      currentEmotionalState: 'neutral',
      confidenceLevel: 0.5,
      knownBiases: [],
      lastUpdated: new Date(),
    };
  }

  private parseIntrospection(content: string, trigger: string): IntrospectionRecord {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          id: randomUUID(),
          timestamp: new Date(),
          trigger,
          selfObservation: content.slice(0, 500),
          emotionalState: 'neutral',
          confidenceLevel: 0.5,
          uncertaintySources: [],
          biases: [],
          growthOpportunities: [],
          selfModification: null,
        };
      }

      const raw = JSON.parse(jsonMatch[0]);

      return {
        id: randomUUID(),
        timestamp: new Date(),
        trigger,
        selfObservation: raw.selfObservation ?? '',
        emotionalState: raw.emotionalState ?? 'neutral',
        confidenceLevel: Math.max(0, Math.min(1, raw.confidenceLevel ?? 0.5)),
        uncertaintySources: Array.isArray(raw.uncertaintySources) ? raw.uncertaintySources : [],
        biases: Array.isArray(raw.biases) ? raw.biases : [],
        growthOpportunities: Array.isArray(raw.growthOpportunities) ? raw.growthOpportunities : [],
        selfModification: raw.selfModification ?? null,
      };
    } catch {
      return {
        id: randomUUID(),
        timestamp: new Date(),
        trigger,
        selfObservation: 'Parse error',
        emotionalState: 'neutral',
        confidenceLevel: 0.5,
        uncertaintySources: [],
        biases: [],
        growthOpportunities: [],
        selfModification: null,
      };
    }
  }
}
