import { describe, it, expect } from 'vitest';
import {
  JSON_RPC_ERROR,
  type JsonRpcRequest,
  type JsonRpcNotification,
  type JsonRpcSuccess,
  type JsonRpcError,
  type JsonRpcResponse,
  type JsonRpcId,
  type WsSessionState,
  type WsClient,
} from './protocol.js';

/* ------------------------------------------------------------------ */
/*  JSON_RPC_ERROR constants                                           */
/* ------------------------------------------------------------------ */

describe('JSON_RPC_ERROR', () => {
  it('contains all standard JSON-RPC 2.0 error codes', () => {
    expect(JSON_RPC_ERROR.PARSE_ERROR).toBe(-32700);
    expect(JSON_RPC_ERROR.INVALID_REQUEST).toBe(-32600);
    expect(JSON_RPC_ERROR.METHOD_NOT_FOUND).toBe(-32601);
    expect(JSON_RPC_ERROR.INVALID_PARAMS).toBe(-32602);
    expect(JSON_RPC_ERROR.INTERNAL_ERROR).toBe(-32603);
  });

  it('contains custom Titan error codes', () => {
    expect(JSON_RPC_ERROR.AUTH_FAILED).toBe(-32001);
    expect(JSON_RPC_ERROR.RATE_LIMITED).toBe(-32002);
    expect(JSON_RPC_ERROR.TIMEOUT).toBe(-32003);
    expect(JSON_RPC_ERROR.CONNECTION_LIMIT).toBe(-32004);
    expect(JSON_RPC_ERROR.BACKPRESSURE).toBe(-32005);
    expect(JSON_RPC_ERROR.ABUSE_DETECTED).toBe(-32006);
    expect(JSON_RPC_ERROR.PAYLOAD_REJECTED).toBe(-32007);
  });

  it('has all error codes as negative numbers', () => {
    for (const [, value] of Object.entries(JSON_RPC_ERROR)) {
      expect(value).toBeLessThan(0);
      expect(Number.isInteger(value)).toBe(true);
    }
  });

  it('has exactly 12 error codes', () => {
    expect(Object.keys(JSON_RPC_ERROR)).toHaveLength(12);
  });

  it('has unique error code values', () => {
    const values = Object.values(JSON_RPC_ERROR);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('standard codes are in the -32700 to -32600 range', () => {
    expect(JSON_RPC_ERROR.PARSE_ERROR).toBe(-32700);
    expect(JSON_RPC_ERROR.INVALID_REQUEST).toBeGreaterThanOrEqual(-32700);
    expect(JSON_RPC_ERROR.INVALID_REQUEST).toBeLessThanOrEqual(-32600);
    expect(JSON_RPC_ERROR.METHOD_NOT_FOUND).toBeGreaterThanOrEqual(-32700);
    expect(JSON_RPC_ERROR.METHOD_NOT_FOUND).toBeLessThanOrEqual(-32600);
    expect(JSON_RPC_ERROR.INVALID_PARAMS).toBeGreaterThanOrEqual(-32700);
    expect(JSON_RPC_ERROR.INVALID_PARAMS).toBeLessThanOrEqual(-32600);
    expect(JSON_RPC_ERROR.INTERNAL_ERROR).toBeGreaterThanOrEqual(-32700);
    expect(JSON_RPC_ERROR.INTERNAL_ERROR).toBeLessThanOrEqual(-32600);
  });

  it('custom codes are in the -32000 range (server error)', () => {
    const customCodes = [
      JSON_RPC_ERROR.AUTH_FAILED,
      JSON_RPC_ERROR.RATE_LIMITED,
      JSON_RPC_ERROR.TIMEOUT,
      JSON_RPC_ERROR.CONNECTION_LIMIT,
      JSON_RPC_ERROR.BACKPRESSURE,
      JSON_RPC_ERROR.ABUSE_DETECTED,
      JSON_RPC_ERROR.PAYLOAD_REJECTED,
    ];
    for (const code of customCodes) {
      expect(code).toBeGreaterThanOrEqual(-32099);
      expect(code).toBeLessThanOrEqual(-32000);
    }
  });

  it('is frozen (const assertion prevents mutation)', () => {
    // The 'as const' assertion ensures the object is readonly at compile time.
    // At runtime, verify values match expected constants.
    const snapshot = { ...JSON_RPC_ERROR };
    expect(snapshot).toEqual({
      PARSE_ERROR: -32700,
      INVALID_REQUEST: -32600,
      METHOD_NOT_FOUND: -32601,
      INVALID_PARAMS: -32602,
      INTERNAL_ERROR: -32603,
      AUTH_FAILED: -32001,
      RATE_LIMITED: -32002,
      TIMEOUT: -32003,
      CONNECTION_LIMIT: -32004,
      BACKPRESSURE: -32005,
      ABUSE_DETECTED: -32006,
      PAYLOAD_REJECTED: -32007,
    });
  });
});

/* ------------------------------------------------------------------ */
/*  Type-level structural tests                                        */
/*  These verify that objects conforming to the interfaces compile and */
/*  have the expected runtime shapes.                                  */
/* ------------------------------------------------------------------ */

describe('JsonRpcRequest structure', () => {
  it('accepts a well-formed request', () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'agent.execute',
      params: { prompt: 'hello' },
    };
    expect(req.jsonrpc).toBe('2.0');
    expect(req.id).toBe(1);
    expect(req.method).toBe('agent.execute');
    expect(req.params).toEqual({ prompt: 'hello' });
  });

  it('accepts string id', () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 'req-abc-123',
      method: 'tool.list',
    };
    expect(req.id).toBe('req-abc-123');
  });

  it('accepts null id', () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: null,
      method: 'ping',
    };
    expect(req.id).toBeNull();
  });

  it('allows params to be omitted', () => {
    const req: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'status',
    };
    expect(req.params).toBeUndefined();
  });
});

