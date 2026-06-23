import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { emotionReadings as erRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'emotional-intelligence' });

export type PlutchikEmotion = 'joy' | 'trust' | 'fear' | 'surprise' | 'sadness' | 'disgust' | 'anger' | 'anticipation';

export interface EmotionState {
  joy: number;
  trust: number;
  fear: number;
  surprise: number;
  sadness: number;
  disgust: number;
  anger: number;
  anticipation: number;
}

export interface EmotionReading {
  id: string;
  userId?: string;
  sessionId?: string;
  userEmotion: EmotionState;
  agentEmotion: EmotionState;
  dominantUserEmotion: PlutchikEmotion;
  dominantAgentEmotion: PlutchikEmotion;
  valence: number; // -1 (negative) to +1 (positive)
  arousal: number; // 0 (calm) to 1 (excited)
  empathyScore: number; // 0-1
  responseStrategy: string;
  createdAt: Date;
}

export interface EmotionStats {
  totalReadings: number;
  avgValence: number;
  avgArousal: number;
  avgEmpathy: number;
  emotionDistribution: Array<{ emotion: PlutchikEmotion; count: number }>;
  topStrategies: Array<{ strategy: string; count: number }>;
}

const EMOTION_PROMPT = `You are an emotional intelligence module. Analyze the user's message and determine:

1. The user's emotional state using Plutchik's 8 primary emotions (0-100 each):
   joy, trust, fear, surprise, sadness, disgust, anger, anticipation

2. The agent's appropriate empathetic emotional response (0-100 each)

3. Valence: -1 (very negative) to +1 (very positive)
4. Arousal: 0 (very calm) to 1 (very excited)
5. Empathy score: 0-1 (how well the agent understands the user's feeling)
6. Response strategy: how the agent should respond emotionally

Respond in JSON:
{
  "userEmotion": { "joy": 0, "trust": 0, "fear": 0, "surprise": 0, "sadness": 0, "disgust": 0, "anger": 0, "anticipation": 0 },
  "agentEmotion": { "joy": 0, "trust": 0, "fear": 0, "surprise": 0, "sadness": 0, "disgust": 0, "anger": 0, "anticipation": 0 },
  "valence": -1 to 1,
  "arousal": 0 to 1,
  "empathyScore": 0 to 1,
  "responseStrategy": "how to respond"
}`;

export class EmotionalIntelligence {
  private readings: EmotionReading[] = [];
  private maxReadings = 500;
  private strategyCounts = new Map<string, number>();
  private emotionCounts = new Map<PlutchikEmotion, number>();

  constructor(private llm: LlmProvider) {}

  async analyze(
    message: string,
    context?: { userId?: string; sessionId?: string; conversationHistory?: string[] },
  ): Promise<EmotionReading> {
    log.info({ userId: context?.userId }, 'analyzing emotion');

    try {
      const response = await this.llm.complete([
        { role: 'system', content: EMOTION_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            message,
            conversationHistory: context?.conversationHistory?.slice(-5),
          }),
        },
      ], { temperature: 0.3, maxTokens: 600 });

      const parsed = this.parseEmotion(response.content);

      const reading: EmotionReading = {
        id: randomUUID().slice(0, 8),
        userId: context?.userId,
        sessionId: context?.sessionId,
        userEmotion: parsed.userEmotion,
        agentEmotion: parsed.agentEmotion,
        dominantUserEmotion: this.dominantEmotion(parsed.userEmotion),
        dominantAgentEmotion: this.dominantEmotion(parsed.agentEmotion),
        valence: parsed.valence,
        arousal: parsed.arousal,
        empathyScore: parsed.empathyScore,
        responseStrategy: parsed.responseStrategy,
        createdAt: new Date(),
      };

      this.readings.push(reading);
      if (this.readings.length > this.maxReadings) {
        this.readings = this.readings.slice(-this.maxReadings);
      }
      erRepo.insert(reading.id, { user_id: reading.userId ?? 'unknown', valence: reading.valence, arousal: reading.arousal, dominant_emotion: reading.dominantUserEmotion, empathy_score: reading.empathyScore, strategy: reading.responseStrategy }).catch(() => {});

      this.strategyCounts.set(
        reading.responseStrategy,
        (this.strategyCounts.get(reading.responseStrategy) ?? 0) + 1,
      );
      this.emotionCounts.set(
        reading.dominantUserEmotion,
        (this.emotionCounts.get(reading.dominantUserEmotion) ?? 0) + 1,
      );

      incCounter('emotion_analyzed', 'Emotions analyzed', 1);

      log.info(
        {
          dominantUser: reading.dominantUserEmotion,
          valence: reading.valence,
          empathy: reading.empathyScore,
        },
        'emotion analysis complete',
      );

