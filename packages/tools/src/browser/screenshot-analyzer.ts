import { getLogger } from '@titan/logging';
import type { LlmProvider } from '@titan/agent-engine';

const log = getLogger().child({ component: 'screenshot-analyzer' });

export interface ScreenshotAnalysis {
  description: string;
  elements: Array<{ type: string; text: string; location: string }>;
  actions: string[];
  errors?: string[];
}

export class ScreenshotAnalyzer {
  constructor(private llm?: LlmProvider) {}

  async analyzeHtml(html: string, query?: string): Promise<ScreenshotAnalysis> {
    const elements = this.extractVisibleElements(html);
    const errors = this.detectErrors(html);

    if (this.llm && query) {
      try {
        const completion = await this.llm.complete([
          { role: 'system', content: 'Analyze this HTML content and describe what the user would see. Answer the query if provided.' },
          { role: 'user', content: `Query: ${query}\n\nHTML elements found:\n${elements.map((e) => `[${e.type}] ${e.text}`).join('\n')}\n\nErrors: ${errors.join(', ') || 'none'}` },
        ]);
        return { description: completion.content, elements, actions: this.suggestActions(elements), errors: errors.length > 0 ? errors : undefined };
      } catch { /* fall through */ }
    }

    return {
      description: `Page has ${elements.length} visible elements`,
      elements,
      actions: this.suggestActions(elements),
      errors: errors.length > 0 ? errors : undefined,
    };
  }

  private extractVisibleElements(html: string): Array<{ type: string; text: string; location: string }> {
    const elements: Array<{ type: string; text: string; location: string }> = [];

    const patterns: Array<[RegExp, string]> = [
      [/<button[^>]*>([^<]+)<\/button>/gi, 'button'],
      [/<a\s[^>]*>([^<]+)<\/a>/gi, 'link'],
      [/<input[^>]*placeholder=["']([^"']+)["'][^>]*>/gi, 'input'],
      [/<h[1-6][^>]*>([^<]+)<\/h[1-6]>/gi, 'heading'],
      [/<label[^>]*>([^<]+)<\/label>/gi, 'label'],
      [/<span[^>]*class=["'][^"']*error[^"']*["'][^>]*>([^<]+)<\/span>/gi, 'error'],
    ];

    for (const [regex, type] of patterns) {
      let match;
      while ((match = regex.exec(html)) !== null && elements.length < 50) {
        elements.push({ type, text: match[1].trim().slice(0, 100), location: 'page' });
      }
    }

    return elements;
  }

  private detectErrors(html: string): string[] {
    const errors: string[] = [];
    if (html.includes('404') || html.includes('Not Found')) errors.push('404 Not Found');
    if (html.includes('500') || html.includes('Internal Server Error')) errors.push('500 Server Error');
    if (html.includes('403') || html.includes('Forbidden')) errors.push('403 Forbidden');
    if (html.match(/class=["'][^"']*error/i)) errors.push('Error elements detected');
    return errors;
  }

  private suggestActions(elements: Array<{ type: string; text: string }>): string[] {
    const actions: string[] = [];
    const buttons = elements.filter((e) => e.type === 'button');
    const inputs = elements.filter((e) => e.type === 'input');
    const links = elements.filter((e) => e.type === 'link');

    if (inputs.length > 0) actions.push(`Fill form fields: ${inputs.map((i) => i.text).join(', ')}`);
    if (buttons.length > 0) actions.push(`Click buttons: ${buttons.map((b) => b.text).join(', ')}`);
    if (links.length > 0) actions.push(`Navigate links: ${links.slice(0, 5).map((l) => l.text).join(', ')}`);

    return actions;
  }
}
