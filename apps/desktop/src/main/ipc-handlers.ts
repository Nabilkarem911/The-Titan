import { ipcMain, type BrowserWindow } from 'electron';
import type Store from 'electron-store';
import { exec } from 'child_process';
import { readFile, writeFile, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { platform, cpus, totalmem, freemem, release, type, hostname } from 'os';
import { executeCommand } from './command-executor.js';
import { DesktopWsClient } from './ws-client.js';

let activeWsClient: DesktopWsClient | null = null;
let activeMainWindow: BrowserWindow | null = null;
let isConnecting = false;

export function setWsClient(client: DesktopWsClient | null): void {
  activeWsClient = client;
}

export function setMainWindowRef(win: BrowserWindow | null): void {
  activeMainWindow = win;
}

export function registerIpcHandlers(store: Store<Record<string, unknown>>): void {
  // Settings
  ipcMain.handle('settings:get', () => store.store);
  ipcMain.handle('settings:set', (_e, settings: Record<string, unknown>) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key, value);
    }
    return store.store;
  });

  // Connection status
  ipcMain.handle('connection:status', () => {
    return { connected: activeWsClient?.isConnected() ?? false };
  });

  // Auth — Login
  ipcMain.handle('auth:login', async (_e, serverUrl: string, email: string, password: string) => {
    try {
      const url = `${serverUrl}/api/v1/auth/login`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Login failed' })) as Record<string, unknown>;
        return { success: false, error: (err.message as string) ?? (err.error as string) ?? 'Login failed' };
      }
      const data = await res.json() as {
        user: { id: string; email: string; name: string };
        accessToken: string;
        refreshToken: string;
      };
      store.set('serverUrl', serverUrl);
      store.set('token', data.accessToken);
      store.set('refreshToken', data.refreshToken);
      store.set('authMethod', 'jwt');
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed — is the server running?' };
    }
  });

  // Auth — Register
  ipcMain.handle('auth:register', async (_e, serverUrl: string, email: string, name: string, password: string) => {
    try {
      const url = `${serverUrl}/api/v1/auth/register`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Registration failed' })) as Record<string, unknown>;
        return { success: false, error: (err.message as string) ?? (err.error as string) ?? 'Registration failed' };
      }
      const data = await res.json() as {
        user: { id: string; email: string; name: string };
        accessToken: string;
        refreshToken: string;
      };
      store.set('serverUrl', serverUrl);
      store.set('token', data.accessToken);
      store.set('refreshToken', data.refreshToken);
      store.set('authMethod', 'jwt');
      return { success: true, user: data.user };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Connection failed — is the server running?' };
    }
  });

  // Auth — Logout
  ipcMain.handle('auth:logout', async () => {
    store.set('token', '');
    store.set('refreshToken', '');
    if (activeWsClient) {
      await activeWsClient.disconnect();
      activeWsClient = null;
    }
    return { success: true };
  });

  // Auth — Check if logged in
  ipcMain.handle('auth:check', () => {
    const token = store.get('token') as string;
    const serverUrl = store.get('serverUrl') as string;
    return { loggedIn: !!token, serverUrl };
  });

  // Auth — Refresh token
  ipcMain.handle('auth:refresh', async () => {
    const serverUrl = store.get('serverUrl') as string;
    const refreshToken = store.get('refreshToken') as string;
    if (!serverUrl || !refreshToken) {
      return { success: false, error: 'No refresh token' };
    }
    try {
      const res = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Refresh failed' })) as Record<string, unknown>;
        return { success: false, error: (err.message as string) ?? (err.error as string) ?? 'Refresh failed' };
      }
      const data = await res.json() as { accessToken: string; refreshToken: string };
      store.set('token', data.accessToken);
      store.set('refreshToken', data.refreshToken);
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Refresh failed' };
    }
  });

  // Connect to server (after login or settings change)
  ipcMain.handle('server:connect', async () => {
    // Prevent duplicate concurrent connections
    if (isConnecting) {
      return { success: true, alreadyConnecting: true };
    }
    if (activeWsClient && activeWsClient.isConnected()) {
      return { success: true, alreadyConnected: true };
    }

    const settings = store.store;
    if (!settings.serverUrl || !(settings.token || settings.apiKey)) {
      return { success: false, error: 'Missing server URL or credentials' };
    }

    isConnecting = true;

    if (activeWsClient) {
      await activeWsClient.disconnect();
    }

    // Try to refresh the access token before connecting
    const refreshToken = store.get('refreshToken') as string;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(`${settings.serverUrl}/api/v1/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        });
        if (refreshRes.ok) {
          const tokens = await refreshRes.json() as { accessToken: string; refreshToken: string };
          store.set('token', tokens.accessToken);
          store.set('refreshToken', tokens.refreshToken);
        }
      } catch {
        // ignore — will try with existing token
      }
    }

    const freshToken = (store.get('token') as string) || (settings.token as string);
    activeWsClient = new DesktopWsClient(settings.serverUrl as string, freshToken, {
      deviceName: (settings.deviceName as string) || hostname(),
      capabilities: settings.capabilities as string[],
    });
    activeWsClient.connect();
    isConnecting = false;
    return { success: true };
  });

  // Files
  ipcMain.handle('files:list', async (_e: unknown, dirPath: string) => {
    try {
      const entries = await readdir(dirPath, { withFileTypes: true });
      const items = await Promise.all(
        entries.map(async (entry) => {
          const fullPath = join(dirPath, entry.name);
          let size = 0;
          let modified: Date | null = null;
          try {
            const s = await stat(fullPath);
            size = s.size;
            modified = s.mtime;
          } catch {}
          return {
            name: entry.name,
            path: fullPath,
            isDirectory: entry.isDirectory(),
            isFile: entry.isFile(),
            size,
            modified,
          };
        }),
      );
      return { success: true, items };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed' };
    }
  });

  ipcMain.handle('files:read', async (_e: unknown, filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed' };
    }
  });

  ipcMain.handle('files:write', async (_e: unknown, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed' };
    }
  });

  // Shell
  ipcMain.handle('shell:execute', async (_e: unknown, cmd: string) => {
    return new Promise((resolve) => {
      const isWindows = platform() === 'win32';
      const shell = isWindows ? 'cmd' : 'sh';
      const args = isWindows ? ['/c', cmd] : ['-c', cmd];
      const { execFile } = require('child_process');
      execFile(shell, args, { maxBuffer: 1024 * 1024, windowsHide: true }, (err: Error | null, stdout: string, stderr: string) => {
        resolve({
          success: !err,
          stdout,
          stderr: stderr ?? (err?.message ?? ''),
          exitCode: err ? 1 : 0,
        });
      });
    });
  });

  // Screenshot
  ipcMain.handle('screenshot:capture', async () => {
    try {
      const screenshot = await import('screenshot-desktop');
      const buffer = await screenshot.default();
      return { success: true, image: buffer.toString('base64'), format: 'image/png' };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed' };
    }
  });

  // System info
  ipcMain.handle('system:info', async () => {
    const cpuList = cpus();
    const totalMem = totalmem();
    const freeMem = freemem();
    return {
      success: true,
      data: {
        platform: platform(),
        os: type(),
        osVersion: release(),
        hostname: hostname(),
        cpu: {
          cores: cpuList.length,
          model: cpuList[0]?.model ?? 'Unknown',
          speed: cpuList[0]?.speed ?? 0,
        },
        memory: {
          total: totalMem,
          used: totalMem - freeMem,
          free: freeMem,
          usagePercent: Math.round(((totalMem - freeMem) / totalMem) * 100),
        },
      },
    };
  });
}
