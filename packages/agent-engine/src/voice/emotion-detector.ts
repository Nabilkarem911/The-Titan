export type Emotion = 'neutral' | 'happy' | 'sad' | 'angry' | 'frustrated' | 'excited' | 'confused' | 'curious';

export interface EmotionResult {
  primary: Emotion;
  secondary?: Emotion;
  confidence: number;
  signals: string[];
}

const EMOTION_PATTERNS: Array<{ emotion: Emotion; patterns: RegExp[]; weight: number }> = [
  { emotion: 'frustrated', patterns: [/(مش عارف|مش فاهم|stuck|broken|error|لا يعمل|مش شغال|بايظ|frustrated|annoying)/i], weight: 3 },
  { emotion: 'angry', patterns: [/(غضب|زعلان|terrible|stupid|worst|يلعن|مصيبة)/i], weight: 3 },
  { emotion: 'excited', patterns: [/(ممتاز|amazing|awesome|perfect|excellent|يا سلام|رهيب|عظمة|incredible)/i], weight: 3 },
  { emotion: 'happy', patterns: [/(شكرا|thanks|great|good|nice|حلو|كويس|تمام|love it|عجبني)/i], weight: 2 },
  { emotion: 'sad', patterns: [/(حزين|مضايق|sad|disappointed|unfortunately|للأسف)/i], weight: 2 },
  { emotion: 'confused', patterns: [/(مش فاهم|confused|what\?|إيه ده|ازاي|how come|لا أفهم|مش واضح)/i], weight: 2 },
  { emotion: 'curious', patterns: [/(ازاي|how|why|ليه|explain|اشرح|curious|interested|عايز أعرف)/i], weight: 1 },
];

export class EmotionDetector {
  detect(text: string): EmotionResult {
    const scores = new Map<Emotion, { score: number; signals: string[] }>();

    for (const { emotion, patterns, weight } of EMOTION_PATTERNS) {
      for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) {
          const existing = scores.get(emotion) ?? { score: 0, signals: [] };
          existing.score += weight;
          existing.signals.push(match[0]);
          scores.set(emotion, existing);
        }
      }
    }

    // Punctuation signals
    if (text.includes('!!!') || text.includes('؟؟')) {
      const emph = scores.get('frustrated') ?? scores.get('excited') ?? { score: 0, signals: [] };
      emph.score += 1;
      emph.signals.push('emphasis punctuation');
    }

    if (text.toUpperCase() === text && text.length > 10 && text.match(/[A-Z]/)) {
      const existing = scores.get('angry') ?? { score: 0, signals: [] };
      existing.score += 2;
      existing.signals.push('ALL CAPS');
      scores.set('angry', existing);
    }

    if (scores.size === 0) {
      return { primary: 'neutral', confidence: 0.5, signals: [] };
    }

    const sorted = Array.from(scores.entries()).sort((a, b) => b[1].score - a[1].score);
    const totalScore = sorted.reduce((s, [, v]) => s + v.score, 0);

    return {
      primary: sorted[0][0],
      secondary: sorted.length > 1 ? sorted[1][0] : undefined,
      confidence: Math.min(1, sorted[0][1].score / Math.max(totalScore, 1)),
      signals: sorted[0][1].signals,
    };
  }

  suggestTone(emotion: Emotion): string {
    switch (emotion) {
      case 'frustrated': return 'empathetic and solution-oriented — acknowledge the frustration first';
      case 'angry': return 'calm and respectful — don\'t match the anger, offer help';
      case 'excited': return 'enthusiastic and encouraging — share the excitement';
      case 'happy': return 'warm and positive — maintain the good energy';
      case 'sad': return 'supportive and gentle — show understanding';
      case 'confused': return 'clear and patient — explain step by step';
      case 'curious': return 'detailed and informative — feed the curiosity';
      default: return 'natural and balanced';
    }
  }
}
