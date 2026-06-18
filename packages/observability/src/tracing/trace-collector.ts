import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { Trace, TraceSpan } from '../eval/types.js';

const log = getLogger().child({ component: 'trace-collector' });

export class TraceCollector {
  private traces: Map<string, Trace> = new Map();
  private maxTraces: number;

  constructor(maxTraces = 500) {
    this.maxTraces = maxTraces;
  }

  startTrace(runId: string): Trace {
    const trace: Trace = {
      id: randomUUID(),
      runId,
      spans: [],
      startTime: new Date(),
    };

    this.traces.set(trace.id, trace);

    if (this.traces.size > this.maxTraces) {
      const oldest = Array.from(this.traces.keys())[0];
      this.traces.delete(oldest);
    }

    return trace;
  }

  startSpan(traceId: string, name: string, type: TraceSpan['type'], input?: unknown, parentId?: string): TraceSpan {
    const span: TraceSpan = {
      id: randomUUID(),
      parentId,
      name,
      type,
      startTime: new Date(),
      input,
      status: 'running',
    };

    const trace = this.traces.get(traceId);
    if (trace) {
      trace.spans.push(span);
    }

    return span;
  }

  endSpan(traceId: string, spanId: string, output?: unknown, status: 'completed' | 'failed' = 'completed'): void {
    const trace = this.traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find((s) => s.id === spanId);
    if (!span) return;

    span.endTime = new Date();
    span.durationMs = span.endTime.getTime() - span.startTime.getTime();
    span.output = output;
    span.status = status;
  }

  endTrace(traceId: string): Trace | undefined {
    const trace = this.traces.get(traceId);
    if (!trace) return undefined;

    trace.endTime = new Date();
    trace.totalDurationMs = trace.endTime.getTime() - trace.startTime.getTime();

    log.info({
      traceId,
      runId: trace.runId,
      spans: trace.spans.length,
      durationMs: trace.totalDurationMs,
    }, 'trace completed');

    return trace;
  }

  getTrace(traceId: string): Trace | undefined {
    return this.traces.get(traceId);
  }

  getTraceByRunId(runId: string): Trace | undefined {
    return Array.from(this.traces.values()).find((t) => t.runId === runId);
  }

  getSpanTree(traceId: string): Array<TraceSpan & { children: TraceSpan[] }> {
    const trace = this.traces.get(traceId);
    if (!trace) return [];

    const rootSpans = trace.spans.filter((s) => !s.parentId);
    return rootSpans.map((root) => ({
      ...root,
      children: trace.spans.filter((s) => s.parentId === root.id),
    }));
  }

  getStats(): { totalTraces: number; avgSpans: number; avgDurationMs: number } {
    const traces = Array.from(this.traces.values());
    const completed = traces.filter((t) => t.totalDurationMs !== undefined);

    return {
      totalTraces: traces.length,
      avgSpans: traces.length > 0 ? traces.reduce((s, t) => s + t.spans.length, 0) / traces.length : 0,
      avgDurationMs: completed.length > 0 ? completed.reduce((s, t) => s + (t.totalDurationMs ?? 0), 0) / completed.length : 0,
    };
  }

  listTraces(limit = 20): Trace[] {
    return Array.from(this.traces.values())
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }

  clear(): void {
    this.traces.clear();
  }
}
