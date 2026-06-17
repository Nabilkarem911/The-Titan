import { describe, it, expect } from 'vitest';
import {
  runWithLogContext,
  getLogContext,
  setLogContextField,
  mergeLogContext,
  type LogContext,
} from './context.js';

describe('getLogContext()', () => {
  it('returns undefined outside of a context run', () => {
    expect(getLogContext()).toBeUndefined();
  });
});

describe('runWithLogContext()', () => {
  it('provides context inside the callback', () => {
    const ctx: LogContext = { requestId: 'req-1', userId: 'user-42' };

    runWithLogContext(ctx, () => {
      const current = getLogContext();

      expect(current).toBeDefined();
      expect(current!.requestId).toBe('req-1');
      expect(current!.userId).toBe('user-42');
    });
  });

  it('returns the callback return value', () => {
    const result = runWithLogContext({ requestId: 'req-2' }, () => 'hello');

    expect(result).toBe('hello');
  });

  it('isolates context — does not leak after callback', () => {
    runWithLogContext({ requestId: 'req-3' }, () => {
      expect(getLogContext()!.requestId).toBe('req-3');
    });

    expect(getLogContext()).toBeUndefined();
  });

  it('creates a shallow copy so mutations do not affect original', () => {
    const original: LogContext = { requestId: 'req-4' };

    runWithLogContext(original, () => {
      setLogContextField('extra', 'added');
      expect(getLogContext()!.extra).toBe('added');
    });

    // Original object should not have the extra field
    expect(original.extra).toBeUndefined();
  });

  it('supports nested contexts', () => {
    runWithLogContext({ requestId: 'outer' }, () => {
      expect(getLogContext()!.requestId).toBe('outer');

      runWithLogContext({ requestId: 'inner', sessionId: 'sess-1' }, () => {
        const inner = getLogContext()!;
        expect(inner.requestId).toBe('inner');
        expect(inner.sessionId).toBe('sess-1');
      });

      // Outer context is restored
      const restored = getLogContext()!;
      expect(restored.requestId).toBe('outer');
      expect(restored.sessionId).toBeUndefined();
    });
  });
});

describe('setLogContextField()', () => {
  it('sets a field in the current context', () => {
    runWithLogContext({ requestId: 'req-5' }, () => {
      setLogContextField('traceId', 'trace-abc');

      const ctx = getLogContext()!;
      expect(ctx.traceId).toBe('trace-abc');
      expect(ctx.requestId).toBe('req-5');
    });
  });

  it('is a no-op when called outside a context', () => {
    // Should not throw
    expect(() => setLogContextField('key', 'value')).not.toThrow();
  });
});

describe('mergeLogContext()', () => {
  it('merges extra fields into the current context', () => {
    runWithLogContext({ requestId: 'req-6' }, () => {
      const result = mergeLogContext({ userId: 'user-99', spanId: 'span-1' });

      expect(result.requestId).toBe('req-6');
      expect(result.userId).toBe('user-99');
      expect(result.spanId).toBe('span-1');

      // The store itself is updated
      const ctx = getLogContext()!;
      expect(ctx.userId).toBe('user-99');
    });
  });

  it('returns the extra object when called outside a context', () => {
    const extra: LogContext = { agentRunId: 'run-1' };
    const result = mergeLogContext(extra);

    expect(result).toBe(extra);
  });

  it('overwrites existing fields with merged values', () => {
    runWithLogContext({ requestId: 'req-7', userId: 'old' }, () => {
      mergeLogContext({ userId: 'new' });

      expect(getLogContext()!.userId).toBe('new');
      expect(getLogContext()!.requestId).toBe('req-7');
    });
  });
});
