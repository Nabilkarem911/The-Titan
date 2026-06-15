import { marked } from 'marked';

export interface MarkdownToHtmlResult {
  html: string;
  length: number;
}

export async function markdownToHtml(params: { markdown: string }): Promise<MarkdownToHtmlResult> {
  const { markdown } = params;

  if (!markdown) throw new Error('markdown is required');

  const html = await marked(markdown, { async: true });

  return { html, length: html.length };
}
