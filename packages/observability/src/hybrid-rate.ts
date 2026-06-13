import { incCounter } from './metrics.js';
import { getAbuseDetector } from './abuse.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'hybrid-rate' });

export interface HybridKeyOpts {
  ip?: string;
  userId?: string;
  apiKeyId?: string;
  workspaceId?: string;
  resource?: string;
  bucket: 'global' | 'auth' | 'api' | 'workspace' | 'apikey';
}

export function buildHybridRateKey(opts: HybridKeyOpts): string {
  const segs: string[] = [opts.bucket];
  if (opts.workspaceId) segs.push(`w:${opts.workspaceId}`);
  if (opts.userId) segs.push(`u:${opts.userId}`);
  if (opts.apiKeyId) segs.push(`k:${opts.apiKeyId}`);
  if (opts.resource) segs.push(`r:${opts.resource}`);
  if (opts.ip) segs.push(`ip:${opts.ip}`);
  return segs.join('|');
}

export interface AdaptiveConfig {
  softLimit: number;
  hardLimit: number;
  windowMs: number;
  decayFactor: number;
}

export interface AdaptiveResult {
  allowed: boolean;
  severity: 'ok' | 'soft' | 'hard';
  remaining: number;
  retryAfterMs: number;
  ratio: number;
}

export class AdaptiveThrottle {
  private counts = new Map<string, { count: number; windowStart: number }>();
  private config: AdaptiveConfig;

  constructor(config: Partial<AdaptiveConfig> = {}) {
    this.config = {
      softLimit: config.softLimit ?? 50,
      hardLimit: config.hardLimit ?? 100,
      windowMs: config.windowMs ?? 60_000,
      decayFactor: config.decayFactor ?? 0.5,
    };
  }

  take(key: string, cost = 1): AdaptiveResult {
    const now = Date.now();
    let state = this.counts.get(key);
    if (!state || now - state.windowStart > this.config.windowMs) {
      state = { count: 0, windowStart: now };
      this.counts.set(key, state);
    }
    state.count += cost;
    const ratio = state.count / this.config.hardLimit;
    if (state.count > this.config.hardLimit) {
      incCounter('adaptive_throttle_hard_total', 'Hard throttle rejections', 1, { key });
      return {
        allowed: false,
        severity: 'hard',
        remaining: 0,
        retryAfterMs: this.config.windowMs - (now - state.windowStart),
        ratio,
      };
    }
    if (state.count > this.config.softLimit) {
      incCounter('adaptive_throttle_soft_total', 'Soft throttle events', 1, { key });
      const log = getLogger().child({ component: 'adaptive-throttle' });
      log.warn({ key, count: state.count, softLimit: this.config.softLimit }, 'soft throttle');
      return {
        allowed: true,
        severity: 'soft',
        remaining: this.config.hardLimit - state.count,
        retryAfterMs: 0,
        ratio,
      };
    }
    return {
      allowed: true,
      severity: 'ok',
      remaining: this.config.hardLimit - state.count,
      retryAfterMs: 0,
      ratio,
    };
  }

  reset(key?: string): void {
    if (key) this.counts.delete(key);
    else this.counts.clear();
  }

  size(): number {
    return this.counts.size;
  }
}

const defaultAdaptive = new AdaptiveThrottle();

export function recordAuthFailureHybrid(opts: { ip?: string; userId?: string; apiKeyId?: string }): void {
  getAbuseDetector().record({
    signal: 'auth_failure',
    subject: opts.userId ? `u:${opts.userId}` : (opts.ip ? `ip:${opts.ip}` : 'anon'),
    metadata: opts,
  });
}

export function recordBruteForcePattern(subject: string, count: number): void {
  if (count >= 5) {
    getAbuseDetector().record({
      signal: 'brute_force_pattern',
      subject,
      weight: count,
      metadata: { count },
    });
    log.warn({ subject, count }, 'brute force pattern detected');
  }
}

export function recordApiKeyScrape(subject: string): void {
  getAbuseDetector().record({ signal: 'api_key_scrape', subject });
  log.warn({ subject }, 'api key scrape pattern detected');
}

export { defaultAdaptive };
