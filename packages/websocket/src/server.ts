import { WebSocketServer, type WebSocket } from 'ws';
import { IncomingMessage } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { resolveAuthFromAccessToken, resolveAuthFromApiKey } from '@titan/auth';
import {
  type JsonRpcId,
  type JsonRpcMessage,
  type JsonRpcRequest,
  type JsonRpcNotification,
  WS_PROTOCOL_VERSION,
  JSON_RPC_ERROR,
} from '@titan/shared';
import {
  buildInvalidRequestError,
  buildInternalError,
  buildMethodNotFoundError,
  buildParseError,
  parseMessage,
  serializeMessage,
  isRequest,
  isNotification,
} from './protocol.js';
import { RpcRouter, type RpcContext } from './router.js';
import {
  TokenBucketRateLimiter,
  buildHybridKey,
  getAbuseDetector,
  incCounter,
  setGauge,
  observeHistogram,
} from '@titan/observability';

const log = getLogger().child({ component: 'websocket' });

interface AliveSocket extends WebSocket {
  isAlive: boolean;
  lastPongAt: number;
  lastPingSentAt: number;
}

interface ClientEntry {
  id: string;
  socket: AliveSocket;
  state: 'authenticating' | 'authenticated' | 'closed';
  userId: string | null;
  workspaceId: string | null;
  sessionId: string | null;
  apiKeyId: string | null;
  connectedAt: Date;
  lastPingAt: Date;
  ipAddress: string | null;
  userAgent: string | null;
  authPromise: Promise<void> | null;
  pingTimer: NodeJS.Timeout | null;
  messageCount: number;
  firstMessageAt: number | null;
  lastMessageAt: number | null;
  messageRateLimiter: { ip: string; user: string };
  outboxBytes: number;
  backpressureDrops: number;
}

export interface WsServerOptions {
  router: RpcRouter;
  path?: string;
}

export class TitanWebSocketServer {
  private wss: WebSocketServer;
  private clients = new Map<string, ClientEntry>();
  private userConnectionCount = new Map<string, number>();
  private ipConnectionCount = new Map<string, number>();
  private ipReconnectLog = new Map<string, number[]>();
  private counterMutex: Promise<void> = Promise.resolve();
  private router: RpcRouter;
  private path: string;
  private pingIntervalMs: number;
  private pingTimeoutMs: number;
  private maxPayload: number;
  private maxConnectionsPerUser: number;
  private maxConnectionsPerIp: number;
  private allowedOrigins: string[];
  private messageLimiter: TokenBucketRateLimiter;
  private reconnectWindowMs: number;
  private maxReconnectsPerWindow: number;
  private backpressureHighWater: number;
  private backpressureDropThreshold: number;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private reconnectCleanupInterval: NodeJS.Timeout | null = null;

  constructor(opts: WsServerOptions) {
    const c = loadConfig();
    this.router = opts.router;
    this.path = opts.path ?? c.WS_PATH;
    this.pingIntervalMs = c.WS_PING_INTERVAL;
    this.pingTimeoutMs = c.WS_PING_TIMEOUT;
    this.maxPayload = c.WS_MAX_PAYLOAD;
    this.maxConnectionsPerUser = c.WS_MAX_CONNECTIONS_PER_USER;
    this.maxConnectionsPerIp = c.WS_MAX_CONNECTIONS_PER_IP;
    this.allowedOrigins = c.WS_ALLOWED_ORIGINS === '*'
      ? ['*']
      : c.WS_ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
    this.messageLimiter = new TokenBucketRateLimiter({
      capacity: c.WS_MAX_MESSAGES_PER_SECOND,
      refillPerSecond: c.WS_MAX_MESSAGES_PER_SECOND,
      name: 'ws_message',
    });
    this.messageLimiter.startCleanup();
    this.reconnectWindowMs = c.WS_RECONNECT_WINDOW_MS;
    this.maxReconnectsPerWindow = c.WS_MAX_RECONNECTS_PER_WINDOW;
    this.backpressureHighWater = c.WS_BACKPRESSURE_THRESHOLD * 1024;
    this.backpressureDropThreshold = c.WS_BACKPRESSURE_THRESHOLD;

    this.wss = new WebSocketServer({
      noServer: true,
      maxPayload: this.maxPayload,
      perMessageDeflate: false,
      clientTracking: false,
    });

    this.startBackgroundTasks();
  }

