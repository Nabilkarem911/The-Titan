import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { EnvironmentGraph } from '../world-model/environment-graph.js';

const log = getLogger().child({ component: 'digital-twin' });

export interface SystemSnapshot {
  timestamp: Date;
  cpuUsage: number;
  memoryTotal: number;
  memoryUsed: number;
  memoryFree: number;
  diskTotal?: number;
  diskUsed?: number;
  processes?: Array<{ name: string; cpu: number; memory: number; pid: number }>;
  networkLatencyMs?: number;
  customMetrics?: Record<string, number>;
}

export interface TrendAnalysis {
  metric: string;
  currentValue: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  ratePerHour: number;
  projectedValue: number;
  hoursToThreshold?: number;
  threshold?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  recommendation: string;
}

export interface AnomalyDetection {
  metric: string;
  value: number;
  baseline: number;
  deviation: number;
  isAnomaly: boolean;
  anomalyType: 'spike' | 'drift' | 'drop' | 'level_shift';
  confidence: number;
  description: string;
}

export interface WhatIfScenario {
  id: string;
  name: string;
  action: string;
  target: string;
  probability: number;
  confidenceInterval: [number, number];
  outcomes: string[];
  risks: string[];
  duration: string;
}

export interface DigitalTwinState {
  snapshotCount: number;
  entityCount: number;
  relationCount: number;
  lastSnapshot: SystemSnapshot | null;
  trends: TrendAnalysis[];
  anomalies: AnomalyDetection[];
  alerts: PredictiveAlert[];
}

export interface PredictiveAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  metric: string;
  message: string;
  projectedTime: string;
  confidence: number;
  recommendation: string;
}

const MAX_SNAPSHOTS = 500;
const ANOMALY_THRESHOLD = 2.5;
const MIN_SNAPSHOTS_FOR_TREND = 5;

export class DigitalTwin {
  private snapshots: SystemSnapshot[] = [];
  private graph: EnvironmentGraph;
  private alerts: PredictiveAlert[] = [];
  private maxSnapshots: number;

  constructor(graph?: EnvironmentGraph, maxSnapshots?: number) {
    this.graph = graph ?? new EnvironmentGraph();
    this.maxSnapshots = maxSnapshots ?? MAX_SNAPSHOTS;
  }

  recordSnapshot(snapshot: Omit<SystemSnapshot, 'timestamp'> & { timestamp?: Date }): void {
    const full: SystemSnapshot = {
      ...snapshot,
      timestamp: snapshot.timestamp ?? new Date(),
    };
    this.snapshots.push(full);
    if (this.snapshots.length > this.maxSnapshots) {
      this.snapshots.shift();
    }

    // Record entities in the graph
    this.graph.recordEntity('server', 'host', {
      cpuUsage: full.cpuUsage,
      memoryUsed: full.memoryUsed,
      memoryTotal: full.memoryTotal,
    });

    if (full.processes) {
      for (const proc of full.processes) {
        this.graph.recordEntity('process', proc.name, {
          pid: proc.pid,
          cpu: proc.cpu,
          memory: proc.memory,
        });
        this.graph.recordRelation(
          `process:${proc.name}`,
          'server:host',
          'affects',
        );
      }
    }

    incCounter('digital_twin_snapshots', 'Snapshots recorded', 1);
    log.debug({ snapshotCount: this.snapshots.length }, 'snapshot recorded');
  }

  getSnapshots(): SystemSnapshot[] {
    return [...this.snapshots];
  }

  getLastSnapshot(): SystemSnapshot | null {
    return this.snapshots.length > 0 ? this.snapshots[this.snapshots.length - 1] : null;
  }

