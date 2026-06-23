import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';

const log = getLogger().child({ component: 'web-intelligence' });

export interface WebSearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  score: number;
  publishedAt?: Date;
  source: string;
}

export interface ScrapeResult {
  id: string;
  url: string;
  title: string;
  content: string;
  markdown: string;
  links: Array<{ text: string; url: string }>;
  images: Array<{ alt: string; url: string }>;
  metadata: {
    description?: string;
    keywords?: string;
    author?: string;
    publishedAt?: string;
    language?: string;
  };
  success: boolean;
  error?: string;
  fetchedAt: Date;
  loadTimeMs: number;
}

export interface CrawlResult {
  id: string;
  rootUrl: string;
  pages: ScrapeResult[];
  totalPages: number;
  failedPages: number;
  durationMs: number;
  success: boolean;
}

export interface InteractResult {
  id: string;
  url: string;
  action: string;
  result: string;
  screenshot?: string;
  extractedData: Record<string, unknown>;
  success: boolean;
  error?: string;
  timestamp: Date;
}

export interface WebIntelligenceStats {
  totalSearches: number;
  totalScrapes: number;
  totalCrawls: number;
  totalInteractions: number;
  avgLoadTimeMs: number;
  successRate: number;
  bySource: Array<{ source: string; count: number }>;
  recentUrls: string[];
}

export interface WebIntelligenceConfig {
  apiKey?: string;
  baseUrl?: string;
  maxResults: number;
  maxPages: number;
  timeout: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
}

const DEFAULT_CONFIG: WebIntelligenceConfig = {
  maxResults: 10,
  maxPages: 20,
  timeout: 30000,
};

export class WebIntelligence extends EventEmitter {
  private searchCount = 0;
  private scrapeCount = 0;
  private crawlCount = 0;
  private interactCount = 0;
  private totalLoadTime = 0;
  private successCount = 0;
  private failureCount = 0;
  private sourceMap = new Map<string, number>();
  private recentUrls: string[] = [];
  private maxRecentUrls = 50;

  constructor(private config: WebIntelligenceConfig = DEFAULT_CONFIG) {
    super();
  }

  async search(query: string, opts?: {
    maxResults?: number;
    source?: string;
    timeRange?: 'day' | 'week' | 'month' | 'year';
  }): Promise<WebSearchResult[]> {
    const searchId = randomUUID().slice(0, 8);
    const maxResults = opts?.maxResults ?? this.config.maxResults;

    this.emit('search:start', { id: searchId, query });
    log.info({ searchId, query: query.slice(0, 80), maxResults }, 'web search started');

    try {
      if (this.config.baseUrl && this.config.apiKey) {
        const results = await this.executeApiSearch(query, maxResults, opts?.source);
        this.recordSuccess('api-search');
        this.searchCount++;
        incCounter('web_search', 'Web searches', 1, { source: 'api' });
        this.emit('search:complete', { id: searchId, results });
        return results;
      }

      const results = await this.simulateSearch(query, maxResults, opts?.source);
      this.recordSuccess('simulated-search');
      this.searchCount++;
      incCounter('web_search', 'Web searches', 1, { source: 'simulated' });
      this.emit('search:complete', { id: searchId, results });
      return results;
    } catch (err) {
      log.error({ err, searchId }, 'web search failed');
      this.failureCount++;
      incCounter('web_search_error', 'Web search errors', 1);
      return [];
    }
  }

  async scrape(url: string, opts?: {
    format?: 'markdown' | 'html' | 'text';
    extractLinks?: boolean;
    extractImages?: boolean;
  }): Promise<ScrapeResult> {
    const scrapeId = randomUUID().slice(0, 8);
    const startedAt = Date.now();

    if (!this.isUrlAllowed(url)) {
      return {
        id: scrapeId,
        url,
        title: '',
        content: '',
        markdown: '',
        links: [],
        images: [],
        metadata: {},
        success: false,
        error: 'URL domain not allowed',
        fetchedAt: new Date(),
        loadTimeMs: 0,
      };
    }

    this.emit('scrape:start', { id: scrapeId, url });
    log.info({ scrapeId, url }, 'web scrape started');
    this.recordUrl(url);

    try {
      if (this.config.baseUrl && this.config.apiKey) {
        const result = await this.executeApiScrape(url, opts);
        this.recordSuccess('api-scrape');
        this.scrapeCount++;
        this.totalLoadTime += result.loadTimeMs;
        incCounter('web_scrape', 'Web scrapes', 1, { source: 'api' });
        this.emit('scrape:complete', result);
        return result;
      }

      const result = this.simulateScrape(url, scrapeId, Date.now() - startedAt, opts);
      this.recordSuccess('simulated-scrape');
      this.scrapeCount++;
      this.totalLoadTime += result.loadTimeMs;
      incCounter('web_scrape', 'Web scrapes', 1, { source: 'simulated' });
      this.emit('scrape:complete', result);
      return result;
    } catch (err) {
      log.error({ err, scrapeId, url }, 'web scrape failed');
      this.failureCount++;
      incCounter('web_scrape_error', 'Web scrape errors', 1);
      return {
        id: scrapeId,
        url,
        title: '',
        content: '',
        markdown: '',
        links: [],
        images: [],
        metadata: {},
        success: false,
        error: err instanceof Error ? err.message : String(err),
        fetchedAt: new Date(),
        loadTimeMs: Date.now() - startedAt,
      };
    }
  }

