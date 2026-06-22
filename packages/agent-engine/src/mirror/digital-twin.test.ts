import { describe, it, expect, beforeEach } from 'vitest';
import { DigitalTwin } from './digital-twin.js';
import { WhatIfEngine } from './what-if-engine.js';
import { EnvironmentGraph } from '../world-model/environment-graph.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('DigitalTwin', () => {
  let twin: DigitalTwin;

  beforeEach(() => {
    twin = new DigitalTwin(new EnvironmentGraph(), 100);
  });

  it('should record snapshots', () => {
    twin.recordSnapshot({
      cpuUsage: 50,
      memoryTotal: 16000,
      memoryUsed: 8000,
      memoryFree: 8000,
    });
    expect(twin.getSnapshots()).toHaveLength(1);
    expect(twin.getLastSnapshot()?.cpuUsage).toBe(50);
  });

  it('should enforce max snapshots', () => {
    for (let i = 0; i < 120; i++) {
      twin.recordSnapshot({
        cpuUsage: i,
        memoryTotal: 16000,
        memoryUsed: 8000,
        memoryFree: 8000,
      });
    }
    expect(twin.getSnapshots()).toHaveLength(100);
  });

  it('should return null last snapshot when empty', () => {
    expect(twin.getLastSnapshot()).toBeNull();
  });

  it('should detect increasing trend', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 30 + i * 5,
        memoryTotal: 16000,
        memoryUsed: 8000,
        memoryFree: 8000,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const trends = twin.analyzeTrends();
    const cpuTrend = trends.find((t) => t.metric === 'cpuUsage');
    expect(cpuTrend).toBeDefined();
    expect(cpuTrend!.trend).toBe('increasing');
    expect(cpuTrend!.ratePerHour).toBeGreaterThan(0);
  });

  it('should detect decreasing trend', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 80 - i * 5,
        memoryTotal: 16000,
        memoryUsed: 8000,
        memoryFree: 8000,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const trends = twin.analyzeTrends();
    const cpuTrend = trends.find((t) => t.metric === 'cpuUsage');
    expect(cpuTrend!.trend).toBe('decreasing');
  });

  it('should detect stable trend', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 50,
        memoryTotal: 16000,
        memoryUsed: 8000,
        memoryFree: 8000,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const trends = twin.analyzeTrends();
    const cpuTrend = trends.find((t) => t.metric === 'cpuUsage');
    expect(cpuTrend!.trend).toBe('stable');
  });

  it('should return empty trends with insufficient data', () => {
    twin.recordSnapshot({ cpuUsage: 50, memoryTotal: 16000, memoryUsed: 8000, memoryFree: 8000 });
    expect(twin.analyzeTrends()).toHaveLength(0);
  });

  it('should calculate hours to threshold for memory', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 50,
        memoryTotal: 16000,
        memoryUsed: 8000 + i * 500,
        memoryFree: 8000 - i * 500,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const trends = twin.analyzeTrends();
    const memTrend = trends.find((t) => t.metric === 'memoryUsed');
    expect(memTrend).toBeDefined();
    expect(memTrend!.hoursToThreshold).toBeGreaterThan(0);
  });

  it('should detect anomalies', () => {
    const now = Date.now();
    // Normal values with slight variation
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 50 + (i % 3) - 1,
        memoryTotal: 16000,
        memoryUsed: 8000,
        memoryFree: 8000,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    // Anomalous spike
    twin.recordSnapshot({
      cpuUsage: 95,
      memoryTotal: 16000,
      memoryUsed: 8000,
      memoryFree: 8000,
      timestamp: new Date(now + 10 * 60 * 1000),
    });
    const anomalies = twin.detectAnomalies();
    expect(anomalies.length).toBeGreaterThan(0);
    const cpuAnomaly = anomalies.find((a) => a.metric === 'cpuUsage');
    expect(cpuAnomaly).toBeDefined();
    expect(cpuAnomaly!.isAnomaly).toBe(true);
  });

  it('should return empty anomalies with insufficient data', () => {
    twin.recordSnapshot({ cpuUsage: 50, memoryTotal: 16000, memoryUsed: 8000, memoryFree: 8000 });
    expect(twin.detectAnomalies()).toHaveLength(0);
  });

  it('should generate predictive alerts', () => {
    const now = Date.now();
    // Rapidly increasing memory toward limit
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 50,
        memoryTotal: 16000,
        memoryUsed: 14000 + i * 200,
        memoryFree: 2000 - i * 200,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const alerts = twin.generateAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts.some((a) => a.metric === 'memoryUsed')).toBe(true);
  });

  it('should not generate alerts for stable metrics', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 50,
        memoryTotal: 16000,
        memoryUsed: 8000,
        memoryFree: 8000,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const alerts = twin.generateAlerts();
    expect(alerts).toHaveLength(0);
  });

  it('should return full state', () => {
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 50 + i * 3,
        memoryTotal: 16000,
        memoryUsed: 8000 + i * 100,
        memoryFree: 8000 - i * 100,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const state = twin.getState();
    expect(state.snapshotCount).toBe(10);
    expect(state.lastSnapshot).not.toBeNull();
    expect(state.trends.length).toBeGreaterThan(0);
  });

  it('should clear all data', () => {
    twin.recordSnapshot({ cpuUsage: 50, memoryTotal: 16000, memoryUsed: 8000, memoryFree: 8000 });
    twin.clear();
    expect(twin.getSnapshots()).toHaveLength(0);
    expect(twin.getLastSnapshot()).toBeNull();
  });

  it('should record processes in graph', () => {
    twin.recordSnapshot({
      cpuUsage: 50,
      memoryTotal: 16000,
      memoryUsed: 8000,
      memoryFree: 8000,
      processes: [
        { name: 'node', cpu: 20, memory: 500, pid: 1234 },
        { name: 'postgres', cpu: 10, memory: 1000, pid: 5678 },
      ],
    });
    const graph = twin.getGraph();
    const stats = graph.stats();
    expect(stats.entities).toBeGreaterThan(0);
  });
});

