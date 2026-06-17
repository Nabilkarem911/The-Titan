import { describe, it, expect, beforeEach } from 'vitest';
import {
  incCounter,
  setGauge,
  observeHistogram,
  resetMetrics,
  renderPrometheus,
  snapshot,
  getOrCreateCounter,
  getOrCreateGauge,
  getOrCreateHistogram,
  _internal,
} from './metrics.js';

beforeEach(() => {
  resetMetrics();
});

/* ------------------------------------------------------------------ */
/*  labelKey helper                                                    */
/* ------------------------------------------------------------------ */

describe('labelKey', () => {
  const { labelKey } = _internal;

  it('returns empty string for undefined', () => {
    expect(labelKey(undefined)).toBe('');
  });

  it('sorts keys alphabetically', () => {
    expect(labelKey({ z: '1', a: '2' })).toBe('a=2,z=1');
  });

  it('stringifies non-string values', () => {
    expect(labelKey({ ok: true, n: 42 })).toBe('n=42,ok=true');
  });
});

/* ------------------------------------------------------------------ */
/*  escapeLabel helper                                                 */
/* ------------------------------------------------------------------ */

describe('escapeLabel', () => {
  const { escapeLabel } = _internal;

  it('escapes backslashes, newlines, and double-quotes', () => {
    expect(escapeLabel('a\\b')).toBe('a\\\\b');
    expect(escapeLabel('a\nb')).toBe('a\\nb');
    expect(escapeLabel('a"b')).toBe('a\\"b');
  });

  it('handles combined special characters', () => {
    expect(escapeLabel('a\\b\nc"d')).toBe('a\\\\b\\nc\\"d');
  });
});

/* ------------------------------------------------------------------ */
/*  incCounter                                                         */
/* ------------------------------------------------------------------ */

