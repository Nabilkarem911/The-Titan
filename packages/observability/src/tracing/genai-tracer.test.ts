import { describe, it, expect, beforeEach } from 'vitest';
import { GenAITracer } from './genai-tracer.js';

describe('GenAITracer', () => {
  let tracer: GenAITracer;

  beforeEach(() => {
    tracer = new GenAITracer();
  });

  it('starts and ends a trace', () => {
    const trace = tracer.startTrace('run-1');
    expect(trace.runId).toBe('run-1');
    expect(trace.spans.length).toBe(0);

    const ended = tracer.endTrace();
    expect(ended).toBeDefined();
    expect(ended!.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('starts and ends LLM spans with token tracking', () => {
    tracer.startTrace('run-1');
    const span = tracer.startLLMSpan('gpt-4o', {
      'gen_ai.request.model': 'gpt-4o',
      'gen_ai.request.max_tokens': 1000,
      'gen_ai.request.temperature': 0.7,
    });
    expect(span).not.toBeNull();
    expect(span!.kind).toBe('chat');
    expect(span!.attributes['gen_ai.request.model']).toBe('gpt-4o');

    tracer.endLLMSpan(span!.id, {
      responseModel: 'gpt-4o-2024',
      inputTokens: 500,
      outputTokens: 300,
      totalTokens: 800,
      cost: 0.012,
    });

    const trace = tracer.endTrace();
    expect(trace!.totalInputTokens).toBe(500);
    expect(trace!.totalOutputTokens).toBe(300);
    expect(trace!.totalCost).toBe(0.012);
    expect(trace!.modelCount['gpt-4o']).toBe(1);
  });

  it('starts and ends tool spans', () => {
    tracer.startTrace('run-1');
    const span = tracer.startToolSpan('execute_bash', 'run-1', { command: 'echo hello' });
    expect(span).not.toBeNull();
    expect(span!.kind).toBe('tool_execution');
    expect(span!.attributes['titan.tool.name']).toBe('execute_bash');

    tracer.endToolSpan(span!.id, { success: true, latencyMs: 50 });

    const trace = tracer.endTrace();
    expect(trace!.toolCount['execute_bash']).toBe(1);
  });

  it('tracks failed spans', () => {
    tracer.startTrace('run-1');
    const span = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    tracer.endLLMSpan(span!.id, { error: 'rate limited' });

    const trace = tracer.endTrace();
    const failedSpan = trace!.spans.find(s => s.id === span!.id);
    expect(failedSpan!.status).toBe('failed');
    expect(failedSpan!.events.some(e => e.name === 'exception')).toBe(true);
  });

  it('creates parent-child span hierarchy', () => {
    tracer.startTrace('run-1');
    const parent = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    const child = tracer.startToolSpan('search', 'run-1', {}, parent!.id);
    expect(child!.parentId).toBe(parent!.id);
    tracer.endToolSpan(child!.id, { success: true });
    tracer.endLLMSpan(parent!.id, { totalTokens: 100 });
    tracer.endTrace();
  });

  it('adds events to spans', () => {
    tracer.startTrace('run-1');
    const span = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    tracer.addEvent(span!.id, 'cache_hit', { key: 'system_prompt' });
    tracer.endLLMSpan(span!.id, { totalTokens: 100 });
    const trace = tracer.endTrace();
    const s = trace!.spans.find(s => s.id === span!.id);
    expect(s!.events.length).toBe(1);
    expect(s!.events[0].name).toBe('cache_hit');
  });

  it('tracks stats across multiple traces', () => {
    // Trace 1
    tracer.startTrace('run-1');
    const llm1 = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    tracer.endLLMSpan(llm1!.id, { inputTokens: 100, outputTokens: 50, totalTokens: 150, cost: 0.005 });
    const tool1 = tracer.startToolSpan('search', 'run-1');
    tracer.endToolSpan(tool1!.id, { success: true, latencyMs: 30 });
    tracer.endTrace();

    // Trace 2
    tracer.startTrace('run-2');
    const llm2 = tracer.startLLMSpan('claude-3', { 'gen_ai.request.model': 'claude-3' });
    tracer.endLLMSpan(llm2!.id, { inputTokens: 200, outputTokens: 100, totalTokens: 300, cost: 0.01 });
    tracer.endTrace();

    const stats = tracer.stats();
    expect(stats.totalTraces).toBe(2);
    expect(stats.totalSpans).toBe(3);
    expect(stats.totalInputTokens).toBe(300);
    expect(stats.totalOutputTokens).toBe(150);
    expect(stats.totalCost).toBeCloseTo(0.015, 3);
    expect(Object.keys(stats.byModel).length).toBe(2);
    expect(stats.byModel['gpt-4o'].calls).toBe(1);
    expect(stats.byModel['gpt-4o'].tokens).toBe(150);
    expect(stats.byTool['search'].calls).toBe(1);
    expect(stats.byTool['search'].successRate).toBe(100);
  });

  it('calculates error rate', () => {
    tracer.startTrace('run-1');
    const s1 = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    tracer.endLLMSpan(s1!.id, { totalTokens: 100 });
    const s2 = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    tracer.endLLMSpan(s2!.id, { error: 'failed' });
    const s3 = tracer.startToolSpan('bash', 'run-1');
    tracer.endToolSpan(s3!.id, { success: false });
    tracer.endTrace();

    const stats = tracer.stats();
    expect(stats.errorRate).toBeGreaterThan(0);
  });

  it('lists traces sorted by start time', () => {
    tracer.startTrace('run-1');
    tracer.endTrace();
    tracer.startTrace('run-2');
    tracer.endTrace();

    const list = tracer.listTraces();
    expect(list.length).toBe(2);
    expect(list[0].startTime.getTime()).toBeGreaterThanOrEqual(list[1].startTime.getTime());
  });

  it('finds trace by run ID', () => {
    tracer.startTrace('run-special');
    tracer.endTrace();
    const trace = tracer.getTraceByRunId('run-special');
    expect(trace).toBeDefined();
    expect(trace!.runId).toBe('run-special');
  });

  it('converts to standard TraceSpan format', () => {
    tracer.startTrace('run-1');
    const llm = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    tracer.endLLMSpan(llm!.id, { totalTokens: 100 });
    const trace = tracer.endTrace();

    const spans = tracer.toTraceSpans(trace!.id);
    expect(spans.length).toBe(1);
    expect(spans[0].type).toBe('llm_call');
    expect(spans[0].status).toBe('completed');
  });

  it('clears all traces', () => {
    tracer.startTrace('run-1');
    tracer.endTrace();
    tracer.clear();
    expect(tracer.stats().totalTraces).toBe(0);
  });

  it('returns null for spans without active trace', () => {
    const span = tracer.startLLMSpan('gpt-4o', { 'gen_ai.request.model': 'gpt-4o' });
    expect(span).toBeNull();
  });
});
