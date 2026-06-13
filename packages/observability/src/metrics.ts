import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'metrics' });

export type MetricLabel = Record<string, string | number | boolean>;

interface LabeledSeries {
  labels: MetricLabel;
  value: number;
  key: string;
}

interface CounterState {
  help: string;
  type: 'counter';
  unlabeled: number;
  labeled: Map<string, LabeledSeries>;
}

interface GaugeState {
  help: string;
  type: 'gauge';
  unlabeled: number;
  labeled: Map<string, LabeledSeries>;
}

interface HistogramState {
  buckets: number[];
  counts: number[];
  sum: number;
  count: number;
  help: string;
  type: 'histogram';
  unlabeledBuckets: number[];
  unlabeledCounts: number[];
  unlabeledSum: number;
  unlabeledCount: number;
  labeled: Map<string, { labels: MetricLabel; buckets: number[]; counts: number[]; sum: number; count: number }>;
}

type MetricState = CounterState | GaugeState | HistogramState;

const DEFAULT_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

const metrics = new Map<string, MetricState>();

function labelKey(labels?: MetricLabel): string {
  if (!labels) return '';
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${String(labels[k])}`).join(',');
}

export function getOrCreateCounter(name: string, help: string): CounterState {
  let m = metrics.get(name);
  if (!m) {
    m = { help, type: 'counter', unlabeled: 0, labeled: new Map() };
    metrics.set(name, m);
  } else if (m.type !== 'counter') {
    throw new Error(`Metric ${name} already registered as ${m.type}, not counter`);
  }
  return m;
}

export function getOrCreateGauge(name: string, help: string): GaugeState {
  let m = metrics.get(name);
  if (!m) {
    m = { help, type: 'gauge', unlabeled: 0, labeled: new Map() };
    metrics.set(name, m);
  } else if (m.type !== 'gauge') {
    throw new Error(`Metric ${name} already registered as ${m.type}, not gauge`);
  }
  return m;
}

export function getOrCreateHistogram(
  name: string,
  help: string,
  buckets: number[] = DEFAULT_BUCKETS,
): HistogramState {
  let m = metrics.get(name);
  if (!m) {
    const sorted = [...buckets].sort((a, b) => a - b);
    m = {
      buckets: sorted,
      counts: new Array(sorted.length + 1).fill(0),
      sum: 0,
      count: 0,
      unlabeledBuckets: new Array(sorted.length + 1).fill(0),
      unlabeledCounts: new Array(sorted.length + 1).fill(0),
      unlabeledSum: 0,
      unlabeledCount: 0,
      labeled: new Map(),
      help,
      type: 'histogram',
    };
    metrics.set(name, m);
  } else if (m.type !== 'histogram') {
    throw new Error(`Metric ${name} already registered as ${m.type}, not histogram`);
  }
  return m;
}

export function incCounter(name: string, help: string, value = 1, labels?: MetricLabel): void {
  const m = getOrCreateCounter(name, help);
  if (!labels || Object.keys(labels).length === 0) {
    m.unlabeled += value;
    return;
  }
  const k = labelKey(labels);
  let s = m.labeled.get(k);
  if (!s) {
    s = { labels, value: 0, key: k };
    m.labeled.set(k, s);
  }
  s.value += value;
}

export function setGauge(name: string, help: string, value: number, labels?: MetricLabel): void {
  const m = getOrCreateGauge(name, help);
  if (!labels || Object.keys(labels).length === 0) {
    m.unlabeled = value;
    return;
  }
  const k = labelKey(labels);
  m.labeled.set(k, { labels, value, key: k });
}

export function observeHistogram(name: string, help: string, value: number, buckets?: number[], labels?: MetricLabel): void {
  const m = getOrCreateHistogram(name, help, buckets);
  if (!labels || Object.keys(labels).length === 0) {
    m.unlabeledSum += value;
    m.unlabeledCount += 1;
    let placed = false;
    for (let i = 0; i < m.buckets.length; i++) {
      if (value <= m.buckets[i]) {
        m.unlabeledCounts[i] += 1;
        placed = true;
      }
    }
    if (!placed) m.unlabeledCounts[m.buckets.length] += 1;
    return;
  }
  const k = labelKey(labels);
  let s = m.labeled.get(k);
  if (!s) {
    s = { labels: labels ?? {}, buckets: new Array(m.buckets.length + 1).fill(0), counts: new Array(m.buckets.length + 1).fill(0), sum: 0, count: 0 };
    m.labeled.set(k, s);
  }
  s.sum += value;
  s.count += 1;
  let placed = false;
  for (let i = 0; i < m.buckets.length; i++) {
    if (value <= m.buckets[i]) {
      s.counts[i] += 1;
      placed = true;
    }
  }
  if (!placed) s.counts[m.buckets.length] += 1;
}

export function resetMetrics(): void {
  metrics.clear();
}

function escapeLabel(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');
}

function renderLabels(labels: MetricLabel): string {
  if (!labels || Object.keys(labels).length === 0) return '';
  return '{' + Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(String(v))}"`).join(',') + '}';
}

