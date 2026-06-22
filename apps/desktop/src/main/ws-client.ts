import WebSocket from 'ws';
import { randomUUID } from 'crypto';
import { hostname, platform } from 'os';
import { BrowserWindow } from 'electron';
import { getLogger } from './logger.js';

const log = getLogger().child({ component: 'ws-client' });

export interface DesktopWsClientOptions {
  deviceName: string;
  capabilities: string[];
}

export class DesktopWsClient {
  private ws: WebSocket | null = null;
  private serverUrl: string;
  private token: string;
  private opts: DesktopWsClientOptions;
  private deviceId: string;
  private reconnectAttempts = 0;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connected = false;
  private destroyed = false;

  constructor(serverUrl: string, token: string, opts: DesktopWsClientOptions) {
    this.serverUrl = serverUrl;
    this.token = token;
    this.opts = opts;
    this.deviceId = randomUUID();
  }

  connect(): void {
    if (this.connected || this.destroyed) return;
    const wsUrl = this.serverUrl.replace(/^http/, 'ws') + '/ws-desktop?token=' + encodeURIComponent(this.token);
    log.info({ wsUrl, deviceId: this.deviceId }, 'connecting to titan server');

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      log.info('ws connected — registering device');
      this.connected = true;
      this.reconnectAttempts = 0;

      this.ws!.send(JSON.stringify({
        type: 'register',
        deviceId: this.deviceId,
        deviceName: this.opts.deviceName,
        platform: platform(),
        hostname: hostname(),
        capabilities: this.opts.capabilities,
      }));

      this.startHeartbeat();
    });

    this.ws.on('message', (raw) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (msg.type === 'registered') {
        log.info({ deviceId: this.deviceId }, 'device registered on server');
        return;
      }

      if (msg.type === 'heartbeat_ack') {
        return;
      }

      if (msg.type === 'command') {
        this.handleCommand(msg.commandId as string, msg.command as { type: string; payload: Record<string, unknown> });
        return;
      }
    });

    this.ws.on('close', (code: number, reason: Buffer) => {
      log.info({ code, reason: reason.toString() }, 'ws disconnected');
      this.connected = false;
      this.stopHeartbeat();
      // 4401 = auth failed — don't reconnect with expired token
      if (code === 4401) {
        log.error('auth failed — stopping reconnect. Please login again.');
        this.destroyed = true;
        // Notify renderer to show login screen
        const win = BrowserWindow.getFocusedWindow();
        if (win) win.webContents.send('auth-failed');
        return;
      }
      this.scheduleReconnect();
    });

    this.ws.on('error', (err) => {
      log.error({ err: err.message }, 'ws error');
    });
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 10_000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private reconnectTimer: NodeJS.Timeout | null = null;

  private scheduleReconnect(): void {
    if (this.destroyed) return;
    this.reconnectAttempts++;
    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, 30_000);
    log.info({ delay, attempt: this.reconnectAttempts }, 'scheduling reconnect');
    this.reconnectTimer = setTimeout(() => {
      if (!this.connected && !this.destroyed) {
        this.connect();
      }
    }, delay);
  }

  private async handleCommand(commandId: string, command: { type: string; payload: Record<string, unknown> }): Promise<void> {
    log.info({ commandId, type: command.type }, 'received command from server');

    try {
      const { executeCommand } = await import('./command-executor.js');
      const result = await executeCommand(command);
      this.ws?.send(JSON.stringify({ type: 'command_result', commandId, result }));
      log.info({ commandId, success: result.success }, 'command result sent');
    } catch (err) {
      this.ws?.send(JSON.stringify({
        type: 'command_result',
        commandId,
        result: { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      }));
      log.error({ commandId, err: err instanceof Error ? err.message : 'Unknown' }, 'command execution failed');
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async disconnect(): Promise<void> {
    this.destroyed = true;
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close(1001, 'Client disconnect');
      this.ws = null;
    }
    this.connected = false;
  }
}