describe('incCounter', () => {
  it('increments an unlabeled counter by 1', () => {
    incCounter('test_total', 'A test counter');
    expect(snapshot()['test_total']).toBe(1);
  });

  it('increments by a custom value', () => {
    incCounter('test_total', 'A test counter', 5);
    expect(snapshot()['test_total']).toBe(5);
  });

  it('accumulates across multiple calls', () => {
    incCounter('test_total', 'A test counter');
    incCounter('test_total', 'A test counter');
    incCounter('test_total', 'A test counter', 3);
    expect(snapshot()['test_total']).toBe(5);
  });

  it('tracks labeled counters separately from unlabeled', () => {
    incCounter('req_total', 'Requests', 1);
    incCounter('req_total', 'Requests', 1, { method: 'GET' });
    incCounter('req_total', 'Requests', 2, { method: 'POST' });
    incCounter('req_total', 'Requests', 1, { method: 'GET' });

    const snap = snapshot();
    expect(snap['req_total']).toBe(1);
    expect(snap['req_total{"method":"GET"}']).toBe(2);
    expect(snap['req_total{"method":"POST"}']).toBe(2);
  });

  it('treats empty labels the same as no labels', () => {
    incCounter('c', 'help', 1, {});
    expect(snapshot()['c']).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  setGauge / getOrCreateGauge                                        */
/* ------------------------------------------------------------------ */

describe('setGauge', () => {
  it('sets an unlabeled gauge value', () => {
    setGauge('temp', 'Temperature', 42);
    expect(snapshot()['temp']).toBe(42);
  });

  it('overwrites the previous gauge value', () => {
    setGauge('temp', 'Temperature', 10);
    setGauge('temp', 'Temperature', 99);
    expect(snapshot()['temp']).toBe(99);
  });

  it('supports labeled gauges', () => {
    setGauge('conn', 'Connections', 5, { region: 'us' });
    setGauge('conn', 'Connections', 3, { region: 'eu' });

    const snap = snapshot();
    expect(snap['conn{"region":"us"}']).toBe(5);
    expect(snap['conn{"region":"eu"}']).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/*  observeHistogram                                                   */
/* ------------------------------------------------------------------ */

describe('observeHistogram', () => {
  it('records a value and updates count and sum', () => {
    observeHistogram('latency', 'Request latency', 0.15);
    const snap = snapshot();
    const h = snap['latency'] as { count: number; sum: number };
    expect(h.count).toBe(1);
    expect(h.sum).toBe(0.15);
  });

  it('accumulates multiple observations', () => {
    observeHistogram('latency', 'Request latency', 0.1);
    observeHistogram('latency', 'Request latency', 0.5);
    observeHistogram('latency', 'Request latency', 2.0);

    const h = snapshot()['latency'] as { count: number; sum: number };
    expect(h.count).toBe(3);
    expect(h.sum).toBeCloseTo(2.6);
  });

  it('places values into the correct cumulative buckets', () => {
    const buckets = [1, 5, 10];
    observeHistogram('dur', 'Duration', 3, buckets);
    observeHistogram('dur', 'Duration', 7, buckets);
    observeHistogram('dur', 'Duration', 0.5, buckets);

    // After observations: 0.5 falls into le=1, le=5, le=10 (cumulative)
    // 3 falls into le=5, le=10; 7 falls into le=10
    // Cumulative bucket counts: le=1 -> 1, le=5 -> 2, le=10 -> 3, +Inf -> 0
    const prom = renderPrometheus();
    expect(prom).toContain('dur_bucket{le="1"} 1');
    expect(prom).toContain('dur_bucket{le="5"} 2');
    expect(prom).toContain('dur_bucket{le="10"} 3');
    expect(prom).toContain('dur_count 3');
    expect(prom).toContain('dur_sum 10.5');
  });

  it('places values above all buckets into +Inf', () => {
    const buckets = [1, 5];
    observeHistogram('dur', 'Duration', 100, buckets);

    const prom = renderPrometheus();
    expect(prom).toContain('dur_bucket{le="1"} 0');
    expect(prom).toContain('dur_bucket{le="5"} 0');
    // +Inf should equal total count for the unlabeled series
    expect(prom).toContain('dur_bucket{le="+Inf"} 1');
  });
});

/* ------------------------------------------------------------------ */
/*  getOrCreate* type conflicts                                        */
/* ------------------------------------------------------------------ */

describe('metric type conflicts', () => {
  it('throws when re-registering a counter as a gauge', () => {
    getOrCreateCounter('x', 'help');
    expect(() => getOrCreateGauge('x', 'help')).toThrow('already registered as counter');
  });

  it('throws when re-registering a gauge as a histogram', () => {
    getOrCreateGauge('y', 'help');
    expect(() => getOrCreateHistogram('y', 'help')).toThrow('already registered as gauge');
  });

  it('throws when re-registering a histogram as a counter', () => {
    getOrCreateHistogram('z', 'help');
    expect(() => getOrCreateCounter('z', 'help')).toThrow('already registered as histogram');
  });
});

/* ------------------------------------------------------------------ */
/*  snapshot                                                           */
/* ------------------------------------------------------------------ */

describe('snapshot', () => {
  it('returns an empty object when no metrics registered', () => {
    expect(snapshot()).toEqual({});
  });

  it('returns all registered metrics', () => {
    incCounter('a', 'help', 1);
    setGauge('b', 'help', 42);
    observeHistogram('c', 'help', 1.5);

    const snap = snapshot();
    expect(snap).toHaveProperty('a', 1);
    expect(snap).toHaveProperty('b', 42);
    expect(snap).toHaveProperty('c');
    expect((snap['c'] as { count: number }).count).toBe(1);
  });
});

/* ------------------------------------------------------------------ */
/*  renderPrometheus                                                   */
/* ------------------------------------------------------------------ */

describe('renderPrometheus', () => {
  it('ends with a trailing newline', () => {
    incCounter('x', 'help');
    const out = renderPrometheus();
    expect(out.endsWith('\n')).toBe(true);
  });

  it('renders HELP and TYPE lines for counters', () => {
    incCounter('http_requests_total', 'Total HTTP requests', 5);

    const lines = renderPrometheus().split('\n');
    expect(lines).toContain('# HELP http_requests_total Total HTTP requests');
    expect(lines).toContain('# TYPE http_requests_total counter');
    expect(lines).toContain('http_requests_total 5');
  });

  it('renders labeled counter with labels', () => {
    incCounter('req', 'help', 3, { method: 'GET', status: '200' });
    const out = renderPrometheus();
    expect(out).toContain('req{method="GET",status="200"} 3');
  });

  it('renders HELP and TYPE lines for gauges', () => {
    setGauge('temperature', 'Current temp', 23.5);
    const out = renderPrometheus();
    expect(out).toContain('# TYPE temperature gauge');
    expect(out).toContain('temperature 23.5');
  });

  it('renders histogram with bucket lines, sum, and count', () => {
    observeHistogram('latency', 'Latency', 0.05, [0.01, 0.1, 1]);
    const out = renderPrometheus();
    expect(out).toContain('# TYPE latency histogram');
    expect(out).toContain('latency_bucket{le="0.01"} 0');
    expect(out).toContain('latency_bucket{le="0.1"} 1');
    expect(out).toContain('latency_bucket{le="1"} 1');
    expect(out).toContain('latency_bucket{le="+Inf"} 1');
    expect(out).toContain('latency_sum 0.05');
    expect(out).toContain('latency_count 1');
  });

  it('renders multiple metrics in registration order', () => {
    incCounter('aaa', 'first');
    setGauge('bbb', 'second', 10);
    incCounter('ccc', 'third');

    const out = renderPrometheus();
    const helpIdx = (name: string) => out.indexOf(`# HELP ${name}`);
    expect(helpIdx('aaa')).toBeLessThan(helpIdx('bbb'));
    expect(helpIdx('bbb')).toBeLessThan(helpIdx('ccc'));
  });

  it('escapes special characters in label values', () => {
    incCounter('c', 'help', 1, { path: '/a"b\\c\nd' });
    const out = renderPrometheus();
    expect(out).toContain('path="/a\\"b\\\\c\\nd"');
  });
});

/* ------------------------------------------------------------------ */
/*  resetMetrics                                                       */
/* ------------------------------------------------------------------ */

describe('resetMetrics', () => {
  it('clears all registered metrics', () => {
    incCounter('a', 'help');
    setGauge('b', 'help', 1);
    resetMetrics();
    expect(snapshot()).toEqual({});
  });
});
