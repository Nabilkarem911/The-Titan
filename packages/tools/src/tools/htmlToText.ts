export interface HtmlToTextResult {
  text: string;
  length: number;
  wordCount: number;
}

export async function htmlToText(params: { html: string; preserveNewlines?: boolean }): Promise<HtmlToTextResult> {
  const { html, preserveNewlines = true } = params;

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

  return { text, length: text.length, wordCount };
}
