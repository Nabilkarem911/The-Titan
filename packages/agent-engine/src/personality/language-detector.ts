export type DetectedLanguage = 'arabic-egyptian' | 'arabic-gulf' | 'arabic-levantine' | 'arabic-maghreb' | 'arabic-formal' | 'english' | 'french' | 'unknown';

interface LanguageSignal {
  language: DetectedLanguage;
  confidence: number;
}

const PATTERNS: Array<{ pattern: RegExp; language: DetectedLanguage; weight: number }> = [
  // Egyptian Arabic
  { pattern: /(ازيك|ازايك|عامل ايه|يا هندسه|يا حب|يا باشا|يا معلم|كدا|كده|بتاع|بتاعت|ايوة|يلا|خلاص|هنا|دلوقتي|ليه|عشان|مش عارف|يا سيدي|طيب|ماشي|تمام)/, language: 'arabic-egyptian', weight: 3 },
  { pattern: /(الحاجه|الحاجة|حاجه|حاجة|عايز|عايزه|مفيش|فيه|إيه|ايه)/, language: 'arabic-egyptian', weight: 2 },

  // Gulf Arabic
  { pattern: /(شلونك|شخبارك|وش|يالله|حبيبي|يا خوي|إنشاء الله|ان شاء الله|وش تبي|اشوف|زين|حلو|يا حبيبي|شسمه|هالشي)/, language: 'arabic-gulf', weight: 3 },

  // Levantine Arabic
  { pattern: /(كيفك|شو|هلق|هلأ|منيح|بدي|بدك|هيك|يا زلمة|شو في|مبسوط|معليش)/, language: 'arabic-levantine', weight: 3 },

  // Maghreb Arabic
  { pattern: /(واش|لاباس|بزاف|كيفاش|ديال|بغيت|نتا|نتي|هادشي|زعما|خويا|صاحبي)/, language: 'arabic-maghreb', weight: 3 },

  // Formal Arabic
  { pattern: /(أرجو|يُرجى|نودّ|نأمل|تفضلوا|حضرتك|سيادتكم|نرجو|السلام عليكم|مع فائق الاحترام)/, language: 'arabic-formal', weight: 3 },

  // General Arabic (any dialect)
  { pattern: /[؀-ۿ]{3,}/, language: 'arabic-egyptian', weight: 1 },

  // English
  { pattern: /\b(hello|hi|hey|please|thanks|could you|can you|I want|I need|how do|what is)\b/i, language: 'english', weight: 2 },
  { pattern: /^[a-zA-Z\s\d.,!?'"()-]+$/, language: 'english', weight: 1 },

  // French
  { pattern: /\b(bonjour|salut|merci|s'il vous plaît|comment|pourquoi|je veux|j'ai besoin)\b/i, language: 'french', weight: 3 },
];

export function detectLanguage(text: string): LanguageSignal {
  const scores = new Map<DetectedLanguage, number>();

  for (const { pattern, language, weight } of PATTERNS) {
    if (pattern.test(text)) {
      scores.set(language, (scores.get(language) ?? 0) + weight);
    }
  }

  if (scores.size === 0) {
    return { language: 'english', confidence: 0.3 };
  }

  let best: DetectedLanguage = 'unknown';
  let bestScore = 0;
  let totalScore = 0;

  for (const [lang, score] of scores) {
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }

  return { language: best, confidence: Math.min(1, bestScore / Math.max(totalScore, 1)) };
}

export function isArabicDialect(lang: DetectedLanguage): boolean {
  return lang.startsWith('arabic');
}