  analyzeTrends(): TrendAnalysis[] {
    if (this.snapshots.length < MIN_SNAPSHOTS_FOR_TREND) return [];

    const trends: TrendAnalysis[] = [];
    const metrics: Array<{ key: keyof SystemSnapshot; threshold?: number; maxVal?: number }> = [
      { key: 'cpuUsage', threshold: 90, maxVal: 100 },
      { key: 'memoryUsed', threshold: undefined },
      { key: 'networkLatencyMs', threshold: 1000 },
    ];

    for (const { key, threshold, maxVal } of metrics) {
      const values = this.snapshots
        .map((s) => s[key])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (values.length < MIN_SNAPSHOTS_FOR_TREND) continue;

      const currentValue = values[values.length - 1];
      const ratePerHour = this.calculateRatePerHour(values, this.snapshots);
      const trend = this.determineTrend(ratePerHour);

      let projectedValue = currentValue;
      let hoursToThreshold: number | undefined;

      if (ratePerHour !== 0) {
        projectedValue = currentValue + ratePerHour * 1; // 1 hour projection
        if (maxVal !== undefined) {
          projectedValue = Math.min(projectedValue, maxVal);
        }

        if (threshold !== undefined && ratePerHour > 0) {
          hoursToThreshold = (threshold - currentValue) / ratePerHour;
          if (hoursToThreshold < 0 || hoursToThreshold > 720) hoursToThreshold = undefined;
        }

        if (key === 'memoryUsed' && ratePerHour > 0) {
          const lastSnapshot = this.snapshots[this.snapshots.length - 1];
          const memTotal = lastSnapshot.memoryTotal;
          if (memTotal && memTotal > 0) {
            hoursToThreshold = (memTotal - currentValue) / ratePerHour;
            if (hoursToThreshold < 0 || hoursToThreshold > 720) hoursToThreshold = undefined;
          }
        }
      }

      const severity = this.determineSeverity(currentValue, threshold, maxVal, hoursToThreshold);
      const recommendation = this.generateRecommendation(key as string, severity, trend, hoursToThreshold);

      trends.push({
        metric: key as string,
        currentValue,
        trend,
        ratePerHour,
        projectedValue,
        hoursToThreshold,
        threshold,
        severity,
        recommendation,
      });
    }

    return trends;
  }

  detectAnomalies(): AnomalyDetection[] {
    if (this.snapshots.length < MIN_SNAPSHOTS_FOR_TREND) return [];

    const anomalies: AnomalyDetection[] = [];
    const metricKeys: Array<keyof SystemSnapshot> = ['cpuUsage', 'memoryUsed', 'networkLatencyMs'];

    for (const key of metricKeys) {
      const values = this.snapshots
        .map((s) => s[key])
        .filter((v): v is number => typeof v === 'number' && !isNaN(v));

      if (values.length < MIN_SNAPSHOTS_FOR_TREND) continue;

      const currentValue = values[values.length - 1];
      const baseline = this.calculateBaseline(values.slice(0, -1));
      const stdDev = this.calculateStdDev(values.slice(0, -1));

      if (stdDev === 0) continue;

      const deviation = Math.abs(currentValue - baseline) / stdDev;
      const isAnomaly = deviation > ANOMALY_THRESHOLD;

      if (!isAnomaly) continue;

      let anomalyType: AnomalyDetection['anomalyType'] = 'spike';
      if (currentValue < baseline * 0.5) anomalyType = 'drop';
      else if (currentValue > baseline * 1.5) anomalyType = 'spike';
      else if (deviation > 3) anomalyType = 'level_shift';
      else anomalyType = 'drift';

      anomalies.push({
        metric: key as string,
        value: currentValue,
        baseline,
        deviation,
        isAnomaly,
        anomalyType,
        confidence: Math.min(1, deviation / 5),
        description: `${key} ${anomalyType}: current ${currentValue.toFixed(1)} vs baseline ${baseline.toFixed(1)} (${deviation.toFixed(1)}σ deviation)`,
      });

      incCounter('digital_twin_anomalies', 'Anomalies detected', 1, { metric: key as string, type: anomalyType });
    }

    return anomalies;
  }

