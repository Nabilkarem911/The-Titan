import {
  type JsonRpcRequest,
  type JsonRpcResponse,
  type JsonRpcSuccess,
  type JsonRpcError,
  type JsonRpcId,
  type JsonRpcNotification,
  type JsonRpcMessage,
  JSON_RPC_ERROR,
} from '@titan/shared';
import { WebSocketProtocolError } from '@titan/shared';

function isJsonRpcMessage(value: unknown): value is JsonRpcMessage {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  if (v.jsonrpc !== '2.0') return false;
  if (typeof v.method === 'string') {
    if (v.id === undefined) return true;
    if (typeof v.id === 'string' || typeof v.id === 'number' || v.id === null) return true;
    return false;
  }
  if (v.id !== undefined && (v.result !== undefined || v.error !== undefined)) {
    return typeof v.id === 'string' || typeof v.id === 'number' || v.id === null;
  }
  return false;
}

export function isRequest(msg: JsonRpcMessage): msg is JsonRpcRequest {
  return 'method' in msg && 'id' in msg;
}

export function isNotification(msg: JsonRpcMessage): msg is JsonRpcNotification {
  return 'method' in msg && !('id' in msg);
}

export function buildSuccess<T>(id: JsonRpcId, result: T): JsonRpcSuccess<T> {
  return { jsonrpc: '2.0', id, result };
}

function buildError(
  id: JsonRpcId | null,
  code: number,
  message: string,
  data?: unknown,
): JsonRpcError {
  return {
    jsonrpc: '2.0',
    id,
    error: data === undefined ? { code, message } : { code, message, data },
  };
}

export function buildParseError(details?: unknown): JsonRpcError {
  return buildError(null, JSON_RPC_ERROR.PARSE_ERROR, 'Parse error', details);
}

export function buildInvalidRequestError(id: JsonRpcId | null, details?: unknown): JsonRpcError {
  return buildError(id, JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid request', details);
}

export function buildMethodNotFoundError(id: JsonRpcId, method: string): JsonRpcError {
  return buildError(id, JSON_RPC_ERROR.METHOD_NOT_FOUND, `Method not found: ${method}`);
}

export function buildInvalidParamsError(id: JsonRpcId, details?: unknown): JsonRpcError {
  return buildError(id, JSON_RPC_ERROR.INVALID_PARAMS, 'Invalid params', details);
}

export function buildInternalError(id: JsonRpcId, message = 'Internal error', data?: unknown): JsonRpcError {
  return buildError(id, JSON_RPC_ERROR.INTERNAL_ERROR, message, data);
}

export function buildAuthFailedError(id: JsonRpcId | null, message = 'Authentication failed'): JsonRpcError {
  return buildError(id, JSON_RPC_ERROR.AUTH_FAILED, message);
}

export function buildRateLimitedError(id: JsonRpcId | null, retryAfter?: number): JsonRpcError {
  return buildError(id, JSON_RPC_ERROR.RATE_LIMITED, 'Rate limit exceeded', { retryAfter });
}

export function parseMessage(raw: string | Buffer): JsonRpcMessage {
  let value: unknown;
  try {
    value = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf-8'));
  } catch (err) {
    throw new WebSocketProtocolError('Failed to parse JSON', { cause: err });
  }
  if (!isJsonRpcMessage(value)) {
    throw new WebSocketProtocolError('Invalid JSON-RPC 2.0 message');
  }
  return value;
}

export function serializeMessage(msg: JsonRpcResponse | JsonRpcNotification): string {
  return JSON.stringify(msg);
}
