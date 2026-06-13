import { z } from 'zod';
import type { JsonRpcRequest, JsonRpcNotification, JsonRpcId } from '@titan/shared';

export type RpcHandler<TParams = unknown, TResult = unknown> = (
  params: TParams,
  context: RpcContext,
) => Promise<TResult> | TResult;

export interface RpcContext {
  clientId: string;
  userId: string;
  workspaceId?: string;
  sessionId?: string;
  apiKeyId?: string;
}

export type RpcNotificationHandler<TParams = unknown> = (
  params: TParams,
  context: RpcContext,
) => Promise<void> | void;

interface RegisteredHandler {
  method: string;
  schema?: z.ZodType<unknown>;
  handler: RpcHandler<unknown, unknown>;
  description?: string;
}

interface RegisteredNotificationHandler {
  method: string;
  schema?: z.ZodType<unknown>;
  handler: RpcNotificationHandler<unknown>;
}

export class RpcRouter {
  private handlers = new Map<string, RegisteredHandler>();
  private notificationHandlers = new Map<string, RegisteredNotificationHandler>();

  registerMethod<TParams, TResult>(
    method: string,
    handler: RpcHandler<TParams, TResult>,
    options?: { schema?: z.ZodType<TParams>; description?: string },
  ): void {
    if (this.handlers.has(method) || this.notificationHandlers.has(method)) {
      throw new Error(`RPC method already registered: ${method}`);
    }
    this.handlers.set(method, {
      method,
      schema: options?.schema as z.ZodType<unknown> | undefined,
      handler: handler as RpcHandler<unknown, unknown>,
      ...(options?.description !== undefined ? { description: options.description } : {}),
    });
  }

  registerNotification<TParams>(
    method: string,
    handler: RpcNotificationHandler<TParams>,
    options?: { schema?: z.ZodType<TParams> },
  ): void {
    if (this.handlers.has(method) || this.notificationHandlers.has(method)) {
      throw new Error(`RPC method already registered: ${method}`);
    }
    this.notificationHandlers.set(method, {
      method,
      schema: options?.schema as z.ZodType<unknown> | undefined,
      handler: handler as RpcNotificationHandler<unknown>,
    });
  }

  getHandler(method: string): RegisteredHandler | undefined {
    return this.handlers.get(method);
  }

  getNotificationHandler(method: string): RegisteredNotificationHandler | undefined {
    return this.notificationHandlers.get(method);
  }

  listMethods(): Array<{ method: string; type: 'request' | 'notification'; description?: string }> {
    const result: Array<{ method: string; type: 'request' | 'notification'; description?: string }> = [];
    for (const h of this.handlers.values()) {
      result.push({ method: h.method, type: 'request', ...(h.description ? { description: h.description } : {}) });
    }
    for (const h of this.notificationHandlers.values()) {
      result.push({ method: h.method, type: 'notification' });
    }
    return result.sort((a, b) => a.method.localeCompare(b.method));
  }

  async dispatchRequest(
    req: JsonRpcRequest,
    ctx: RpcContext,
  ): Promise<{ id: JsonRpcId; result?: unknown; error?: { code: number; message: string; data?: unknown } }> {
    const h = this.handlers.get(req.method);
    if (!h) {
      return { id: req.id, error: { code: -32601, message: `Method not found: ${req.method}` } };
    }
    let validated: unknown = req.params;
    if (h.schema) {
      const parsed = h.schema.safeParse(req.params);
      if (!parsed.success) {
        return {
          id: req.id,
          error: {
            code: -32602,
            message: 'Invalid params',
            data: parsed.error.issues,
          },
        };
      }
      validated = parsed.data;
    }
    try {
      const result = await h.handler(validated, ctx);
      return { id: req.id, result };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return { id: req.id, error: { code: -32603, message } };
    }
  }

  async dispatchNotification(
    notif: JsonRpcNotification,
    ctx: RpcContext,
  ): Promise<{ error?: { code: number; message: string; data?: unknown } }> {
    const h = this.notificationHandlers.get(notif.method);
    if (!h) {
      return { error: { code: -32601, message: `Method not found: ${notif.method}` } };
    }
    let validated: unknown = notif.params;
    if (h.schema) {
      const parsed = h.schema.safeParse(notif.params);
      if (!parsed.success) {
        return {
          error: {
            code: -32602,
            message: 'Invalid params',
            data: parsed.error.issues,
          },
        };
      }
      validated = parsed.data;
    }
    try {
      await h.handler(validated, ctx);
      return {};
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal error';
      return { error: { code: -32603, message } };
    }
  }
}
