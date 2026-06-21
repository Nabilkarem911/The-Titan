import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram, setGauge } from '../metrics.js';
import type { TraceSpan } from '../eval/types.js';

const log = getLogger().child({ component: 'genai-tracing' });

// OpenTelemetry GenAI Semantic Conventions
// Based on: https://opentelemetry.io/docs/specs/semconv/gen-ai/

export type GenAISpanKind = 'chat' | 'text_completion' | 'embeddings' | 'image' | 'audio' | 'tool_execution';

export interface GenAISpanAttributes {
  // gen_ai.* attributes per OTel semantic conventions
  'gen_ai.system': string;
  'gen_ai.request.model': string;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.top_p'?: number;
  'gen_ai.request.frequency_penalty'?: number;
  'gen_ai.request.presence_penalty'?: number;
  'gen_ai.request.stop'?: string[];
  'gen_ai.response.id'?: string;
  'gen_ai.response.model'?: string;
  'gen_ai.response.finish_reasons'?: string[];
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'gen_ai.usage.total_tokens'?: number;
  'gen_ai.token.type'?: 'input' | 'output' | 'total';
  // Titan-specific extensions
  'titan.agent.id'?: string;
  'titan.agent.run_id'?: string;
  'titan.agent.step'?: number;
  'titan.routing.model_id'?: string;
  'titan.routing.tier'?: string;
  'titan.routing.complexity'?: number;
  'titan.routing.strategy'?: string;
  'titan.tool.name'?: string;
  'titan.tool.success'?: boolean;
  'titan.cost.estimated'?: number;
  'titan.latency.ms'?: number;
}

export interface GenAISpan {
  id: string;
  parentId?: string;
  name: string;
  kind: GenAISpanKind;
  attributes: GenAISpanAttributes;
  startTime: Date;
  endTime?: Date;
  durationMs?: number;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  events: GenAIEvent[];
  links?: Array<{ spanId: string; traceId: string }>;
}

export interface GenAIEvent {
  name: string;
  timestamp: Date;
  attributes?: Record<string, unknown>;
}

export interface GenAITrace {
  id: string;
  runId: string;
  spans: GenAISpan[];
  startTime: Date;
  endTime?: Date;
  totalDurationMs?: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  modelCount: Record<string, number>;
  toolCount: Record<string, number>;
}

export interface GenAITracingStats {
  totalTraces: number;
  totalSpans: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  byKind: Record<string, { count: number; avgDurationMs: number }>;
  byModel: Record<string, { calls: number; tokens: number }>;
  byTool: Record<string, { calls: number; successRate: number }>;
  errorRate: number;
  avgTraceDurationMs: number;
}

export class GenAITracer {
  private traces: Map<string, GenAITrace> = new Map();
  private maxTraces = 500;
  private currentTrace: GenAITrace | null = null;
  private spanStack: GenAISpan[] = [];

  startTrace(runId: string): GenAITrace {
    const trace: GenAITrace = {
      id: randomUUID(),
      runId,
      spans: [],
      startTime: new Date(),
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCost: 0,
      modelCount: {},
      toolCount: {},
    };

    this.traces.set(trace.id, trace);
    this.currentTrace = trace;

    if (this.traces.size > this.maxTraces) {
      const oldest = Array.from(this.traces.keys())[0];
      this.traces.delete(oldest);
    }

    incCounter('genai_trace_started', 'GenAI traces started', 1);
    log.debug({ traceId: trace.id, runId }, 'GenAI trace started');

    return trace;
  }

  startLLMSpan(
    name: string,
    attrs: Partial<GenAISpanAttributes>,
    parentId?: string,
  ): GenAISpan | null {
    if (!this.currentTrace) return null;

    const span: GenAISpan = {
      id: randomUUID(),
      parentId: parentId ?? this.spanStack[this.spanStack.length - 1]?.id,
      name: `gen_ai.chat ${name}`,
      kind: 'chat',
      attributes: {
        'gen_ai.system': attrs['gen_ai.system'] ?? 'titan',
        'gen_ai.request.model': attrs['gen_ai.request.model'] ?? 'unknown',
        ...attrs,
      },
      startTime: new Date(),
      status: 'running',
      events: [],
    };

    this.currentTrace.spans.push(span);
    this.spanStack.push(span);

    incCounter('genai_llm_span_started', 'GenAI LLM spans started', 1, {
      model: attrs['gen_ai.request.model'] ?? 'unknown',
    });

    return span;
  }

