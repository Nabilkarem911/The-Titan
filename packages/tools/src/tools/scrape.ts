import { getLogger } from '@titan/logging';
import type { FirecrawlScrapeInput } from '../schemas.js';

const log = getLogger().child({ component: 'tool-scrape' });

export async function firecrawlScrape(input: FirecrawlScrapeInput): Promise<{
  url: string;
  statusCode: number;
  title: string | null;
  content: string;
  contentType: string | null;
}> {
  const { url, timeoutMs, headers } = input;
  log.info({ url }, 'scraping URL');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? 10_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: headers ? new Headers(headers) : undefined,
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type');
    const raw = await res.text();
    const title = extractTitle(raw);

    // Strip HTML tags for plain-text content
    const text = stripHtml(raw);

    log.info({ url, status: res.status, bytes: raw.length }, 'scrape complete');
    return {
      url,
      statusCode: res.status,
      title,
      // ⚠️ كان 100,000 حرف للصفحة = ~30 ألف توكن → رسالة بحث واحدة = 141,438 توكن ✗
      // 8,000 حرف كافية جدًا للموديل (يحتفظ بالعنوان والرابط والمقدمة والتفاصيل).
      content: text.substring(0, 8_000),
      contentType,
    };
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : 'Unknown error';
    log.error({ url, err: msg }, 'scrape failed');
    throw new Error(`Scrape failed: ${msg}`, { cause: err });
  }
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return m ? m[1].trim() : null;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
