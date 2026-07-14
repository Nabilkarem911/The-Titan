interface TextStatsResult {
  characters: number;
  charactersNoSpaces: number;
  words: number;
  sentences: number;
  paragraphs: number;
  lines: number;
  avgWordLength: number;
  avgSentenceLength: number;
  readingTimeMinutes: number;
  mostCommonWords: Array<{ word: string; count: number }>;
  longestWord: string;
}

export async function textStats(params: { text: string }): Promise<TextStatsResult> {
  const { text } = params;
  if (!text) throw new Error('text is required');

  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  const words = text.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;
  const lines = text.split('\n').length;

  const avgWordLength = wordCount > 0
    ? Math.round((words.reduce((s, w) => s + w.length, 0) / wordCount) * 10) / 10
    : 0;

  const avgSentenceLength = sentences > 0 ? Math.round((wordCount / sentences) * 10) / 10 : 0;
  const readingTimeMinutes = Math.ceil(wordCount / 200);

  // Word frequency
  const freq: Record<string, number> = {};
  const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'is', 'it', 'this', 'that', 'was', 'are', 'be', 'من', 'في', 'على', 'إلى', 'هو', 'هي', 'مع']);
  for (const w of words) {
    const clean = w.toLowerCase().replace(/[^a-zA-Z\u0600-\u06FF]/g, '');
    if (clean.length > 2 && !stopWords.has(clean)) {
      freq[clean] = (freq[clean] ?? 0) + 1;
    }
  }
  const mostCommonWords = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const longestWord = words.reduce((a, b) => (a.length >= b.length ? a : b), '');

  return {
    characters, charactersNoSpaces, words: wordCount, sentences,
    paragraphs, lines, avgWordLength, avgSentenceLength,
    readingTimeMinutes, mostCommonWords, longestWord,
  };
}
