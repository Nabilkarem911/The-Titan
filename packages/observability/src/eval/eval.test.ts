import { describe, it, expect, vi } from 'vitest';
import { Evaluator, DEFAULT_BENCHMARKS } from './evaluator.js';
import { CostTracker } from './cost-tracker.js';
import { TraceCollector } from '../tracing/trace-collector.js';

// ── Evaluator ──

describe('Evaluator', () => {
  it('evaluates a correct answer', async () => {
    const evaluator = new Evaluator({
      runAgent: vi.fn().mockResolvedValue({ answer: '345', toolsUsed: ['calculate'], tokensUsed: 50, durationMs: 100 }),
    });

    const report = await evaluator.runBenchmark([
      { id: 'math', prompt: 'What is 15*23?', expectedAnswer: '345', category: 'accuracy', difficulty: 'easy' },
    ]);

    expect(report.passed).toBe(1);
    expect(report.results[0].score).toBeGreaterThan(40);
  });

  it('evaluates wrong answer poorly', async () => {
    const evaluator = new Evaluator({
      runAgent: vi.fn().mockResolvedValue({ answer: 'I dont know', toolsUsed: [], tokensUsed: 20, durationMs: 50 }),
    });

    const report = await evaluator.runBenchmark([
      { id: 'math', prompt: 'What is 15*23?', expectedAnswer: '345', category: 'accuracy', difficulty: 'easy' },
    ]);

    expect(report.results[0].score).toBeLessThan(50);
  });

  it('checks tool usage', async () => {
    const evaluator = new Evaluator({
      runAgent: vi.fn().mockResolvedValue({ answer: 'Found results', toolsUsed: ['brave_search'], tokensUsed: 100, durationMs: 200 }),
    });

    const report = await evaluator.runBenchmark([
      { id: 'search', prompt: 'Search for TS', expectedToolUse: ['brave_search'], category: 'tool_use', difficulty: 'medium' },
    ]);

    expect(report.results[0].score).toBeGreaterThan(40);
    expect(report.results[0].actualToolsUsed).toContain('brave_search');
  });

  it('handles agent errors gracefully', async () => {
    const evaluator = new Evaluator({
      runAgent: vi.fn().mockRejectedValue(new Error('Agent crashed')),
    });

    const report = await evaluator.runBenchmark([
      { id: 'fail', prompt: 'Test', category: 'accuracy', difficulty: 'easy' },
    ]);

    expect(report.failed).toBe(1);
    expect(report.results[0].score).toBe(0);
  });

  it('groups results by category', async () => {
    const evaluator = new Evaluator({
      runAgent: vi.fn().mockResolvedValue({ answer: 'ok', toolsUsed: [], tokensUsed: 50, durationMs: 100 }),
    });

    const report = await evaluator.runBenchmark([
      { id: 'a', prompt: 'Q1', category: 'accuracy', difficulty: 'easy' },
      { id: 'b', prompt: 'Q2', category: 'accuracy', difficulty: 'easy' },
      { id: 'c', prompt: 'Q3', category: 'safety', difficulty: 'hard' },
    ]);

    expect(report.byCategory['accuracy']?.total).toBe(2);
    expect(report.byCategory['safety']?.total).toBe(1);
  });

  it('has default benchmarks', () => {
    expect(DEFAULT_BENCHMARKS.length).toBeGreaterThan(5);
    expect(DEFAULT_BENCHMARKS.some((b) => b.category === 'safety')).toBe(true);
  });
});

// ── Cost Tracker ──