  private startBackgroundTasks(): void {
    this.cleanupInterval = setInterval(() => this.evictIdleClients(), 60_000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
    this.reconnectCleanupInterval = setInterval(() => this.evictReconnectLogs(), this.reconnectWindowMs);
    if (this.reconnectCleanupInterval.unref) this.reconnectCleanupInterval.unref();
    this.updateGauges();
  }

  private updateGauges(): void {
    setGauge('ws_clients_total', 'Total WebSocket clients (all states)', this.clients.size);
    setGauge('ws_user_connection_count_unique', 'Number of users with at least one active connection', this.userConnectionCount.size);
    setGauge('ws_ip_connection_count_unique', 'Number of IPs with at least one active connection', this.ipConnectionCount.size);
  }

  private evictIdleClients(): void {
    const now = Date.now();
    for (const [id, entry] of this.clients.entries()) {
      if (entry.state === 'authenticating' && now - entry.connectedAt.getTime() > 30_000) {
        log.warn({ clientId: id }, 'evicting stuck authenticating client');
        try { entry.socket.terminate(); } catch {}
        this.cleanupClient(entry);
      }
    }
    this.updateGauges();
  }

  private evictReconnectLogs(): void {
    const cutoff = Date.now() - this.reconnectWindowMs;
    for (const [ip, ts] of this.ipReconnectLog.entries()) {
      const filtered = ts.filter((t) => t > cutoff);
      if (filtered.length === 0) this.ipReconnectLog.delete(ip);
      else this.ipReconnectLog.set(ip, filtered);
    }
  }

  attach(httpServer: HttpServer): void {
    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== this.path) {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
        return;
      }
      const ip = (req.socket.remoteAddress ?? 'unknown') as string;
      if (this.isReconnectStorm(ip)) {
        log.warn({ ip }, 'ws upgrade rejected: reconnect storm');
        incCounter('ws_reconnect_storm_rejected_total', 'Reconnect storm rejections', 1);
        getAbuseDetector().record({ signal: 'ws_reconnect_storm', subject: `ip:${ip}`, metadata: { ip } });
        socket.write('HTTP/1.1 429 Too Many Connections\r\n\r\n');
        socket.destroy();
        return;
      }
      if (!this.isOriginAllowed(req.headers['origin'])) {
        log.warn({ origin: req.headers['origin'] }, 'ws upgrade rejected: origin not allowed');
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
  }

  private isReconnectStorm(ip: string): boolean {
    const now = Date.now();
    const cutoff = now - this.reconnectWindowMs;
    const log = this.ipReconnectLog.get(ip) ?? [];
    const filtered = log.filter((t) => t > cutoff);
    filtered.push(now);
    this.ipReconnectLog.set(ip, filtered);
    return filtered.length > this.maxReconnectsPerWindow;
  }

  private isOriginAllowed(origin: string | string[] | undefined): boolean {
    if (this.allowedOrigins.length === 0) return true;
    if (this.allowedOrigins.includes('*')) return true;
    if (!origin) return false;
    const list = Array.isArray(origin) ? origin : [origin];
    return list.some((o) => this.allowedOrigins.includes(o));
  }

  private async withCounterLock<T>(fn: () => Promise<T>): Promise<T> {
    const prev = this.counterMutex;
    let release: () => void = () => {};
    this.counterMutex = new Promise<void>((resolve) => {
      release = resolve;
    });
    try {
      await prev;
      return await fn();
    } finally {
      release();
    }
  }

  private async tryReserveConnectionSlot(userId: string, ip: string): Promise<{ ok: true } | { ok: false; reason: 'user' | 'ip' }> {
    return this.withCounterLock(async () => {
      const userCount = this.userConnectionCount.get(userId) ?? 0;
      if (userCount >= this.maxConnectionsPerUser) {
        return { ok: false, reason: 'user' as const };
      }
      const ipCount = this.ipConnectionCount.get(ip) ?? 0;
      if (ipCount >= this.maxConnectionsPerIp) {
        return { ok: false, reason: 'ip' as const };
      }
      this.userConnectionCount.set(userId, userCount + 1);
      this.ipConnectionCount.set(ip, ipCount + 1);
      return { ok: true as const };
    });
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const cfg = loadConfig();
    const clientId = randomUUID();
    const ipAddress = (req.socket.remoteAddress ?? null) || null;
    const userAgent = (req.headers['user-agent'] ?? null) || null;
    const alive = ws as AliveSocket;
    alive.isAlive = true;
    alive.lastPongAt = Date.now();
    alive.lastPingSentAt = 0;

    const entry: ClientEntry = {
      id: clientId,
      socket: alive,
      state: 'authenticating',
      userId: null,
      workspaceId: null,
      sessionId: null,
      apiKeyId: null,
      connectedAt: new Date(),
      lastPingAt: new Date(),
      ipAddress,
      userAgent,
      authPromise: null,
      pingTimer: null,
      messageCount: 0,
      firstMessageAt: null,
      lastMessageAt: null,
      messageRateLimiter: { ip: ipAddress ?? 'unknown', user: 'unauth' },
      outboxBytes: 0,
      backpressureDrops: 0,
    };
    this.clients.set(clientId, entry);

    log.info({ clientId, ipAddress }, 'ws connection opened');
    incCounter('ws_connections_opened_total', 'WebSocket connections opened', 1);
    this.updateGauges();

    const authTimer = setTimeout(() => {
      if (entry.state === 'authenticating') {
        log.warn({ clientId }, 'ws authentication timeout');
        this.sendErrorAndClose(ws, null, JSON_RPC_ERROR.AUTH_FAILED, 'Authentication timeout');
      }
    }, 10_000);

    ws.on('message', async (raw, isBinary) => {
      if (isBinary) {
        incCounter('ws_binary_rejected_total', 'Binary messages rejected', 1);
        getAbuseDetector().record({ signal: 'ws_invalid_payload', subject: `ip:${entry.ipAddress ?? 'unknown'}` });
        this.sendErrorAndClose(ws, null, JSON_RPC_ERROR.PAYLOAD_REJECTED, 'Binary messages are not supported');
        return;
      }
      const startedAt = Date.now();
      const rateKey = buildHybridKey({
        ip: entry.messageRateLimiter.ip,
        userId: entry.userId ?? undefined,
        apiKeyId: entry.apiKeyId ?? undefined,
      });
      const rate = this.messageLimiter.take(rateKey);
      if (!rate.allowed) {
        incCounter('ws_message_rate_limited_total', 'WS messages rate limited', 1);
        getAbuseDetector().record({
          signal: 'ws_message_flood',
          subject: entry.userId ? `u:${entry.userId}` : `ip:${entry.ipAddress ?? 'unknown'}`,
        });
        try {
          ws.send(serializeMessage({
            jsonrpc: '2.0',
            id: null,
            error: { code: JSON_RPC_ERROR.RATE_LIMITED, message: 'Rate limit exceeded', data: { retryAfterMs: rate.retryAfterMs } },
          }));
        } catch {}
        if (entry.messageCount > 100 && entry.userId) {
          log.warn({ clientId, userId: entry.userId }, 'flooding client terminated');
          try { ws.terminate(); } catch {}
        }
        return;
      }
      let msg: JsonRpcMessage;
      try {
        const text = Buffer.isBuffer(raw)
          ? raw.toString('utf-8')
          : Array.isArray(raw)
            ? Buffer.concat(raw).toString('utf-8')
            : Buffer.from(raw as ArrayBuffer).toString('utf-8');
        msg = parseMessage(text);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Parse error';
        try { ws.send(serializeMessage(buildParseError({ message: errMsg }))); } catch {}
        incCounter('ws_parse_errors_total', 'WS JSON parse errors', 1);
        return;
      }
      entry.messageCount += 1;
      const now = Date.now();
      entry.firstMessageAt = entry.firstMessageAt ?? now;
      entry.lastMessageAt = now;
      if (entry.messageCount === 50) {
        observeHistogram('ws_time_to_50_messages_ms', 'Time to 50 messages on a connection', now - entry.firstMessageAt);
      }
      try {
        if (entry.state === 'authenticating') {
          if (entry.authPromise) {
            try { ws.send(serializeMessage(buildInvalidRequestError(null, 'Authentication in progress'))); } catch {}
            return;
          }
          entry.authPromise = this.handleAuthenticating(entry, msg, authTimer);
          await entry.authPromise;
          return;
        }
        if (isRequest(msg)) {
          await this.handleRequest(entry, msg as JsonRpcRequest);
        } else if (isNotification(msg)) {
          await this.handleNotification(entry, msg as JsonRpcNotification);
        } else {
          try { ws.send(serializeMessage(buildInvalidRequestError(null, 'Expected request or notification'))); } catch {}
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Internal error';
        log.error({ err, clientId }, 'error handling message');
        const id = isRequest(msg) ? msg.id : null;
        try { ws.send(serializeMessage(buildInternalError(id, message))); } catch {}
      } finally {
        observeHistogram('ws_message_duration_ms', 'WS message handler duration', Date.now() - startedAt);
      }
    });

    ws.on('pong', () => {
      entry.lastPingAt = new Date();
      alive.isAlive = true;
      alive.lastPongAt = Date.now();
      alive.lastPingSentAt = 0; // reset so we don't false-positive on next interval
    });

    ws.on('close', (code, reason) => {
      log.info({ clientId, code, reason: reason.toString() }, 'ws connection closed');
      this.cleanupClient(entry);
    });

    ws.on('error', (err) => {
      log.error({ err, clientId }, 'ws error');
    });

    try {
      ws.send(serializeMessage({
        jsonrpc: '2.0',
        method: 'server.hello',
        params: {
          protocol: WS_PROTOCOL_VERSION,
          maxPayload: cfg.WS_MAX_PAYLOAD,
          pingIntervalMs: cfg.WS_PING_INTERVAL,
          methods: this.router.listMethods(),
        },
      }));
    } catch {}

    entry.pingTimer = setInterval(() => {
      if (entry.state === 'closed') return;
      const now = Date.now();
      // Only terminate if we sent a ping AND pong hasn't come back within timeout
      if (alive.lastPingSentAt > 0 && now - alive.lastPingSentAt > this.pingTimeoutMs && alive.lastPongAt < alive.lastPingSentAt) {
        log.warn({ clientId, ageMs: now - alive.lastPingSentAt }, 'ws pong timeout; terminating');
        try { ws.terminate(); } catch {}
        return;
      }
      // Send ping every pingIntervalMs
      if (now - entry.lastPingAt.getTime() > this.pingIntervalMs) {
        alive.lastPingSentAt = now;
        alive.isAlive = false;
        try { ws.ping(); } catch {}
      }
    }, Math.max(1000, Math.floor(this.pingTimeoutMs / 2)));
  }

  private async handleAuthenticating(
    entry: ClientEntry,
    msg: JsonRpcMessage,
    authTimer: NodeJS.Timeout,
  ): Promise<void> {
    if (!isRequest(msg) || msg.method !== 'auth') {
      this.sendErrorAndClose(entry.socket, null, JSON_RPC_ERROR.AUTH_FAILED, 'Must authenticate first');
      return;
    }
    const params = (msg.params ?? {}) as { token?: string; apiKey?: string };
    let userId: string;
    let sessionId: string | null = null;
    let apiKeyId: string | null = null;
    let workspaceId: string | null = null;
    try {
      if (params.token) {
        const ctx = await resolveAuthFromAccessToken(params.token);
        userId = ctx.userId;
        sessionId = ctx.sessionId ?? null;
      } else if (params.apiKey) {
        const ctx = await resolveAuthFromApiKey(params.apiKey);
        userId = ctx.userId;
        apiKeyId = ctx.apiKeyId ?? null;
        workspaceId = ctx.workspaceId ?? null;
      } else {
        this.sendErrorAndClose(entry.socket, msg.id, JSON_RPC_ERROR.AUTH_FAILED, 'Missing token or apiKey');
        return;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      incCounter('ws_auth_failures_total', 'WebSocket auth failures', 1);
      getAbuseDetector().record({
        signal: 'auth_failure',
        subject: `ip:${entry.ipAddress ?? 'unknown'}`,
        metadata: { reason: 'ws_auth' },
      });
      this.sendErrorAndClose(entry.socket, msg.id, JSON_RPC_ERROR.AUTH_FAILED, message);
      return;
    }

    const ip = entry.ipAddress ?? 'unknown';
    const userSubject = `u:${userId}`;
    if (getAbuseDetector().isBlocked(userSubject)) {
      incCounter('ws_abuse_blocked_total', 'WS auth rejected by abuse detector', 1, { subject: 'user' });
      this.sendErrorAndClose(entry.socket, msg.id, JSON_RPC_ERROR.AUTH_FAILED, 'User is blocked by abuse detector');
      return;
    }
    const reserved = await this.tryReserveConnectionSlot(userId, ip);
    if (!reserved.ok) {
      incCounter('ws_connection_limit_rejections_total', 'WS connections rejected by limit', 1, { reason: reserved.reason });
      this.sendErrorAndClose(entry.socket, msg.id, JSON_RPC_ERROR.CONNECTION_LIMIT, `Max connections per ${reserved.reason} exceeded`);
      return;
    }

    entry.userId = userId;
    entry.sessionId = sessionId;
    entry.apiKeyId = apiKeyId;
    entry.workspaceId = workspaceId;
    entry.state = 'authenticated';
    entry.messageRateLimiter = { ip, user: `u:${userId}` };
    clearTimeout(authTimer);
    log.info({ clientId: entry.id, userId }, 'ws authenticated');
    incCounter('ws_authenticated_total', 'WS successful auths', 1);

    this.send(entry.socket, {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        clientId: entry.id,
        userId,
        workspaceId,
      },
    });
  }

  private async handleRequest(entry: ClientEntry, req: JsonRpcRequest): Promise<void> {
    if (entry.state !== 'authenticated' || !entry.userId) {
      try { entry.socket.send(serializeMessage(buildInvalidRequestError(req.id, 'Not authenticated'))); } catch {}
      return;
    }
    const ctx: RpcContext = {
      clientId: entry.id,
      userId: entry.userId,
      ...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
      ...(entry.sessionId ? { sessionId: entry.sessionId } : {}),
      ...(entry.apiKeyId ? { apiKeyId: entry.apiKeyId } : {}),
    };
    const dispatch = await this.router.dispatchRequest(req, ctx);

    if (dispatch.error) {
      const handled = this.router.getHandler(req.method);
      if (!handled) {
        try { entry.socket.send(serializeMessage(buildMethodNotFoundError(req.id, req.method))); } catch {}
        return;
      }
      try {
        entry.socket.send(
          serializeMessage({
            jsonrpc: '2.0',
            id: dispatch.id,
            error: dispatch.error,
          }),
        );
      } catch {}
    } else {
      try {
        this.writeWithBackpressure(entry, {
          jsonrpc: '2.0',
          id: dispatch.id,
          result: dispatch.result,
        } as JsonRpcMessage);
      } catch {}
    }
  }

  private async handleNotification(entry: ClientEntry, notif: JsonRpcNotification): Promise<void> {
    if (entry.state !== 'authenticated' || !entry.userId) {
      return;
    }
    const ctx: RpcContext = {
      clientId: entry.id,
      userId: entry.userId,
      ...(entry.workspaceId ? { workspaceId: entry.workspaceId } : {}),
      ...(entry.sessionId ? { sessionId: entry.sessionId } : {}),
      ...(entry.apiKeyId ? { apiKeyId: entry.apiKeyId } : {}),
    };
    await this.router.dispatchNotification(notif, ctx);
  }

  private writeWithBackpressure(entry: ClientEntry, msg: JsonRpcMessage): void {
    if (entry.state === 'closed') return;
    const serialized = serializeMessage(msg as Parameters<typeof serializeMessage>[0]);
    const bytes = Buffer.byteLength(serialized);
    if (entry.outboxBytes > this.backpressureHighWater) {
      entry.backpressureDrops += 1;
      incCounter('ws_backpressure_drops_total', 'Outbound messages dropped due to backpressure', 1);
      if (entry.backpressureDrops >= this.backpressureDropThreshold) {
        log.warn({ clientId: entry.id, outboxBytes: entry.outboxBytes, drops: entry.backpressureDrops }, 'ws terminated for sustained backpressure');
        try { entry.socket.terminate(); } catch {}
      }
      return;
    }
    entry.outboxBytes += bytes;
    try {
      entry.socket.send(serialized, (err) => {
        if (err) {
          log.debug({ clientId: entry.id, err: err.message }, 'ws send callback error');
        }
      });
    } catch (err) {
      log.debug({ clientId: entry.id, err: (err as Error).message }, 'ws send threw');
    }
    setImmediate(() => {
      entry.outboxBytes = Math.max(0, entry.outboxBytes - bytes);
    });
  }

  private send(ws: WebSocket, msg: JsonRpcMessage): void {
    if (ws.readyState === ws.OPEN) {
      try { ws.send(serializeMessage(msg as Parameters<typeof serializeMessage>[0])); } catch {}
    }
  }

  private sendErrorAndClose(ws: WebSocket, id: JsonRpcId | null, code: number, message: string): void {
    try {
      ws.send(serializeMessage({ jsonrpc: '2.0', id, error: { code, message } }));
    } catch {}
    setTimeout(() => {
      try { ws.close(4401, message); } catch {}
    }, 100);
  }

  private cleanupClient(entry: ClientEntry): void {
    if (entry.state === 'closed') return;
    entry.state = 'closed';
    if (entry.pingTimer) clearInterval(entry.pingTimer);
    entry.pingTimer = null;
    this.clients.delete(entry.id);
    if (entry.userId) {
      const userId = entry.userId;
      const ip = entry.ipAddress ?? 'unknown';
      void this.withCounterLock(async () => {
        const uCount = this.userConnectionCount.get(userId) ?? 0;
        this.userConnectionCount.set(userId, Math.max(0, uCount - 1));
        if (this.userConnectionCount.get(userId) === 0) this.userConnectionCount.delete(userId);
        const iCount = this.ipConnectionCount.get(ip) ?? 0;
        this.ipConnectionCount.set(ip, Math.max(0, iCount - 1));
        if (this.ipConnectionCount.get(ip) === 0) this.ipConnectionCount.delete(ip);
      });
    }
    this.updateGauges();
  }

  async close(): Promise<void> {
    for (const entry of this.clients.values()) {
      try { entry.socket.close(1001, 'Server shutdown'); } catch {}
      this.cleanupClient(entry);
    }
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.reconnectCleanupInterval) clearInterval(this.reconnectCleanupInterval);
    this.messageLimiter.stopCleanup();
  }

  broadcast(event: string, data: unknown): void {
    const msg = serializeMessage({ jsonrpc: '2.0', method: event, params: data } as JsonRpcNotification);
    for (const entry of this.clients.values()) {
      if (entry.state === 'authenticated' && entry.socket.readyState === entry.socket.OPEN) {
        try { entry.socket.send(msg); } catch {}
      }
    }
  }

  broadcastToWorkspace(workspaceId: string, event: string, data: unknown): void {
    const msg = serializeMessage({ jsonrpc: '2.0', method: event, params: data } as JsonRpcNotification);
    for (const entry of this.clients.values()) {
      if (
        entry.state === 'authenticated' &&
        entry.workspaceId === workspaceId &&
        entry.socket.readyState === entry.socket.OPEN
      ) {
        try { entry.socket.send(msg); } catch {}
      }
    }
  }

  stats(): {
    total: number;
    authenticated: number;
    authenticating: number;
  } {
    let authenticated = 0;
    let authenticating = 0;
    for (const c of this.clients.values()) {
      if (c.state === 'authenticated') authenticated += 1;
      else if (c.state === 'authenticating') authenticating += 1;
    }
    return { total: this.clients.size, authenticated, authenticating };
  }
}