  endLLMSpan(
    spanId: string,
    result: {
      responseModel?: string;
      finishReasons?: string[];
      inputTokens?: number;
      outputTokens?: number;
      totalTokens?: number;
      cost?: number;
      error?: string;
    },
  ): void {
    const trace = this.currentTrace;
    if (!trace) return;

    const span = trace.spans.find(s => s.id === spanId);
    if (!span) return;

    span.endTime = new Date();
    span.durationMs = span.endTime.getTime() - span.startTime.getTime();
    span.status = result.error ? 'failed' : 'completed';

    if (result.responseModel) span.attributes['gen_ai.response.model'] = result.responseModel;
    if (result.finishReasons) span.attributes['gen_ai.response.finish_reasons'] = result.finishReasons;
    if (result.inputTokens) {
      span.attributes['gen_ai.usage.input_tokens'] = result.inputTokens;
      trace.totalInputTokens += result.inputTokens;
    }
    if (result.outputTokens) {
      span.attributes['gen_ai.usage.output_tokens'] = result.outputTokens;
      trace.totalOutputTokens += result.outputTokens;
    }
    if (result.totalTokens) span.attributes['gen_ai.usage.total_tokens'] = result.totalTokens;
    if (result.cost) {
      span.attributes['titan.cost.estimated'] = result.cost;
      trace.totalCost += result.cost;
    }

    if (result.error) {
      span.events.push({
        name: 'exception',
        timestamp: new Date(),
        attributes: { 'exception.message': result.error },
      });
    }

    const model = span.attributes['gen_ai.request.model'] ?? 'unknown';
    trace.modelCount[model] = (trace.modelCount[model] ?? 0) + 1;

    // Remove from span stack
    this.spanStack = this.spanStack.filter(s => s.id !== spanId);

    // Record metrics
    incCounter('genai_llm_span_completed', 'GenAI LLM spans completed', 1, {
      model,
      status: span.status,
    });
    observeHistogram('genai_llm_duration_ms', 'GenAI LLM span duration', span.durationMs, undefined, { model });
    if (result.totalTokens) {
      observeHistogram('genai_llm_tokens', 'GenAI LLM token usage', result.totalTokens, undefined, { model });
    }
    if (result.cost) {
      observeHistogram('genai_llm_cost', 'GenAI LLM cost', result.cost, undefined, { model });
    }

    log.debug({ spanId, model, durationMs: span.durationMs, tokens: result.totalTokens }, 'GenAI LLM span ended');
  }

  startToolSpan(
    toolName: string,
    runId: string,
    params?: Record<string, unknown>,
    parentId?: string,
  ): GenAISpan | null {
    if (!this.currentTrace) return null;

    const span: GenAISpan = {
      id: randomUUID(),
      parentId: parentId ?? this.spanStack[this.spanStack.length - 1]?.id,
      name: `titan.tool ${toolName}`,
      kind: 'tool_execution',
      attributes: {
        'gen_ai.system': 'titan',
        'gen_ai.request.model': 'n/a',
        'titan.tool.name': toolName,
      },
      startTime: new Date(),
      status: 'running',
      events: [],
    };

    this.currentTrace.spans.push(span);
    this.spanStack.push(span);

    incCounter('genai_tool_span_started', 'GenAI tool spans started', 1, { tool: toolName });

    return span;
  }

  endToolSpan(
    spanId: string,
    result: { success: boolean; latencyMs?: number; error?: string; data?: unknown },
  ): void {
    const trace = this.currentTrace;
    if (!trace) return;

    const span = trace.spans.find(s => s.id === spanId);
    if (!span) return;

    span.endTime = new Date();
    span.durationMs = result.latencyMs ?? (span.endTime.getTime() - span.startTime.getTime());
    span.status = result.success ? 'completed' : 'failed';
    span.attributes['titan.tool.success'] = result.success;
    span.attributes['titan.latency.ms'] = span.durationMs;

    if (result.error) {
      span.events.push({
        name: 'exception',
        timestamp: new Date(),
        attributes: { 'exception.message': result.error },
      });
    }

    const toolName = span.attributes['titan.tool.name'] ?? 'unknown';
    trace.toolCount[toolName] = (trace.toolCount[toolName] ?? 0) + 1;

    this.spanStack = this.spanStack.filter(s => s.id !== spanId);

    incCounter('genai_tool_span_completed', 'GenAI tool spans completed', 1, {
      tool: toolName,
      status: span.status,
    });
    observeHistogram('genai_tool_duration_ms', 'GenAI tool span duration', span.durationMs, undefined, { tool: toolName });

    log.debug({ spanId, tool: toolName, durationMs: span.durationMs, success: result.success }, 'GenAI tool span ended');
  }

  addEvent(spanId: string, eventName: string, attrs?: Record<string, unknown>): void {
    const trace = this.currentTrace;
    if (!trace) return;
    const span = trace.spans.find(s => s.id === spanId);
    if (!span) return;
    span.events.push({ name: eventName, timestamp: new Date(), attributes: attrs });
  }