describe('CostTracker', () => {
  it('records and calculates cost', () => {
    const tracker = new CostTracker();
    tracker.record({ runId: 'r1', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500, totalTokens: 1500, timestamp: new Date() });

    expect(tracker.getTotalCost()).toBeGreaterThan(0);
  });

  it('tracks cost per run', () => {
    const tracker = new CostTracker();
    tracker.record({ runId: 'r1', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500, totalTokens: 1500, timestamp: new Date() });
    tracker.record({ runId: 'r2', model: 'gpt-4o', inputTokens: 2000, outputTokens: 1000, totalTokens: 3000, timestamp: new Date() });

    expect(tracker.getRunCost('r1')).toBeLessThan(tracker.getRunCost('r2'));
  });

  it('generates cost report', () => {
    const tracker = new CostTracker();
    tracker.record({ runId: 'r1', model: 'gpt-4o', inputTokens: 1000, outputTokens: 500, totalTokens: 1500, timestamp: new Date() });
    tracker.record({ runId: 'r2', model: 'claude-sonnet-4-6', inputTokens: 800, outputTokens: 400, totalTokens: 1200, timestamp: new Date() });

    const report = tracker.getReport();
    expect(report.entries).toBe(2);
    expect(Object.keys(report.byModel).length).toBe(2);
    expect(report.totalCost).toBeGreaterThan(0);
  });

  it('uses simple record method', () => {
    const tracker = new CostTracker();
    tracker.recordSimple('r1', 'gpt-4o-mini', 5000);
    expect(tracker.getTotalCost()).toBeGreaterThan(0);
  });

  it('clears entries', () => {
    const tracker = new CostTracker();
    tracker.recordSimple('r1', 'gpt-4o', 1000);
    tracker.clear();
    expect(tracker.getTotalCost()).toBe(0);
  });
});

// ── Trace Collector ──

describe('TraceCollector', () => {
  it('creates and completes a trace', () => {
    const collector = new TraceCollector();
    const trace = collector.startTrace('run-1');
    collector.endTrace(trace.id);

    const completed = collector.getTrace(trace.id);
    expect(completed?.totalDurationMs).toBeDefined();
  });

  it('adds spans to a trace', () => {
    const collector = new TraceCollector();
    const trace = collector.startTrace('run-1');

    const span1 = collector.startSpan(trace.id, 'LLM Call', 'llm_call', { prompt: 'test' });
    collector.endSpan(trace.id, span1.id, { response: 'result' });

    const span2 = collector.startSpan(trace.id, 'Tool Call', 'tool_call', { name: 'search' }, span1.id);
    collector.endSpan(trace.id, span2.id, { data: 'found' });

    collector.endTrace(trace.id);

    const completed = collector.getTrace(trace.id);
    expect(completed?.spans.length).toBe(2);
    expect(completed?.spans[0].status).toBe('completed');
    expect(completed?.spans[1].parentId).toBe(span1.id);
  });

  it('marks failed spans', () => {
    const collector = new TraceCollector();
    const trace = collector.startTrace('run-1');
    const span = collector.startSpan(trace.id, 'Failed Op', 'tool_call');
    collector.endSpan(trace.id, span.id, 'error occurred', 'failed');

    expect(collector.getTrace(trace.id)?.spans[0].status).toBe('failed');
  });

  it('finds trace by run ID', () => {
    const collector = new TraceCollector();
    collector.startTrace('run-42');

    const found = collector.getTraceByRunId('run-42');
    expect(found).toBeDefined();
    expect(found?.runId).toBe('run-42');
  });

  it('builds span tree', () => {
    const collector = new TraceCollector();
    const trace = collector.startTrace('run-1');
    const root = collector.startSpan(trace.id, 'Root', 'llm_call');
    collector.startSpan(trace.id, 'Child 1', 'tool_call', undefined, root.id);
    collector.startSpan(trace.id, 'Child 2', 'tool_call', undefined, root.id);

    const tree = collector.getSpanTree(trace.id);
    expect(tree.length).toBe(1);
    expect(tree[0].children.length).toBe(2);
  });

  it('reports stats', () => {
    const collector = new TraceCollector();
    const t1 = collector.startTrace('r1');
    collector.startSpan(t1.id, 'S1', 'llm_call');
    collector.startSpan(t1.id, 'S2', 'tool_call');
    collector.endTrace(t1.id);

    const stats = collector.getStats();
    expect(stats.totalTraces).toBe(1);
    expect(stats.avgSpans).toBe(2);
  });

  it('lists traces sorted by time', () => {
    const collector = new TraceCollector();
    collector.startTrace('r1');
    collector.startTrace('r2');

    const list = collector.listTraces();
    expect(list.length).toBe(2);
  });
});
