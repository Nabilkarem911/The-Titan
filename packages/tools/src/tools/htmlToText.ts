interface HtmlToTextResult {
  text: string;
  length: number;
  wordCount: number;
  truncated?: boolean;
}

export async function htmlToText(params: { html: string; preserveNewlines?: boolean; maxChars?: number }): Promise<HtmlToTextResult> {
  const { html, preserveNewlines = true, maxChars = 8_000 } = params;

  if (!html) throw new Error('html is required');

  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // Replace block elements with newlines
  if (preserveNewlines) {
    text = text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '\n• ')
      .replace(/<\/li>/gi, '');
  }

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Clean up extra whitespace
  text = text
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const wordCount = text.split(/\s+/).filter(Boolean).length;

  // سقف المخرج: صفحة كاملة كنص = قنبلة توكنات في السياق
  const truncated = text.length > maxChars;
  const out = truncated ? text.substring(0, maxChars) : text;

  return { text: out, length: out.length, wordCount, truncated };
}