describe('JsonRpcNotification structure', () => {
  it('has no id field', () => {
    const notif: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'progress.update',
      params: { percent: 50 },
    };
    expect(notif.jsonrpc).toBe('2.0');
    expect(notif.method).toBe('progress.update');
    expect((notif as Record<string, unknown>).id).toBeUndefined();
  });

  it('allows params to be omitted', () => {
    const notif: JsonRpcNotification = {
      jsonrpc: '2.0',
      method: 'heartbeat',
    };
    expect(notif.params).toBeUndefined();
  });
});

describe('JsonRpcSuccess structure', () => {
  it('contains result, no error', () => {
    const res: JsonRpcSuccess<string> = {
      jsonrpc: '2.0',
      id: 1,
      result: 'done',
    };
    expect(res.result).toBe('done');
    expect((res as Record<string, unknown>).error).toBeUndefined();
  });
});

describe('JsonRpcError structure', () => {
  it('contains error with code, message, and optional data', () => {
    const res: JsonRpcError = {
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: JSON_RPC_ERROR.METHOD_NOT_FOUND,
        message: 'Method not found',
        data: { method: 'foo.bar' },
      },
    };
    expect(res.error.code).toBe(-32601);
    expect(res.error.message).toBe('Method not found');
    expect(res.error.data).toEqual({ method: 'foo.bar' });
  });

  it('accepts error without data', () => {
    const res: JsonRpcError = {
      jsonrpc: '2.0',
      id: null,
      error: {
        code: JSON_RPC_ERROR.INTERNAL_ERROR,
        message: 'Internal error',
      },
    };
    expect(res.error.data).toBeUndefined();
  });
});

describe('JsonRpcResponse union', () => {
  it('can be a success response', () => {
    const res: JsonRpcResponse<number> = {
      jsonrpc: '2.0',
      id: 1,
      result: 42,
    };
    expect('result' in res).toBe(true);
  });

  it('can be an error response', () => {
    const res: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32600, message: 'Invalid request' },
    };
    expect('error' in res).toBe(true);
  });

  it('discriminates between success and error at runtime', () => {
    const success: JsonRpcResponse<string> = {
      jsonrpc: '2.0',
      id: 1,
      result: 'ok',
    };
    const error: JsonRpcResponse = {
      jsonrpc: '2.0',
      id: 1,
      error: { code: -32600, message: 'bad' },
    };

    function isSuccess(r: JsonRpcResponse): r is JsonRpcSuccess {
      return 'result' in r;
    }

    expect(isSuccess(success)).toBe(true);
    expect(isSuccess(error)).toBe(false);
  });
});

describe('JsonRpcId type', () => {
  it('accepts string, number, and null', () => {
    const ids: JsonRpcId[] = ['abc', 42, null];
    expect(ids).toHaveLength(3);
    expect(typeof ids[0]).toBe('string');
    expect(typeof ids[1]).toBe('number');
    expect(ids[2]).toBeNull();
  });
});

/* ------------------------------------------------------------------ */
/*  WebSocket types                                                    */
/* ------------------------------------------------------------------ */

describe('WsSessionState type', () => {
  it('represents the three valid states', () => {
    const states: WsSessionState[] = ['authenticating', 'authenticated', 'closed'];
    expect(states).toContain('authenticating');
    expect(states).toContain('authenticated');
    expect(states).toContain('closed');
  });
});

describe('WsClient structure', () => {
  it('holds all expected fields', () => {
    const client: WsClient = {
      id: 'ws-001',
      userId: 'user-123',
      workspaceId: 'ws-456',
      state: 'authenticated',
      subscriptions: new Set(['agent.events', 'system.logs']),
      connectedAt: new Date('2025-01-01T00:00:00Z'),
      lastPingAt: new Date('2025-01-01T00:01:00Z'),
      ipAddress: '192.168.1.1',
      userAgent: 'TitanClient/1.0',
    };

    expect(client.id).toBe('ws-001');
    expect(client.userId).toBe('user-123');
    expect(client.workspaceId).toBe('ws-456');
    expect(client.state).toBe('authenticated');
    expect(client.subscriptions.size).toBe(2);
    expect(client.subscriptions.has('agent.events')).toBe(true);
    expect(client.connectedAt).toBeInstanceOf(Date);
    expect(client.lastPingAt).toBeInstanceOf(Date);
    expect(client.ipAddress).toBe('192.168.1.1');
    expect(client.userAgent).toBe('TitanClient/1.0');
  });

  it('allows nullable fields to be null', () => {
    const client: WsClient = {
      id: 'ws-002',
      userId: null,
      workspaceId: null,
      state: 'authenticating',
      subscriptions: new Set(),
      connectedAt: new Date(),
      lastPingAt: new Date(),
      ipAddress: null,
      userAgent: null,
    };

    expect(client.userId).toBeNull();
    expect(client.workspaceId).toBeNull();
    expect(client.ipAddress).toBeNull();
    expect(client.userAgent).toBeNull();
    expect(client.subscriptions.size).toBe(0);
  });
});
