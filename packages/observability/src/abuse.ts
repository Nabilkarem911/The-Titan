import { incCounter, setGauge } from './metrics.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'abuse' });

export type RiskSignal =
  | 'auth_failure'
  | 'rate_limit_hit'
  | 'ws_reconnect_storm'
  | 'ws_message_flood'
  | 'ws_invalid_payload'
  | 'api_key_scrape'
  | 'queue_poison'
  | 'cross_workspace_access'
  | 'brute_force_pattern';

export const SIGNAL_WEIGHTS: Record<RiskSignal, number> = {
  auth_failure: 2,
  rate_limit_hit: 1,
  ws_reconnect_storm: 5,
  ws_message_flood: 4,
  ws_invalid_payload: 3,
  api_key_scrape: 8,
  queue_poison: 6,
  cross_workspace_access: 10,
  brute_force_pattern: 9,
};

export interface RiskConfig {
  windowMs: number;
  thresholdHigh: number;
  thresholdMedium: number;
  decayPerMinute: number;
}

export const DEFAULT_RISK_CONFIG: RiskConfig = {
  windowMs: 5 * 60_000,
  thresholdHigh: 20,
  thresholdMedium: 10,
  decayPerMinute: 1,
};

export interface RiskEvent {
  signal: RiskSignal;
  subject: string;
  weight?: number;
  metadata?: Record<string, unknown>;
  timestamp?: number;
}

export interface RiskSnapshot {
  subject: string;
  score: number;
  level: 'low' | 'medium' | 'high';
  events: RiskEvent[];
  lastEventAt: number | null;
}

interface SubjectState {
  events: RiskEvent[];
  score: number;
  lastEventAt: number;
  blocked: boolean;
  blockedUntil: number;
}

export class AbuseDetector {
  private subjects = new Map<string, SubjectState>();
  private config: RiskConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<RiskConfig> = {}) {
    this.config = { ...DEFAULT_RISK_CONFIG, ...config };
  }

  startCleanup(intervalMs = 60_000): void {
    if (this.cleanupInterval) return;
    this.cleanupInterval = setInterval(() => this.evictStale(), intervalMs);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  stopCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  private evictStale(): void {
    const now = Date.now();
    const cutoff = now - this.config.windowMs * 3;
    for (const [k, s] of this.subjects.entries()) {
      if (s.lastEventAt < cutoff) this.subjects.delete(k);
    }
  }

  record(event: RiskEvent): RiskSnapshot {
    const now = event.timestamp ?? Date.now();
    const weight = event.weight ?? SIGNAL_WEIGHTS[event.signal];
    let state = this.subjects.get(event.subject);
    if (!state) {
      state = { events: [], score: 0, lastEventAt: now, blocked: false, blockedUntil: 0 };
      this.subjects.set(event.subject, state);
    }
    this.applyDecay(state, now);
    state.events.push({ ...event, weight, timestamp: now });
    state.score += weight;
    state.lastEventAt = now;
    while (state.events.length > 0 && now - (state.events[0]?.timestamp ?? 0) > this.config.windowMs) {
      state.events.shift();
    }
    incCounter('abuse_signals_total', 'Abuse signals recorded', 1, { signal: event.signal });
    setGauge('abuse_subject_count', 'Number of subjects tracked by abuse detector', this.subjects.size);
    const snapshot = this.snapshot(event.subject);
    if (snapshot.level === 'high') {
      log.warn({ subject: event.subject, signal: event.signal, score: snapshot.score }, 'high abuse risk');
    }
    return snapshot;
  }

  private applyDecay(state: SubjectState, now: number): void {
    const elapsed = (now - state.lastEventAt) / 1000;
    if (elapsed <= 0) return;
    const decay = (elapsed / 60) * this.config.decayPerMinute;
    if (decay > 0) {
      state.score = Math.max(0, state.score - decay);
    }
  }

  isBlocked(subject: string): boolean {
    const state = this.subjects.get(subject);
    if (!state) return false;
    if (state.blocked && Date.now() < state.blockedUntil) return true;
    if (state.blocked && Date.now() >= state.blockedUntil) {
      state.blocked = false;
      state.blockedUntil = 0;
    }
    const snap = this.snapshot(subject);
    if (snap.level === 'high' && !state.blocked) {
      state.blocked = true;
      state.blockedUntil = Date.now() + 60_000;
      return true;
    }
    return state.blocked;
  }

  snapshot(subject: string): RiskSnapshot {
    const state = this.subjects.get(subject);
    if (!state) {
      return { subject, score: 0, level: 'low', events: [], lastEventAt: null };
    }
    this.applyDecay(state, Date.now());
    const score = Math.round(state.score * 100) / 100;
    let level: 'low' | 'medium' | 'high' = 'low';
    if (score >= this.config.thresholdHigh) level = 'high';
    else if (score >= this.config.thresholdMedium) level = 'medium';
    return {
      subject,
      score,
      level,
      events: [...state.events],
      lastEventAt: state.lastEventAt,
    };
  }

  allSnapshots(): RiskSnapshot[] {
    const out: RiskSnapshot[] = [];
    for (const k of this.subjects.keys()) {
      out.push(this.snapshot(k));
    }
    return out;
  }

  reset(subject?: string): void {
    if (subject) this.subjects.delete(subject);
    else this.subjects.clear();
  }

  size(): number {
    return this.subjects.size;
  }
}

let _global: AbuseDetector | null = null;
export function getAbuseDetector(): AbuseDetector {
  if (!_global) {
    _global = new AbuseDetector();
    _global.startCleanup();
  }
  return _global;
}

log.debug('abuse module loaded');
