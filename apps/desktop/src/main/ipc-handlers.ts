import { ipcMain } from 'electron';
import type Store from 'electron-store';
import { exec } from 'child_process';
import { readFile, writeFile, readdir, stat, unlink } from 'fs/promises';
import { join } from 'path';
import { platform, cpus, totalmem, freemem, release, type, hostname } from 'os';
import { executeCommand } from './command-executor.js';

export function registerIpcHandlers(store: Store<Record<string, unknown>>): void {
  // Settings
  ipcMain.handle('settings:get', () => store.store);
  ipcMain.handle('settings:set', (_e, settings) => {
    for (const [key, value] of Object.entries(settings)) {
      store.set(key, value);
    }
    return store.store;
  });

  // Connection status
  ipcMain.handle('connection:status', () => {
    return { connected: false };
  });

  // Files
  ipcMain.handle('files:list', async (_e, dirPath: string) => {
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

  ipcMain.handle('files:read', async (_e, filePath: string) => {
    try {
      const content = await readFile(filePath, 'utf-8');
      return { success: true, content };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed' };
    }
  });

  ipcMain.handle('files:write', async (_e, filePath: string, content: string) => {
    try {
      await writeFile(filePath, content, 'utf-8');
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Failed' };
    }
  });

  // Shell
  ipcMain.handle('shell:execute', async (_e, cmd: string) => {
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
