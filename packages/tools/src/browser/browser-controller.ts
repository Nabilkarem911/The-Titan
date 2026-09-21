import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'browser-controller' });

export interface BrowserAction {
  type: 'navigate' | 'click' | 'type' | 'scroll' | 'screenshot' | 'extract' | 'wait';
  selector?: string;
  value?: string;
  url?: string;
  timeout?: number;
}

export interface BrowserResult {
  success: boolean;
  data?: unknown;
  screenshot?: string;
  error?: string;
  url: string;
  title: string;
}

export interface PageInfo {
  url: string;
  title: string;
  text: string;
  links: Array<{ href: string; text: string }>;
  forms: Array<{ action: string; fields: string[] }>;
}

export class BrowserController {
  private currentUrl = '';
  private currentTitle = '';
  private isHeadless: boolean;

  constructor(headless = true) {
    this.isHeadless = headless;
  }

  async navigate(url: string): Promise<BrowserResult> {
    log.info({ url }, 'navigating');

    try {
      const response = await fetch(url, {
        headers: { 'User-Agent': 'TitanBot/1.0' },
        signal: AbortSignal.timeout(30000),
      });

      const html = await response.text();
      this.currentUrl = url;
      this.currentTitle = this.extractTitle(html);

      return {
        success: true,
        data: this.extractText(html).slice(0, 10000),
        url: this.currentUrl,
        title: this.currentTitle,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Navigation failed',
        url,
        title: '',
      };
    }
  }

  async extractPageInfo(url: string): Promise<PageInfo> {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'TitanBot/1.0' },
      signal: AbortSignal.timeout(30000),
    });

    const html = await response.text();

    return {
      url,
      title: this.extractTitle(html),
      // ⚠️ كان 20,000 حرف = ~6 آلاف توكن ✗
      text: this.extractText(html).slice(0, 10_000),
      links: this.extractLinks(html, url),
      forms: this.extractForms(html),
    };
  }

  async executeActions(actions: BrowserAction[]): Promise<BrowserResult[]> {
    const results: BrowserResult[] = [];

    for (const action of actions) {
      let result: BrowserResult;

      switch (action.type) {
        case 'navigate':
          result = await this.navigate(action.url ?? '');
          break;
        case 'extract':
          if (!this.currentUrl) {
            result = { success: false, error: 'No page loaded', url: '', title: '' };
          } else {
            const info = await this.extractPageInfo(this.currentUrl);
            result = { success: true, data: info, url: info.url, title: info.title };
          }
          break;
        default:
          result = {
            success: false,
            error: `Action "${action.type}" requires Playwright — install @playwright/test for full browser automation`,
            url: this.currentUrl,
            title: this.currentTitle,
          };
      }

      results.push(result);
      if (!result.success) break;
    }

    return results;
  }

  private extractTitle(html: string): string {
    const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    return match?.[1]?.trim() ?? '';
  }

  private extractText(html: string): string {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractLinks(html: string, baseUrl: string): Array<{ href: string; text: string }> {
    const links: Array<{ href: string; text: string }> = [];
    const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([^<]*)<\/a>/gi;
    let match;

    while ((match = regex.exec(html)) !== null && links.length < 50) {
      let href = match[1];
      if (href.startsWith('/')) {
        try { href = new URL(href, baseUrl).toString(); } catch { continue; }
      }
      links.push({ href, text: match[2].trim() });
    }

    return links;
  }

  private extractForms(html: string): Array<{ action: string; fields: string[] }> {
    const forms: Array<{ action: string; fields: string[] }> = [];
    const formRegex = /<form[^>]*action=["']?([^"'\s>]*)["']?[^>]*>([\s\S]*?)<\/form>/gi;
    let match;

    while ((match = formRegex.exec(html)) !== null && forms.length < 10) {
      const fields: string[] = [];
      const inputRegex = /<input[^>]*name=["']([^"']+)["']/gi;
      let inputMatch;
      while ((inputMatch = inputRegex.exec(match[2])) !== null) {
        fields.push(inputMatch[1]);
      }
      forms.push({ action: match[1], fields });
    }

    return forms;
  }
}
