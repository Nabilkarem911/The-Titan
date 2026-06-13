export type JsonRpcId = string | number | null;

export interface JsonRpcRequest<TParams = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  method: string;
  params?: TParams;
}

export interface JsonRpcNotification<TParams = unknown> {
  jsonrpc: '2.0';
  method: string;
  params?: TParams;
}

export interface JsonRpcSuccess<TResult = unknown> {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: TResult;
}

export interface JsonRpcError {
  jsonrpc: '2.0';
  id: JsonRpcId | null;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export type JsonRpcResponse<TResult = unknown> = JsonRpcSuccess<TResult> | JsonRpcError;

export type JsonRpcMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

export const JSON_RPC_ERROR = {
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
} as const;

export type WsSessionState = 'authenticating' | 'authenticated' | 'closed';

export interface WsClient {
  id: string;
  userId: string | null;
  workspaceId: string | null;
  state: WsSessionState;
  subscriptions: Set<string>;
  connectedAt: Date;
  lastPingAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
}