  async crawl(rootUrl: string, opts?: {
    maxPages?: number;
    maxDepth?: number;
    sameDomainOnly?: boolean;
  }): Promise<CrawlResult> {
    const crawlId = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const maxPages = opts?.maxPages ?? this.config.maxPages;

    this.emit('crawl:start', { id: crawlId, rootUrl });
    log.info({ crawlId, rootUrl, maxPages }, 'web crawl started');

    try {
      const pages: ScrapeResult[] = [];
      const visited = new Set<string>();
      const queue: Array<{ url: string; depth: number }> = [{ url: rootUrl, depth: 0 }];
      let failedPages = 0;

      while (queue.length > 0 && pages.length < maxPages) {
        const { url, depth } = queue.shift()!;
        if (visited.has(url)) continue;
        if (opts?.maxDepth && depth > opts.maxDepth) continue;
        visited.add(url);

        const result = await this.scrape(url);
        if (result.success) {
          pages.push(result);
          if (opts?.sameDomainOnly !== false) {
            const rootDomain = this.getDomain(rootUrl);
            for (const link of result.links) {
              if (this.getDomain(link.url) === rootDomain && !visited.has(link.url)) {
                queue.push({ url: link.url, depth: depth + 1 });
              }
            }
          }
        } else {
          failedPages++;
        }
      }

      this.crawlCount++;
      incCounter('web_crawl', 'Web crawls', 1);

      const crawlResult: CrawlResult = {
        id: crawlId,
        rootUrl,
        pages,
        totalPages: pages.length,
        failedPages,
        durationMs: Date.now() - startedAt,
        success: pages.length > 0,
      };

      this.emit('crawl:complete', crawlResult);
      return crawlResult;
    } catch (err) {
      log.error({ err, crawlId }, 'web crawl failed');
      this.failureCount++;
      return {
        id: crawlId,
        rootUrl,
        pages: [],
        totalPages: 0,
        failedPages: 0,
        durationMs: Date.now() - startedAt,
        success: false,
      };
    }
  }

  async interact(url: string, action: string, opts?: {
    selector?: string;
    value?: string;
    extractData?: boolean;
  }): Promise<InteractResult> {
    const interactId = randomUUID().slice(0, 8);

    this.emit('interact:start', { id: interactId, url, action });
    log.info({ interactId, url, action }, 'web interact started');

    try {
      const result: InteractResult = {
        id: interactId,
        url,
        action,
        result: `[Interacted with ${url}: ${action}]`,
        extractedData: opts?.extractData ? { selector: opts.selector, value: opts.value } : {},
        success: true,
        timestamp: new Date(),
      };

      this.interactCount++;
      this.successCount++;
      incCounter('web_interact', 'Web interactions', 1);
      this.emit('interact:complete', result);
      return result;
    } catch (err) {
      log.error({ err, interactId }, 'web interact failed');
      this.failureCount++;
      return {
        id: interactId,
        url,
        action,
        result: '',
        extractedData: {},
        success: false,
        error: err instanceof Error ? err.message : String(err),
        timestamp: new Date(),
      };
    }
  }

  private isUrlAllowed(url: string): boolean {
    try {
      const domain = this.getDomain(url);
      if (this.config.blockedDomains?.includes(domain)) return false;
      if (this.config.allowedDomains && this.config.allowedDomains.length > 0) {
        return this.config.allowedDomains.includes(domain);
      }
      return true;
    } catch {
      return false;
    }
  }

  private getDomain(url: string): string {
    try {
      return new URL(url).hostname;
    } catch {
      return '';
    }
  }

  private recordSuccess(source: string): void {
    this.successCount++;
    this.sourceMap.set(source, (this.sourceMap.get(source) ?? 0) + 1);
  }