  endTrace(): GenAITrace | undefined {
    const trace = this.currentTrace;
    if (!trace) return undefined;

    trace.endTime = new Date();
    trace.totalDurationMs = trace.endTime.getTime() - trace.startTime.getTime();

    setGauge('genai_trace_duration_ms', 'GenAI trace duration', trace.totalDurationMs, { runId: trace.runId });
    setGauge('genai_trace_total_tokens', 'GenAI trace total tokens', trace.totalInputTokens + trace.totalOutputTokens, { runId: trace.runId });
    setGauge('genai_trace_cost', 'GenAI trace cost', trace.totalCost, { runId: trace.runId });

    incCounter('genai_trace_completed', 'GenAI traces completed', 1, {
      spans: trace.spans.length,
    });

    log.info({
      traceId: trace.id,
      runId: trace.runId,
      spans: trace.spans.length,
      durationMs: trace.totalDurationMs,
      inputTokens: trace.totalInputTokens,
      outputTokens: trace.totalOutputTokens,
      cost: trace.totalCost,
    }, 'GenAI trace completed');

    this.currentTrace = null;
    this.spanStack = [];

    return trace;
  }

  getTrace(traceId: string): GenAITrace | undefined {
    return this.traces.get(traceId);
  }

  getTraceByRunId(runId: string): GenAITrace | undefined {
    return Array.from(this.traces.values()).find(t => t.runId === runId);
  }

  listTraces(limit = 20): GenAITrace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  stats(): GenAITracingStats {
    const traces = Array.from(this.traces.values());
    const allSpans = traces.flatMap(t => t.spans);
    const completed = traces.filter(t => t.totalDurationMs !== undefined);

    const byKind: Record<string, { count: number; totalDuration: number }> = {};
    const byModel: Record<string, { calls: number; tokens: number }> = {};
    const byTool: Record<string, { calls: number; successes: number }> = {};
    let errorCount = 0;

    for (const span of allSpans) {
      const kind = span.kind;
      if (!byKind[kind]) byKind[kind] = { count: 0, totalDuration: 0 };
      byKind[kind].count++;
      byKind[kind].totalDuration += span.durationMs ?? 0;

      if (span.status === 'failed') errorCount++;

      if (span.kind === 'chat') {
        const model = span.attributes['gen_ai.request.model'] ?? 'unknown';
        if (!byModel[model]) byModel[model] = { calls: 0, tokens: 0 };
        byModel[model].calls++;
        byModel[model].tokens += span.attributes['gen_ai.usage.total_tokens'] ?? 0;
      }

      if (span.kind === 'tool_execution') {
        const tool = span.attributes['titan.tool.name'] ?? 'unknown';
        if (!byTool[tool]) byTool[tool] = { calls: 0, successes: 0 };
        byTool[tool].calls++;
        if (span.attributes['titan.tool.success'] === true) byTool[tool].successes++;
      }
    }

    return {
      totalTraces: traces.length,
      totalSpans: allSpans.length,
      totalInputTokens: traces.reduce((s, t) => s + t.totalInputTokens, 0),
      totalOutputTokens: traces.reduce((s, t) => s + t.totalOutputTokens, 0),
      totalCost: traces.reduce((s, t) => s + t.totalCost, 0),
      byKind: Object.fromEntries(
        Object.entries(byKind).map(([k, v]) => [k, { count: v.count, avgDurationMs: v.count > 0 ? Math.round(v.totalDuration / v.count) : 0 }]),
      ),
      byModel: Object.fromEntries(
        Object.entries(byModel).map(([k, v]) => [k, { calls: v.calls, tokens: v.tokens }]),
      ),
      byTool: Object.fromEntries(
        Object.entries(byTool).map(([k, v]) => [k, { calls: v.calls, successRate: v.calls > 0 ? Math.round((v.successes / v.calls) * 100) : 0 }]),
      ),
      errorRate: allSpans.length > 0 ? Math.round((errorCount / allSpans.length) * 100) : 0,
      avgTraceDurationMs: completed.length > 0
        ? Math.round(completed.reduce((s, t) => s + (t.totalDurationMs ?? 0), 0) / completed.length)
        : 0,
    };
  }

  clear(): void {
    this.traces.clear();
    this.currentTrace = null;
    this.spanStack = [];
  }

  // Convert GenAI trace to standard TraceSpan format for backward compatibility
  toTraceSpans(traceId: string): TraceSpan[] {
    const trace = this.traces.get(traceId);
    if (!trace) return [];

    return trace.spans.map(s => ({
      id: s.id,
      parentId: s.parentId,
      name: s.name,
      type: s.kind === 'chat' ? 'llm_call' : s.kind === 'tool_execution' ? 'tool_call' : 'custom',
      startTime: s.startTime,
      endTime: s.endTime,
      durationMs: s.durationMs,
      input: s.attributes as unknown as Record<string, unknown>,
      output: s.events as unknown,
      metadata: s.attributes as unknown as Record<string, unknown>,
      status: s.status === 'running' ? 'running' : s.status === 'completed' ? 'completed' : 'failed',
    }));
  }
}
