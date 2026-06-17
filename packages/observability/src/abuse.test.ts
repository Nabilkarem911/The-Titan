import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AbuseDetector,
  SIGNAL_WEIGHTS,
  DEFAULT_RISK_CONFIG,
  type RiskSignal,
} from './abuse.js';

/* ------------------------------------------------------------------ */
/*  SIGNAL_WEIGHTS constants                                           */
/* ------------------------------------------------------------------ */

describe('SIGNAL_WEIGHTS', () => {
  it('defines weights for all documented signals', () => {
    const signals: RiskSignal[] = [
      'auth_failure',
      'rate_limit_hit',
      'ws_reconnect_storm',
      'ws_message_flood',
      'ws_invalid_payload',
      'api_key_scrape',
      'queue_poison',
      'cross_workspace_access',
      'brute_force_pattern',
    ];
    for (const s of signals) {
      expect(SIGNAL_WEIGHTS[s]).toBeGreaterThan(0);
    }
  });

  it('ranks cross_workspace_access as highest weight', () => {
    const max = Math.max(...Object.values(SIGNAL_WEIGHTS));
    expect(SIGNAL_WEIGHTS.cross_workspace_access).toBe(max);
  });
});

/* ------------------------------------------------------------------ */
/*  AbuseDetector                                                      */
/* ------------------------------------------------------------------ */

