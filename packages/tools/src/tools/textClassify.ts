export async function textClassify(params: { text: string; categories?: string[]; type?: 'sentiment' | 'topic' | 'intent' | 'language' | 'custom' }): Promise<string> {
  const { text, type = 'sentiment', categories } = params;
  if (!text) throw new Error('text is required');

  switch (type) {
    case 'sentiment': return classifySentiment(text);
    case 'language': return classifyLanguage(text);
    case 'intent': return classifyIntent(text);
    case 'topic': return classifyTopic(text, categories);
    default: return classifyCustom(text, categories ?? []);
  }
}

function classifySentiment(text: string): string {
  const positive = (text.match(/(good|great|excellent|amazing|love|happy|perfect|awesome|fantastic|wonderful|beautiful|best|ممتاز|حلو|رائع|جميل)/gi) ?? []).length;
  const negative = (text.match(/(bad|terrible|awful|hate|sad|worst|horrible|poor|disappointing|ugly|وحش|سيء|زبالة|مقرف)/gi) ?? []).length;
  const score = (positive - negative) / Math.max(positive + negative, 1);
  const label = score > 0.2 ? 'positive' : score < -0.2 ? 'negative' : 'neutral';
  return JSON.stringify({ label, score: Math.round(score * 100) / 100, positiveSignals: positive, negativeSignals: negative });
}

function classifyLanguage(text: string): string {
  if (text.match(/[؀-ۿ]/)) return JSON.stringify({ language: 'arabic', confidence: 0.9 });
  if (text.match(/[à-ÿ]/i) && text.match(/\b(le|la|les|de|du|un|une|est|sont)\b/i)) return JSON.stringify({ language: 'french', confidence: 0.8 });
  if (text.match(/[a-z]/i)) return JSON.stringify({ language: 'english', confidence: 0.7 });
  return JSON.stringify({ language: 'unknown', confidence: 0.3 });
}

function classifyIntent(text: string): string {
  const lower = text.toLowerCase();
  if (lower.match(/\b(how|what|when|where|why|who|كيف|ايه|ليه|متى|فين|مين)\b/)) return JSON.stringify({ intent: 'question', confidence: 0.8 });
  if (lower.match(/\b(please|help|can you|could you|ممكن|عايز|محتاج|ساعدني)\b/)) return JSON.stringify({ intent: 'request', confidence: 0.8 });
  if (lower.match(/\b(fix|bug|error|broken|مش شغال|خربان|مشكله)\b/)) return JSON.stringify({ intent: 'bug_report', confidence: 0.8 });
  if (lower.match(/\b(add|create|build|make|new|عايز|اعمل|ضيف)\b/)) return JSON.stringify({ intent: 'feature_request', confidence: 0.7 });
  return JSON.stringify({ intent: 'statement', confidence: 0.5 });
}

function classifyTopic(text: string, categories?: string[]): string {
  if (!categories || categories.length === 0) categories = ['technology', 'business', 'health', 'education', 'entertainment'];
  const lower = text.toLowerCase();
  const scores: Record<string, number> = {};
  for (const cat of categories) {
    scores[cat] = lower.includes(cat.toLowerCase()) ? 1 : 0;
  }
  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  return JSON.stringify({ topic: best[0], confidence: best[1] > 0 ? 0.7 : 0.3, scores });
}

function classifyCustom(text: string, categories: string[]): string {
  if (categories.length === 0) throw new Error('categories required for custom classification');
  const lower = text.toLowerCase();
  const results = categories.map((cat) => ({ category: cat, score: lower.includes(cat.toLowerCase()) ? 1 : 0 }));
  results.sort((a, b) => b.score - a.score);
  return JSON.stringify({ classification: results[0].category, confidence: results[0].score > 0 ? 0.7 : 0.3, all: results });
}
