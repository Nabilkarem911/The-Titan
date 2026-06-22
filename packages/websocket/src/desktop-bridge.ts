import { WebSocketServer, type WebSocket } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { resolveAuthFromAccessToken, resolveAuthFromApiKey } from '@titan/auth';
import { desktopDevices } from '@titan/database';

const log = getLogger().child({ component: 'desktop-bridge' });

export interface DeviceInfo {
  deviceId: string;
  userId: string;
  deviceName: string;
  platform: string;
  hostname: string | null;
  capabilities: string[];
}

interface ConnectedDevice {
  ws: WebSocket;
  info: DeviceInfo;
  connectedAt: Date;
  lastHeartbeat: Date;
}

interface PendingCommand {
  resolve: (result: CommandResult) => void;
  reject: (err: Error) => void;
  timeout: NodeJS.Timeout;
}

export interface DesktopCommand {
  type: string;
  payload: Record<string, unknown>;
}

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface DesktopBridgeOptions {
  path?: string;
}

export class DesktopBridge {
  private wss: WebSocketServer;
  private path: string;
  private devices = new Map<string, ConnectedDevice>();
  private pendingCommands = new Map<string, PendingCommand>();
  private commandTimeoutMs: number;

  constructor(opts: DesktopBridgeOptions = {}) {
    const cfg = loadConfig();
    this.path = opts.path ?? cfg.DESKTOP_WS_PATH;
    this.commandTimeoutMs = cfg.DESKTOP_COMMAND_TIMEOUT_MS;
    this.wss = new WebSocketServer({ noServer: true, maxPayload: 10 * 1024 * 1024 });
  }

  attach(httpServer: HttpServer): void {
    httpServer.on('upgrade', (req, socket, head) => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (url.pathname !== this.path) return;
      this.wss.handleUpgrade(req, socket, head, (ws) => {
        this.wss.emit('connection', ws, req);
      });
    });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));
    log.info({ path: this.path }, 'desktop bridge attached');
  }

  private async onConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token');
    const apiKey = url.searchParams.get('apiKey');

    let userId: string;
    try {
      if (token) {
        const ctx = await resolveAuthFromAccessToken(token);
        userId = ctx.userId;
      } else if (apiKey) {
        const ctx = await resolveAuthFromApiKey(apiKey);
        userId = ctx.userId;
      } else {
        ws.close(4401, 'Authentication required');
        return;
      }
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'desktop bridge auth failed');
      ws.close(4401, 'Authentication failed');
      return;
    }

    let authenticated = false;
    let deviceKey: string | null = null;

    ws.on('message', async (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf-8') : String(raw));
      } catch {
        try { ws.send(JSON.stringify({ type: 'error', error: 'Invalid JSON' })); } catch {}
        return;
      }

      if (!authenticated) {
        if (msg.type !== 'register') {
          try { ws.send(JSON.stringify({ type: 'error', error: 'Must register first' })); } catch {}
          return;
        }
        const deviceId = msg.deviceId as string;
        const deviceName = msg.deviceName as string;
        const platform = msg.platform as string;
        const hostname = (msg.hostname as string) ?? null;
        const capabilities = (msg.capabilities as string[]) ?? [];

        if (!deviceId || !deviceName || !platform) {
          try { ws.send(JSON.stringify({ type: 'error', error: 'Missing deviceId, deviceName, or platform' })); } catch {}
          return;
        }

        await desktopDevices.register({
          userId,
          deviceId,
          deviceName,
          platform,
          hostname: hostname ?? undefined,
          capabilities,
        });

        deviceKey = `${userId}:${deviceId}`;
        const info: DeviceInfo = { deviceId, userId, deviceName, platform, hostname, capabilities };
        this.devices.set(deviceKey, {
          ws,
          info,
          connectedAt: new Date(),
          lastHeartbeat: new Date(),
        });

        authenticated = true;
        try { ws.send(JSON.stringify({ type: 'registered', deviceId })); } catch {}
        log.info({ userId, deviceId, deviceName, platform }, 'desktop device connected');
        return;
      }

      if (msg.type === 'heartbeat') {
        if (deviceKey && this.devices.has(deviceKey)) {
          this.devices.get(deviceKey)!.lastHeartbeat = new Date();
        }
        try { ws.send(JSON.stringify({ type: 'heartbeat_ack' })); } catch {}
        return;
      }

      if (msg.type === 'command_result') {
        const commandId = msg.commandId as string;
        const result = msg.result as CommandResult;
        const pending = this.pendingCommands.get(commandId);
        if (pending) {
          clearTimeout(pending.timeout);
          this.pendingCommands.delete(commandId);
          pending.resolve(result);
        }
        return;
      }
    });

    ws.on('close', () => {
      if (deviceKey) {
        this.devices.delete(deviceKey);
        const [uid, did] = deviceKey.split(':');
        void desktopDevices.setStatus(uid, did, 'offline');
        log.info({ userId, deviceKey }, 'desktop device disconnected');
      }
    });

    ws.on('error', (err) => {
      log.error({ err, userId }, 'desktop bridge ws error');
    });
  }

  async sendCommand(userId: string, deviceId: string, command: DesktopCommand): Promise<CommandResult> {
    const key = `${userId}:${deviceId}`;
    const device = this.devices.get(key);
    if (!device) {
      return { success: false, error: `Device ${deviceId} is not connected` };
    }

    const commandId = randomUUID();
    return new Promise<CommandResult>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(commandId);
        reject(new Error(`Command timeout after ${this.commandTimeoutMs}ms`));
      }, this.commandTimeoutMs);

      this.pendingCommands.set(commandId, { resolve, reject, timeout });

      try {
        device.ws.send(JSON.stringify({ type: 'command', commandId, command }));
      } catch (err) {
        clearTimeout(timeout);
        this.pendingCommands.delete(commandId);
        reject(new Error(`Failed to send command: ${err instanceof Error ? err.message : 'Unknown'}`));
      }
    });
  }

  listOnlineDevices(userId: string): DeviceInfo[] {
    const result: DeviceInfo[] = [];
    for (const device of this.devices.values()) {
      if (device.info.userId === userId) {
        result.push(device.info);
      }
    }
    return result;
  }

  hasOnlineDevice(userId: string): boolean {
    for (const device of this.devices.values()) {
      if (device.info.userId === userId) return true;
    }
    return false;
  }

  getFirstOnlineDevice(userId: string): DeviceInfo | null {
    for (const device of this.devices.values()) {
      if (device.info.userId === userId) return device.info;
    }
    return null;
  }

  async close(): Promise<void> {
    for (const [key, device] of this.devices.entries()) {
      try { device.ws.close(1001, 'Server shutdown'); } catch {}
      const [uid, did] = key.split(':');
      void desktopDevices.setStatus(uid, did, 'offline');
    }
    this.devices.clear();
    for (const pending of this.pendingCommands.values()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Server shutting down'));
    }
    this.pendingCommands.clear();
    await new Promise<void>((resolve) => this.wss.close(() => resolve()));
  }
}
