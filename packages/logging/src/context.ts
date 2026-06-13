import { AsyncLocalStorage } from 'node:async_hooks';

export interface LogContext {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  sessionId?: string;
  agentRunId?: string;
  traceId?: string;
  spanId?: string;
  [key: string]: unknown;
}

const storage = new AsyncLocalStorage<LogContext>();

export function runWithLogContext<T>(ctx: LogContext, fn: () => T): T {
  return storage.run({ ...ctx }, fn);
}

export function getLogContext(): LogContext | undefined {
  return storage.getStore();
}

export function setLogContextField(key: string, value: unknown): void {
  const store = storage.getStore();
  if (store) store[key] = value;
}

export function mergeLogContext(extra: LogContext): LogContext {
  const store = storage.getStore();
  if (!store) return extra;
  Object.assign(store, extra);
  return store;
}