      return reading;
    } catch (err) {
      log.error({ err }, 'emotion analysis failed');
      return this.neutralReading(context?.userId, context?.sessionId);
    }
  }

  getReadings(): EmotionReading[] {
    return this.readings;
  }

  getRecentReadings(count: number = 10): EmotionReading[] {
    return this.readings.slice(-count);
  }

  getUserEmotionProfile(userId: string): {
    avgValence: number;
    avgArousal: number;
    dominantEmotions: Array<{ emotion: PlutchikEmotion; frequency: number }>;
    totalReadings: number;
  } {
    const userReadings = this.readings.filter((r) => r.userId === userId);
    if (userReadings.length === 0) {
      return { avgValence: 0, avgArousal: 0, dominantEmotions: [], totalReadings: 0 };
    }

    const avgValence = userReadings.reduce((s, r) => s + r.valence, 0) / userReadings.length;
    const avgArousal = userReadings.reduce((s, r) => s + r.arousal, 0) / userReadings.length;

    const emotionFreq = new Map<PlutchikEmotion, number>();
    for (const r of userReadings) {
      emotionFreq.set(r.dominantUserEmotion, (emotionFreq.get(r.dominantUserEmotion) ?? 0) + 1);
    }

    return {
      avgValence: Math.round(avgValence * 100) / 100,
      avgArousal: Math.round(avgArousal * 100) / 100,
      dominantEmotions: Array.from(emotionFreq.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emotion, count]) => ({
          emotion,
          frequency: Math.round((count / userReadings.length) * 100),
        })),
      totalReadings: userReadings.length,
    };
  }

  stats(): EmotionStats {
    const total = this.readings.length;
    const avgValence = total > 0 ? this.readings.reduce((s, r) => s + r.valence, 0) / total : 0;
    const avgArousal = total > 0 ? this.readings.reduce((s, r) => s + r.arousal, 0) / total : 0;
    const avgEmpathy = total > 0 ? this.readings.reduce((s, r) => s + r.empathyScore, 0) / total : 0;

    return {
      totalReadings: total,
      avgValence: Math.round(avgValence * 100) / 100,
      avgArousal: Math.round(avgArousal * 100) / 100,
      avgEmpathy: Math.round(avgEmpathy * 100) / 100,
      emotionDistribution: Array.from(this.emotionCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .map(([emotion, count]) => ({ emotion, count })),
      topStrategies: Array.from(this.strategyCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([strategy, count]) => ({ strategy, count })),
    };
  }

  clear(): void {
    this.readings = [];
    this.strategyCounts.clear();
    this.emotionCounts.clear();
  }

  private dominantEmotion(state: EmotionState): PlutchikEmotion {
    let max = 0;
    let dominant: PlutchikEmotion = 'joy';
    for (const [emotion, value] of Object.entries(state) as Array<[PlutchikEmotion, number]>) {
      if (value > max) {
        max = value;
        dominant = emotion;
      }
    }
    return dominant;
  }

  private parseEmotion(content: string): {
    userEmotion: EmotionState;
    agentEmotion: EmotionState;
    valence: number;
    arousal: number;
    empathyScore: number;
    responseStrategy: string;
  } {
    const neutral: EmotionState = {
      joy: 0, trust: 0, fear: 0, surprise: 0,
      sadness: 0, disgust: 0, anger: 0, anticipation: 0,
    };

    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return {
        userEmotion: neutral,
        agentEmotion: neutral,
        valence: 0,
        arousal: 0.5,
        empathyScore: 0.5,
        responseStrategy: 'neutral',
      };
      const raw = JSON.parse(jsonMatch[0]);
      return {
        userEmotion: this.clampEmotion(raw.userEmotion, neutral),
        agentEmotion: this.clampEmotion(raw.agentEmotion, neutral),
        valence: Math.max(-1, Math.min(1, Number(raw.valence ?? 0))),
        arousal: Math.max(0, Math.min(1, Number(raw.arousal ?? 0.5))),
        empathyScore: Math.max(0, Math.min(1, Number(raw.empathyScore ?? 0.5))),
        responseStrategy: String(raw.responseStrategy ?? 'neutral'),
      };
    } catch {
      return {
        userEmotion: neutral,
        agentEmotion: neutral,
        valence: 0,
        arousal: 0.5,
        empathyScore: 0.5,
        responseStrategy: 'neutral',
      };
    }
  }

  private clampEmotion(raw: unknown, fallback: EmotionState): EmotionState {
    if (!raw || typeof raw !== 'object') return fallback;
    const obj = raw as Record<string, unknown>;
    const clamp = (v: unknown) => Math.max(0, Math.min(100, Number(v ?? 0)));
    return {
      joy: clamp(obj.joy),
      trust: clamp(obj.trust),
      fear: clamp(obj.fear),
      surprise: clamp(obj.surprise),
      sadness: clamp(obj.sadness),
      disgust: clamp(obj.disgust),
      anger: clamp(obj.anger),
      anticipation: clamp(obj.anticipation),
    };
  }

  private neutralReading(userId?: string, sessionId?: string): EmotionReading {
    const neutral: EmotionState = {
      joy: 0, trust: 50, fear: 0, surprise: 0,
      sadness: 0, disgust: 0, anger: 0, anticipation: 0,
    };
    return {
      id: randomUUID().slice(0, 8),
      userId,
      sessionId,
      userEmotion: neutral,
      agentEmotion: neutral,
      dominantUserEmotion: 'trust',
      dominantAgentEmotion: 'trust',
      valence: 0,
      arousal: 0.5,
      empathyScore: 0.5,
      responseStrategy: 'neutral',
      createdAt: new Date(),
    };
  }
}