describe('AbuseDetector', () => {
  let detector: AbuseDetector;

  beforeEach(() => {
    detector = new AbuseDetector({
      windowMs: 60_000,
      thresholdMedium: 10,
      thresholdHigh: 20,
      decayPerMinute: 1,
    });
  });

  describe('event recording and scoring', () => {
    it('returns a snapshot after recording an event', () => {
      const snap = detector.record({
        signal: 'auth_failure',
        subject: 'user:1',
      });
      expect(snap.subject).toBe('user:1');
      expect(snap.score).toBeGreaterThan(0);
      expect(snap.events).toHaveLength(1);
    });

    it('applies the default weight from SIGNAL_WEIGHTS', () => {
      const snap = detector.record({
        signal: 'auth_failure',
        subject: 'user:1',
      });
      expect(snap.score).toBe(SIGNAL_WEIGHTS.auth_failure);
    });

    it('respects a custom weight override', () => {
      const snap = detector.record({
        signal: 'auth_failure',
        subject: 'user:1',
        weight: 100,
      });
      expect(snap.score).toBe(100);
    });

    it('accumulates score across multiple events', () => {
      detector.record({ signal: 'auth_failure', subject: 'user:1' });
      detector.record({ signal: 'auth_failure', subject: 'user:1' });
      const snap = detector.record({ signal: 'rate_limit_hit', subject: 'user:1' });

      const expectedScore = SIGNAL_WEIGHTS.auth_failure * 2 + SIGNAL_WEIGHTS.rate_limit_hit;
      expect(snap.score).toBe(expectedScore);
    });

    it('stores metadata on events', () => {
      const snap = detector.record({
        signal: 'auth_failure',
        subject: 'user:1',
        metadata: { ip: '10.0.0.1' },
      });
      expect(snap.events[0].metadata).toEqual({ ip: '10.0.0.1' });
    });

    it('stores the timestamp on each event', () => {
      const ts = 1700000000000;
      const snap = detector.record({
        signal: 'auth_failure',
        subject: 'user:1',
        timestamp: ts,
      });
      expect(snap.events[0].timestamp).toBe(ts);
      expect(snap.lastEventAt).toBe(ts);
    });
  });

  describe('risk level thresholds', () => {
    it('reports "low" when score is below medium threshold', () => {
      const snap = detector.record({ signal: 'rate_limit_hit', subject: 'user:1' });
      // weight=1, threshold medium=10
      expect(snap.level).toBe('low');
    });

    it('reports "medium" when score reaches medium threshold', () => {
      // Push score to exactly 10: 5 events * weight 2 = 10
      for (let i = 0; i < 5; i++) {
        detector.record({ signal: 'auth_failure', subject: 'user:1' });
      }
      const snap = detector.snapshot('user:1');
      expect(snap.level).toBe('medium');
    });

    it('reports "high" when score reaches high threshold', () => {
      // Push score to >= 20: 10 events * weight 2 = 20
      for (let i = 0; i < 10; i++) {
        detector.record({ signal: 'auth_failure', subject: 'user:1' });
      }
      const snap = detector.snapshot('user:1');
      expect(snap.level).toBe('high');
    });

    it('uses high-weight signals to escalate quickly', () => {
      // cross_workspace_access has weight 10, 2 events => score 20 => high
      detector.record({ signal: 'cross_workspace_access', subject: 'user:1' });
      const snap = detector.record({ signal: 'cross_workspace_access', subject: 'user:1' });
      expect(snap.level).toBe('high');
    });
  });

  describe('snapshot for unknown subject', () => {
    it('returns a zero-score low-risk snapshot', () => {
      const snap = detector.snapshot('nobody');
      expect(snap.score).toBe(0);
      expect(snap.level).toBe('low');
      expect(snap.events).toEqual([]);
      expect(snap.lastEventAt).toBeNull();
    });
  });

  describe('decay', () => {
    it('reduces score over time via decay', () => {
      vi.useFakeTimers();

      detector.record({ signal: 'cross_workspace_access', subject: 'user:1' });
      // score = 10

      // Advance 2 minutes => decay = 2 * 1 = 2
      vi.advanceTimersByTime(2 * 60_000);

      const snap = detector.snapshot('user:1');
      expect(snap.score).toBeLessThan(10);
      expect(snap.score).toBeCloseTo(8, 0);

      vi.useRealTimers();
    });

    it('does not decay below zero', () => {
      vi.useFakeTimers();

      detector.record({ signal: 'rate_limit_hit', subject: 'user:1' });
      // score = 1

      // Advance 10 minutes => decay = 10 * 1 = 10, but clamped at 0
      vi.advanceTimersByTime(10 * 60_000);

      const snap = detector.snapshot('user:1');
      expect(snap.score).toBe(0);
      expect(snap.level).toBe('low');

      vi.useRealTimers();
    });
  });

  describe('window eviction of old events', () => {
    it('removes events older than windowMs', () => {
      vi.useFakeTimers();

      detector.record({ signal: 'auth_failure', subject: 'user:1' });
      detector.record({ signal: 'auth_failure', subject: 'user:1' });

      // Advance past the window
      vi.advanceTimersByTime(61_000);

      // Record one more event — old events should be evicted during record()
      detector.record({ signal: 'rate_limit_hit', subject: 'user:1' });

      const snap = detector.snapshot('user:1');
      // Only the last event should remain in the events list
      expect(snap.events).toHaveLength(1);
      expect(snap.events[0].signal).toBe('rate_limit_hit');

      vi.useRealTimers();
    });
  });

  describe('isBlocked', () => {
    it('returns false for unknown subject', () => {
      expect(detector.isBlocked('nobody')).toBe(false);
    });

    it('blocks a subject when risk level is high', () => {
      // Score >= 20 => high
      for (let i = 0; i < 10; i++) {
        detector.record({ signal: 'auth_failure', subject: 'user:1' });
      }
      expect(detector.isBlocked('user:1')).toBe(true);
    });

    it('unblocks after the block period expires', () => {
      vi.useFakeTimers();

      for (let i = 0; i < 10; i++) {
        detector.record({ signal: 'auth_failure', subject: 'user:1' });
      }
      expect(detector.isBlocked('user:1')).toBe(true);

      // Advance past the 60-second block plus enough time for decay
      vi.advanceTimersByTime(120_000);

      // After 2 minutes, score should have decayed enough: 20 - 2 = 18 < 20 threshold
      // blocked flag is cleared because blockedUntil has passed
      const blocked = detector.isBlocked('user:1');
      // The method clears the block when blockedUntil passes, then re-checks snapshot.
      // Score after 2 min decay: 20 - 2 = 18. level = medium (< 20). So not re-blocked.
      expect(blocked).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('allSnapshots', () => {
    it('returns snapshots for all tracked subjects', () => {
      detector.record({ signal: 'auth_failure', subject: 'user:1' });
      detector.record({ signal: 'rate_limit_hit', subject: 'user:2' });

      const all = detector.allSnapshots();
      expect(all).toHaveLength(2);
      const subjects = all.map((s) => s.subject).sort();
      expect(subjects).toEqual(['user:1', 'user:2']);
    });
  });

  describe('reset', () => {
    it('resets a specific subject', () => {
      detector.record({ signal: 'auth_failure', subject: 'user:1' });
      detector.record({ signal: 'auth_failure', subject: 'user:2' });
      detector.reset('user:1');

      expect(detector.size()).toBe(1);
      expect(detector.snapshot('user:1').score).toBe(0);
      expect(detector.snapshot('user:2').score).toBeGreaterThan(0);
    });

    it('resets all subjects when called without argument', () => {
      detector.record({ signal: 'auth_failure', subject: 'user:1' });
      detector.record({ signal: 'auth_failure', subject: 'user:2' });
      detector.reset();

      expect(detector.size()).toBe(0);
    });
  });

  describe('size', () => {
    it('tracks the number of subjects', () => {
      expect(detector.size()).toBe(0);
      detector.record({ signal: 'auth_failure', subject: 'a' });
      detector.record({ signal: 'auth_failure', subject: 'b' });
      expect(detector.size()).toBe(2);
    });
  });
});

/* ------------------------------------------------------------------ */
/*  DEFAULT_RISK_CONFIG                                                */
/* ------------------------------------------------------------------ */

describe('DEFAULT_RISK_CONFIG', () => {
  it('has sensible defaults', () => {
    expect(DEFAULT_RISK_CONFIG.windowMs).toBe(5 * 60_000);
    expect(DEFAULT_RISK_CONFIG.thresholdHigh).toBeGreaterThan(DEFAULT_RISK_CONFIG.thresholdMedium);
    expect(DEFAULT_RISK_CONFIG.decayPerMinute).toBeGreaterThan(0);
  });
});
