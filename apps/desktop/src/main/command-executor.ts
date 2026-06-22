import { exec, execFile } from 'child_process';
import { readFile, writeFile, readdir, stat, unlink, rm, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { platform, cpus, totalmem, freemem, release, type } from 'os';
import { getLogger } from './logger.js';

const log = getLogger().child({ component: 'command-executor' });

export interface CommandResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export async function executeCommand(command: { type: string; payload: Record<string, unknown> }): Promise<CommandResult> {
  log.info('executing command: ' + command.type);

  switch (command.type) {
    case 'shell.execute':
      return shellExecute(command.payload);
    case 'file.read':
      return fileRead(command.payload);
    case 'file.write':
      return fileWrite(command.payload);
    case 'file.list':
      return fileList(command.payload);
    case 'file.delete':
      return fileDelete(command.payload);
    case 'screenshot.capture':
      return screenshotCapture();
    case 'app.open':
      return appOpen(command.payload);
    case 'system.info':
      return systemInfo();
    default:
      return { success: false, error: `Unknown command type: ${command.type}` };
  }
}

async function shellExecute(payload: Record<string, unknown>): Promise<CommandResult> {
  const command = payload.command as string;
  const cwd = payload.cwd as string | undefined;
  const timeoutMs = (payload.timeoutMs as number) ?? 30_000;

  if (!command) return { success: false, error: 'Missing command' };

  const isWindows = platform() === 'win32';
  const shell = isWindows ? 'cmd' : 'sh';
  const args = isWindows ? ['/c', command] : ['-c', command];

  return new Promise((resolve) => {
    execFile(shell, args, {
      cwd: cwd ?? process.cwd(),
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      windowsHide: true,
    }, (err, stdout, stderr) => {
      if (err) {
        resolve({
          success: false,
          data: {
            stdout: stdout?.toString() ?? '',
            stderr: stderr?.toString() ?? err.message,
            exitCode: err.code ?? 1,
          },
          error: err.message,
        });
      } else {
        resolve({
          success: true,
          data: {
            stdout: stdout.toString(),
            stderr: stderr.toString(),
            exitCode: 0,
          },
        });
      }
    });
  });
}

async function fileRead(payload: Record<string, unknown>): Promise<CommandResult> {
  const filePath = payload.path as string;
  if (!filePath) return { success: false, error: 'Missing path' };
  try {
    const content = await readFile(filePath, 'utf-8');
    return { success: true, data: { content, path: filePath } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Read failed' };
  }
}

async function fileWrite(payload: Record<string, unknown>): Promise<CommandResult> {
  const filePath = payload.path as string;
  const content = payload.content as string;
  if (!filePath || content === undefined) return { success: false, error: 'Missing path or content' };
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, 'utf-8');
    return { success: true, data: { path: filePath, bytes: content.length } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Write failed' };
  }
}

async function fileList(payload: Record<string, unknown>): Promise<CommandResult> {
  const dirPath = payload.path as string;
  if (!dirPath) return { success: false, error: 'Missing path' };
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
    return { success: true, data: { path: dirPath, items } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'List failed' };
  }
}

async function fileDelete(payload: Record<string, unknown>): Promise<CommandResult> {
  const filePath = payload.path as string;
  if (!filePath) return { success: false, error: 'Missing path' };
  try {
    await unlink(filePath);
    return { success: true, data: { path: filePath, deleted: true } };
  } catch {
    try {
      await rm(filePath, { recursive: true });
      return { success: true, data: { path: filePath, deleted: true } };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : 'Delete failed' };
    }
  }
}

async function screenshotCapture(): Promise<CommandResult> {
  try {
    const screenshot = await import('screenshot-desktop');
    const buffer = await screenshot.default();
    const base64 = buffer.toString('base64');
    return { success: true, data: { image: base64, format: 'image/png' } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Screenshot failed' };
  }
}

async function appOpen(payload: Record<string, unknown>): Promise<CommandResult> {
  const app = payload.app as string;
  if (!app) return { success: false, error: 'Missing app' };
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';
  const cmd = isWindows ? `start "" "${app}"` : isMac ? `open "${app}"` : `xdg-open "${app}"`;
  return new Promise((resolve) => {
    exec(cmd, (err) => {
      if (err) {
        resolve({ success: false, error: err.message });
      } else {
        resolve({ success: true, data: { app, opened: true } });
      }
    });
  });
}

async function systemInfo(): Promise<CommandResult> {
  const cpuList = cpus();
  const totalMem = totalmem();
  const freeMem = freemem();
  const usedMem = totalMem - freeMem;
  return {
    success: true,
    data: {
      platform: platform(),
      os: type(),
      osVersion: release(),
      hostname: require('os').hostname(),
      cpu: {
        cores: cpuList.length,
        model: cpuList[0]?.model ?? 'Unknown',
        speed: cpuList[0]?.speed ?? 0,
      },
      memory: {
        total: totalMem,
        used: usedMem,
        free: freeMem,
        usagePercent: Math.round((usedMem / totalMem) * 100),
      },
    },
  };
}