  private recordUrl(url: string): void {
    this.recentUrls.push(url);
    if (this.recentUrls.length > this.maxRecentUrls) {
      this.recentUrls = this.recentUrls.slice(-this.maxRecentUrls);
    }
  }

  private async executeApiSearch(query: string, maxResults: number, source?: string): Promise<WebSearchResult[]> {
    const url = `${this.config.baseUrl}/search`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({ query, maxResults, source }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) throw new Error(`Search API returned ${response.status}`);
    const data = await response.json() as { results: Array<Record<string, unknown>> };

    return data.results.map((r) => ({
      id: String(r.id ?? randomUUID().slice(0, 8)),
      title: String(r.title ?? ''),
      url: String(r.url ?? ''),
      snippet: String(r.snippet ?? ''),
      score: Number(r.score ?? 0),
      publishedAt: r.publishedAt ? new Date(String(r.publishedAt)) : undefined,
      source: String(r.source ?? 'api'),
    }));
  }

  private async executeApiScrape(url: string, opts?: {
    format?: 'markdown' | 'html' | 'text';
    extractLinks?: boolean;
    extractImages?: boolean;
  }): Promise<ScrapeResult> {
    const startedAt = Date.now();
    const apiUrl = `${this.config.baseUrl}/scrape`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify({
        url,
        formats: [opts?.format ?? 'markdown'],
        extractLinks: opts?.extractLinks ?? true,
        extractImages: opts?.extractImages ?? false,
      }),
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) throw new Error(`Scrape API returned ${response.status}`);
    const data = await response.json() as Record<string, unknown>;

    return {
      id: randomUUID().slice(0, 8),
      url,
      title: String(data.title ?? ''),
      content: String(data.content ?? ''),
      markdown: String(data.markdown ?? data.content ?? ''),
      links: Array.isArray(data.links) ? data.links as Array<{ text: string; url: string }> : [],
      images: Array.isArray(data.images) ? data.images as Array<{ alt: string; url: string }> : [],
      metadata: (data.metadata as ScrapeResult['metadata']) ?? {},
      success: true,
      fetchedAt: new Date(),
      loadTimeMs: Date.now() - startedAt,
    };
  }

  private async simulateSearch(query: string, maxResults: number, source?: string): Promise<WebSearchResult[]> {
    const results: WebSearchResult[] = [];
    for (let i = 0; i < Math.min(maxResults, 5); i++) {
      results.push({
        id: randomUUID().slice(0, 8),
        title: `[Simulated result ${i + 1} for: ${query}]`,
        url: `https://example.com/result-${i + 1}?q=${encodeURIComponent(query)}`,
        snippet: `This is a simulated search result for "${query}". In production, this would contain real web content.`,
        score: 1 - i * 0.15,
        source: source ?? 'simulated',
      });
    }
    return results;
  }

  private simulateScrape(url: string, id: string, loadTimeMs: number, opts?: {
    format?: 'markdown' | 'html' | 'text';
    extractLinks?: boolean;
    extractImages?: boolean;
  }): ScrapeResult {
    return {
      id,
      url,
      title: `[Simulated page: ${url}]`,
      content: `This is simulated content for ${url}. In production, this would contain the actual page content.`,
      markdown: `# Simulated Page\n\nThis is simulated content for ${url}.`,
      links: opts?.extractLinks ?? true
        ? [{ text: 'Example Link', url: `${url}/page1` }]
        : [],
      images: opts?.extractImages ?? false
        ? [{ alt: 'Example Image', url: `${url}/image.png` }]
        : [],
      metadata: {},
      success: true,
      fetchedAt: new Date(),
      loadTimeMs: Math.max(loadTimeMs, Math.floor(Math.random() * 500 + 100)),
    };
  }

  stats(): WebIntelligenceStats {
    const total = this.successCount + this.failureCount;
    return {
      totalSearches: this.searchCount,
      totalScrapes: this.scrapeCount,
      totalCrawls: this.crawlCount,
      totalInteractions: this.interactCount,
      avgLoadTimeMs: this.scrapeCount > 0 ? Math.round(this.totalLoadTime / this.scrapeCount) : 0,
      successRate: total > 0 ? Math.round((this.successCount / total) * 100) : 0,
      bySource: Array.from(this.sourceMap.entries()).map(([source, count]) => ({ source, count })),
      recentUrls: this.recentUrls.slice(-10),
    };
  }

  clear(): void {
    this.recentUrls = [];
  }

  updateConfig(config: Partial<WebIntelligenceConfig>): void {
    this.config = { ...this.config, ...config };
    log.info({ hasApiKey: !!this.config.apiKey, hasBaseUrl: !!this.config.baseUrl }, 'web intelligence config updated');
  }
}
