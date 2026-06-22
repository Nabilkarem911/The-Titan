import { exec, execFile, spawn } from 'child_process';
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
    case 'app.close':
      return appClose(command.payload);
    case 'keys.type':
      return keysType(command.payload);
    case 'clipboard':
      return clipboardAction(command.payload);
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

  try {
    if (isWindows) {
      // Use spawn with detached + unref so GUI apps don't block
      const child = spawn('cmd', ['/c', 'start', '""', app], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.unref();
    } else if (isMac) {
      const child = spawn('open', [app], { detached: true, stdio: 'ignore' });
      child.unref();
    } else {
      const child = spawn('xdg-open', [app], { detached: true, stdio: 'ignore' });
      child.unref();
    }
    return { success: true, data: { app, opened: true } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to open app' };
  }
}

async function appClose(payload: Record<string, unknown>): Promise<CommandResult> {
  const app = payload.app as string;
  if (!app) return { success: false, error: 'Missing app' };
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';
  const cmd = isWindows ? `taskkill /F /IM ${app}.exe 2>nul & taskkill /F /IM ${app} 2>nul` : isMac ? `pkill -f "${app}"` : `pkill -f "${app}"`;
  return new Promise((resolve) => {
    exec(cmd, (err, stdout, stderr) => {
      if (err) {
        resolve({ success: false, error: `Failed to close ${app}: ${err.message}` });
      } else {
        resolve({ success: true, data: { app, closed: true, output: stdout.toString() || stderr.toString() } });
      }
    });
  });
}

async function keysType(payload: Record<string, unknown>): Promise<CommandResult> {
  const text = payload.text as string;
  if (!text) return { success: false, error: 'Missing text' };
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  const specialKeys: Record<string, string> = {
    'Enter': isWindows ? '{ENTER}' : 'Return',
    'Tab': isWindows ? '{TAB}' : 'Tab',
    'Escape': isWindows ? '{ESC}' : 'Escape',
    'Backspace': isWindows ? '{BACKSPACE}' : 'Delete',
    'Space': isWindows ? '{SPACE}' : 'space',
    'Up': isWindows ? '{UP}' : 'Up',
    'Down': isWindows ? '{DOWN}' : 'Down',
    'Left': isWindows ? '{LEFT}' : 'Left',
    'Right': isWindows ? '{RIGHT}' : 'Right',
  };

  try {
    if (isWindows) {
      const textToType = specialKeys[text] ?? text.replace(/[+^%{}~]/g, '{$&}');
      const script = `Set WshShell = CreateObject("WScript.Shell")\nWshShell.SendKeys "${textToType.replace(/"/g, '""')}"`;
      const { writeFile, unlink } = await import('fs/promises');
      const { join } = await import('path');
      const { tmpdir } = await import('os');
      const scriptPath = join(tmpdir(), `titan-keys-${Date.now()}.vbs`);
      await writeFile(scriptPath, script, 'utf-8');
      await new Promise<void>((resolve) => {
        exec(`cscript //nologo "${scriptPath}"`, { timeout: 10_000 }, () => resolve());
      });
      await unlink(scriptPath).catch(() => {});
    } else if (isMac) {
      const textToType = specialKeys[text] ?? text;
      exec(`osascript -e 'tell application "System Events" to keystroke "${textToType.replace(/"/g, '\\"')}"'`, { timeout: 10_000 });
    } else {
      const textToType = specialKeys[text] ?? text;
      exec(`xdotool type -- "${textToType.replace(/"/g, '\\"')}"`, { timeout: 10_000 });
    }
    return { success: true, data: { typed: text } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to type keys' };
  }
}

async function clipboardAction(payload: Record<string, unknown>): Promise<CommandResult> {
  const action = payload.action as string;
  const text = payload.text as string | undefined;
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (action === 'read') {
      const cmd = isWindows ? 'powershell -command "Get-Clipboard"' : isMac ? 'pbpaste' : 'xclip -selection clipboard -o';
      const result = await new Promise<string>((resolve) => {
        exec(cmd, { timeout: 5_000 }, (err, stdout) => {
          resolve(err ? '' : stdout.toString().trim());
        });
      });
      return { success: true, data: { content: result } };
    } else if (action === 'write') {
      if (!text) return { success: false, error: 'Missing text for write action' };
      const cmd = isWindows ? `powershell -command "Set-Clipboard -Value '${text.replace(/'/g, "''")}'"` : isMac ? `printf '%s' '${text.replace(/'/g, "'\\''")}' | pbcopy` : `printf '%s' '${text.replace(/'/g, "'\\''")}' | xclip -selection clipboard`;
      await new Promise<void>((resolve) => {
        exec(cmd, { timeout: 5_000 }, () => resolve());
      });
      return { success: true, data: { written: text } };
    } else {
      return { success: false, error: `Unknown clipboard action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Clipboard operation failed' };
  }
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
