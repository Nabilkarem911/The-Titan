import { getLogger } from '@titan/logging';
import type { ToolResult } from './types.js';

const log = getLogger().child({ component: 'tool-registry' });

export interface ToolHandler {
  (params: unknown): Promise<unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  handler: ToolHandler;
  tags?: string[];
  schema?: Record<string, { type: string; description?: string; enum?: string[] }>;
  requiredParams?: string[];
  cacheTtlMs?: number;        // 0 = no cache, >0 = cache duration
  rateLimit?: {
    maxCalls: number;
    windowMs: number;
  };
}

interface CacheEntry {
  result: ToolResult;
  expiresAt: number;
}

interface RateBucket {
  calls: number;
  windowStart: number;
}

const MAX_CACHE_SIZE = 500;
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private cache = new Map<string, CacheEntry>();
  private rateBuckets = new Map<string, RateBucket>();
  private maxCacheSize: number;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(maxCacheSize: number = MAX_CACHE_SIZE) {
    this.maxCacheSize = maxCacheSize;
    this.startCleanupInterval();
  }

  register(def: ToolDefinition): void {
    if (this.tools.has(def.name)) {
      log.warn({ tool: def.name }, 'tool already registered; overwriting');
    }
    this.tools.set(def.name, def);
    log.info({ tool: def.name, tags: def.tags }, 'tool registered');
  }

  unregister(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) log.info({ tool: name }, 'tool unregistered');
    return removed;
  }

  private getCacheKey(name: string, params: unknown): string {
    return `${name}:${JSON.stringify(params)}`;
  }

  private checkRateLimit(tool: ToolDefinition): boolean {
    if (!tool.rateLimit) return true;
    const { maxCalls, windowMs } = tool.rateLimit;
    const now = Date.now();
    const bucket = this.rateBuckets.get(tool.name);

    if (!bucket || now - bucket.windowStart > windowMs) {
      this.rateBuckets.set(tool.name, { calls: 1, windowStart: now });
      return true;
    }
    if (bucket.calls >= maxCalls) return false;
    bucket.calls++;
    return true;
  }

  async execute(name: string, params: unknown): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }

    // Rate limit check
    if (!this.checkRateLimit(tool)) {
      const { maxCalls, windowMs } = tool.rateLimit!;
      const msg = `Tool "${name}" rate limit exceeded (max ${maxCalls} calls per ${windowMs / 1000}s)`;
      log.warn({ tool: name }, msg);
      return { success: false, error: msg };
    }

    // Cache check (LRU: move to end on access)
    if (tool.cacheTtlMs && tool.cacheTtlMs > 0) {
      const key = this.getCacheKey(name, params);
      const cached = this.cache.get(key);
      if (cached && Date.now() < cached.expiresAt) {
        this.cache.delete(key);
        this.cache.set(key, cached);
        log.info({ tool: name }, 'tool result served from cache');
        return { ...cached.result, latencyMs: 0 };
      }
      if (cached) {
        this.cache.delete(key);
      }
    }

    const start = performance.now();
    try {
      const data = await tool.handler(params);
      const latencyMs = Math.round(performance.now() - start);
      log.info({ tool: name, latencyMs }, 'tool executed');
      const result: ToolResult = { success: true, data, latencyMs };

      // Store in cache (with LRU eviction)
      if (tool.cacheTtlMs && tool.cacheTtlMs > 0) {
        const key = this.getCacheKey(name, params);
        this.evictIfNeeded();
        this.cache.set(key, { result, expiresAt: Date.now() + tool.cacheTtlMs });
      }

      return result;
    } catch (err) {
      const latencyMs = Math.round(performance.now() - start);
      const error = err instanceof Error ? err.message : String(err);
      log.error({ tool: name, error, latencyMs }, 'tool execution failed');
      return { success: false, error, latencyMs };
    }
  }

  private evictIfNeeded(): void {
    while (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey === undefined) break;
      this.cache.delete(oldestKey);
    }
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let removed = 0;
    for (const [key, entry] of this.cache) {
      if (now >= entry.expiresAt) {
        this.cache.delete(key);
        removed++;
      }
    }
    if (removed > 0) {
      log.debug({ removed, remaining: this.cache.size }, 'cache cleanup: removed expired entries');
    }
  }

  startCleanupInterval(intervalMs: number = CLEANUP_INTERVAL_MS): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.cleanupExpired(), intervalMs);
    this.cleanupTimer.unref?.();
  }

  stopCleanupInterval(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  clearCache(name?: string): void {
    if (name) {
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${name}:`)) this.cache.delete(key);
      }
    } else {
      this.cache.clear();
    }
  }

  cacheStats(): { size: number; tools: string[] } {
    const tools = [...new Set([...this.cache.keys()].map((k) => k.split(':')[0]))];
    return { size: this.cache.size, tools };
  }

  list(): Array<{ name: string; description: string; tags?: string[]; schema?: Record<string, { type: string; description?: string; enum?: string[] }>; requiredParams?: string[] }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      tags: t.tags,
      schema: t.schema,
      requiredParams: t.requiredParams,
    }));
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  size(): number {
    return this.tools.size;
  }
}

/** Global singleton for the process. */
let globalRegistry: ToolRegistry | null = null;

export function getGlobalToolRegistry(): ToolRegistry {
  if (!globalRegistry) {
    globalRegistry = new ToolRegistry();
  }
  return globalRegistry;
}

export function resetGlobalToolRegistry(): void {
  globalRegistry = null;
}
