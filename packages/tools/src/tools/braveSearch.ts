import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-brave-search' });

const BRAVE_SEARCH_URL = 'https://api.search.brave.com/res/v1/web/search';
const BRAVE_ANSWERS_URL = 'https://api.search.brave.com/res/v1/summarizer/search';

export interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

export async function braveSearch(input: {
  query: string;
  count?: number;
  apiKey: string;
}): Promise<{ query: string; results: BraveSearchResult[] }> {
  const { query, count = 10, apiKey } = input;
  log.info({ query }, 'brave search');

  const url = new URL(BRAVE_SEARCH_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(count));

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Search API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as {
    web?: { results?: Array<{ title: string; url: string; description?: string }> };
  };

  const results: BraveSearchResult[] = (data.web?.results ?? []).map((r) => ({
    title: r.title,
    url: r.url,
    description: r.description ?? '',
  }));

  log.info({ query, count: results.length }, 'brave search complete');
  return { query, results };
}

export async function braveAnswers(input: {
  query: string;
  apiKey: string;
}): Promise<{ query: string; summary: string; sources: Array<{ title: string; url: string }> }> {
  const { query, apiKey } = input;
  log.info({ query }, 'brave answers');

  const url = new URL(BRAVE_ANSWERS_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('entity_info', '1');

  const res = await fetch(url.toString(), {
    headers: {
      'Accept': 'application/json',
      'Accept-Encoding': 'gzip',
      'X-Subscription-Token': apiKey,
    },
  });

  if (!res.ok) {
    throw new Error(`Brave Answers API error: ${res.status} ${await res.text()}`);
  }

  const data = await res.json() as {
    summary?: Array<{ text?: string }>;
    enrichments?: { entities?: Array<{ name?: string; url?: string }> };
  };

  const summary = (data.summary ?? []).map((s) => s.text ?? '').join(' ').trim();
  const sources = (data.enrichments?.entities ?? [])
    .filter((e) => e.url)
    .map((e) => ({ title: e.name ?? '', url: e.url! }));

  log.info({ query, summaryLen: summary.length }, 'brave answers complete');
  return { query, summary, sources };
}