  generateAlerts(): PredictiveAlert[] {
    const trends = this.analyzeTrends();
    const newAlerts: PredictiveAlert[] = [];

    for (const trend of trends) {
      if (trend.hoursToThreshold === undefined) continue;
      if (trend.hoursToThreshold > 24) continue;

      const severity: PredictiveAlert['severity'] =
        trend.hoursToThreshold < 1 ? 'critical' :
        trend.hoursToThreshold < 4 ? 'warning' : 'info';

      const alert: PredictiveAlert = {
        id: `alert-${trend.metric}-${Date.now()}`,
        severity,
        metric: trend.metric,
        message: `${trend.metric} will reach ${trend.threshold ?? 'limit'} in ~${trend.hoursToThreshold.toFixed(1)} hours (current: ${trend.currentValue.toFixed(1)}, rate: ${trend.ratePerHour.toFixed(1)}/hr)`,
        projectedTime: new Date(Date.now() + trend.hoursToThreshold * 3600 * 1000).toISOString(),
        confidence: Math.max(0.5, 1 - trend.hoursToThreshold / 24),
        recommendation: trend.recommendation,
      };

      newAlerts.push(alert);
    }

    this.alerts = [...this.alerts, ...newAlerts].slice(-50);
    return newAlerts;
  }

  getActiveAlerts(): PredictiveAlert[] {
    return [...this.alerts];
  }

  getState(): DigitalTwinState {
    const stats = this.graph.stats();
    return {
      snapshotCount: this.snapshots.length,
      entityCount: stats.entities,
      relationCount: stats.relations,
      lastSnapshot: this.getLastSnapshot(),
      trends: this.analyzeTrends(),
      anomalies: this.detectAnomalies(),
      alerts: this.getActiveAlerts(),
    };
  }

  getGraph(): EnvironmentGraph {
    return this.graph;
  }

  clear(): void {
    this.snapshots = [];
    this.alerts = [];
    this.graph.clear();
  }

  private calculateRatePerHour(values: number[], snapshots: SystemSnapshot[]): number {
    if (values.length < 2) return 0;

    const n = values.length;
    const firstTime = snapshots[0].timestamp.getTime();
    const lastTime = snapshots[n - 1].timestamp.getTime();
    const hoursElapsed = (lastTime - firstTime) / (1000 * 60 * 60);

    if (hoursElapsed === 0) return 0;

    // Linear regression slope
    const firstVal = values[0];
    const lastVal = values[n - 1];
    return (lastVal - firstVal) / hoursElapsed;
  }

  private determineTrend(rate: number): 'increasing' | 'decreasing' | 'stable' {
    if (Math.abs(rate) < 0.01) return 'stable';
    return rate > 0 ? 'increasing' : 'decreasing';
  }

  private determineSeverity(
    current: number,
    threshold?: number,
    maxVal?: number,
    hoursToThreshold?: number,
  ): TrendAnalysis['severity'] {
    if (hoursToThreshold !== undefined && hoursToThreshold < 1) return 'critical';
    if (hoursToThreshold !== undefined && hoursToThreshold < 4) return 'high';
    if (threshold !== undefined && current > threshold * 0.8) return 'high';
    if (maxVal !== undefined && current > maxVal * 0.8) return 'medium';
    if (hoursToThreshold !== undefined && hoursToThreshold < 12) return 'medium';
    return 'low';
  }

  private generateRecommendation(
    metric: string,
    severity: TrendAnalysis['severity'],
    trend: string,
    hoursToThreshold?: number,
  ): string {
    if (severity === 'critical') {
      return `Immediate action required: ${metric} is trending ${trend} and will hit threshold in ${hoursToThreshold?.toFixed(1)} hours. Investigate and mitigate now.`;
    }
    if (severity === 'high') {
      return `Warning: ${metric} is approaching threshold. Plan mitigation within ${hoursToThreshold?.toFixed(1)} hours.`;
    }
    if (severity === 'medium') {
      return `Monitor ${metric}: trending ${trend}. No immediate action needed but keep watching.`;
    }
    return `${metric} is stable. No action needed.`;
  }

  private calculateBaseline(values: number[]): number {
    if (values.length === 0) return 0;
    // Use median for robustness against outliers
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  }

  private calculateStdDev(values: number[]): number {
    if (values.length < 2) return 0;
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
  }
}

let globalTwin: DigitalTwin | null = null;

export function getDigitalTwin(): DigitalTwin {
  if (!globalTwin) {
    globalTwin = new DigitalTwin();
  }
  return globalTwin;
}

export function initDigitalTwin(graph?: EnvironmentGraph): DigitalTwin {
  globalTwin = new DigitalTwin(graph);
  return globalTwin;
}