function renderLabelsWithLe(labels: MetricLabel, le: number | string): string {
  const existing = renderLabels(labels).replace(/^\{/, '').replace(/\}$/, '');
  if (!existing) return `{le="${le}"}`;
  return `{${existing},le="${le}"}`;
}

export function renderPrometheus(): string {
  const out: string[] = [];
  for (const [name, m] of metrics.entries()) {
    out.push(`# HELP ${name} ${m.help}`);
    if (m.type === 'counter') {
      out.push(`# TYPE ${name} counter`);
      if (m.unlabeled !== 0 || m.labeled.size === 0) {
        out.push(`${name} ${m.unlabeled}`);
      }
      for (const s of m.labeled.values()) {
        out.push(`${name}${renderLabels(s.labels)} ${s.value}`);
      }
    } else if (m.type === 'gauge') {
      out.push(`# TYPE ${name} gauge`);
      if (m.labeled.size === 0) {
        out.push(`${name} ${m.unlabeled}`);
      }
      for (const s of m.labeled.values()) {
        out.push(`${name}${renderLabels(s.labels)} ${s.value}`);
      }
    } else if (m.type === 'histogram') {
      out.push(`# TYPE ${name} histogram`);
      if (m.unlabeledCount > 0 || m.labeled.size === 0) {
        for (let i = 0; i < m.buckets.length; i++) {
          out.push(`${name}_bucket{le="${m.buckets[i]}"} ${m.unlabeledCounts[i]}`);
        }
        out.push(`${name}_bucket{le="+Inf"} ${m.unlabeledCount}`);
        out.push(`${name}_sum ${m.unlabeledSum}`);
        out.push(`${name}_count ${m.unlabeledCount}`);
      }
      for (const [key, s] of m.labeled.entries()) {
        const lbls = key ? '{' + key + '}' : '{}';
        for (let i = 0; i < m.buckets.length; i++) {
          out.push(`${name}_bucket${renderLabelsWithLe(s.labels, m.buckets[i])} ${s.counts[i]}`);
        }
        out.push(`${name}_bucket${renderLabelsWithLe(s.labels, '+Inf')} ${s.count}`);
        out.push(`${name}_sum${lbls} ${s.sum}`);
        out.push(`${name}_count${lbls} ${s.count}`);
      }
    }
  }
  return out.join('\n') + '\n';
}

export function snapshot(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, m] of metrics.entries()) {
    if (m.type === 'counter') {
      out[name] = m.unlabeled;
      for (const s of m.labeled.values()) {
        const labeledKey = `${name}${JSON.stringify(s.labels)}`;
        out[labeledKey] = s.value;
      }
    } else if (m.type === 'gauge') {
      out[name] = m.unlabeled;
      for (const s of m.labeled.values()) {
        const labeledKey = `${name}${JSON.stringify(s.labels)}`;
        out[labeledKey] = s.value;
      }
    } else if (m.type === 'histogram') {
      out[name] = { count: m.unlabeledCount, sum: m.unlabeledSum };
    }
  }
  return out;
}

export const _internal = { metrics, labelKey, escapeLabel };
log.debug('metrics module loaded');