describe('WhatIfEngine', () => {
  it('should simulate actions with LLM', async () => {
    const twin = new DigitalTwin(new EnvironmentGraph());
    twin.recordSnapshot({
      cpuUsage: 45,
      memoryTotal: 16000,
      memoryUsed: 8000,
      memoryFree: 8000,
    });
    const llm = new MockEchoProvider();
    const engine = new WhatIfEngine(twin, llm);
    const result = await engine.simulate('restart', 'database');
    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.recommendation.length).toBeGreaterThan(0);
  });

  it('should handle LLM errors with heuristic fallback', async () => {
    const twin = new DigitalTwin(new EnvironmentGraph());
    twin.recordSnapshot({
      cpuUsage: 45,
      memoryTotal: 16000,
      memoryUsed: 8000,
      memoryFree: 8000,
    });
    const failingLlm = {
      complete: async () => { throw new Error('LLM unavailable'); },
    };
    const engine = new WhatIfEngine(twin, failingLlm as any);
    const result = await engine.simulate('restart', 'database');
    expect(result.scenarios.length).toBeGreaterThan(0);
    expect(result.scenarios[0].name).toBe('Best Case');
    expect(result.scenarios[1].name).toBe('Worst Case');
  });

  it('should include system state in context', async () => {
    const twin = new DigitalTwin(new EnvironmentGraph());
    const now = Date.now();
    for (let i = 0; i < 10; i++) {
      twin.recordSnapshot({
        cpuUsage: 80 + i * 2,
        memoryTotal: 16000,
        memoryUsed: 14000 + i * 100,
        memoryFree: 2000 - i * 100,
        timestamp: new Date(now + i * 60 * 1000),
      });
    }
    const llm = new MockEchoProvider();
    const engine = new WhatIfEngine(twin, llm);
    const result = await engine.simulate('deploy', 'api-server');
    expect(result).toBeDefined();
    expect(result.scenarios.length).toBeGreaterThan(0);
  });
});
