export async function textSummarize(params: { text: string; maxLength?: number; style?: 'bullets' | 'paragraph' | 'tldr' }): Promise<string> {
  const { text, maxLength = 500, style = 'paragraph' } = params;
  if (!text) throw new Error('text is required');

  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const scored = sentences.map((s, i) => {
    const words = s.trim().split(/\s+/);
    let score = 0;
    if (i === 0) score += 3; // First sentence
    if (i === sentences.length - 1) score += 2; // Last sentence
    score += words.filter((w) => w.length > 6).length * 0.5; // Long words = important
    if (s.match(/\b(important|key|main|critical|significant|essential|crucial)\b/i)) score += 2;
    if (s.match(/\b(however|therefore|because|consequently|thus|in conclusion)\b/i)) score += 1;
    return { sentence: s.trim(), score, index: i };
  });

  scored.sort((a, b) => b.score - a.score);

  const selected: typeof scored = [];
  let totalLength = 0;
  for (const s of scored) {
    if (totalLength + s.sentence.length > maxLength) break;
    selected.push(s);
    totalLength += s.sentence.length;
  }

  selected.sort((a, b) => a.index - b.index);

  switch (style) {
    case 'bullets': return selected.map((s) => `• ${s.sentence}`).join('\n');
    case 'tldr': return `TL;DR: ${selected.slice(0, 2).map((s) => s.sentence).join(' ')}`;
    default: return selected.map((s) => s.sentence).join(' ');
  }
}
