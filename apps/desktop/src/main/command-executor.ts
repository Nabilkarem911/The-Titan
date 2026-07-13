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
    case 'mouse.click':
      return mouseClick(command.payload);
    case 'mouse.move':
      return mouseMove(command.payload);
    case 'mouse.scroll':
      return mouseScroll(command.payload);
    case 'mouse.drag':
      return mouseDrag(command.payload);
    case 'window.list':
      return windowList();
    case 'window.focus':
      return windowFocus(command.payload);
    case 'window.manage':
      return windowManage(command.payload);
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

function sanitizeAppName(app: string): string {
  const cleaned = app.replace(/[^\w.\-]/g, '');
  if (!cleaned) throw new Error('Invalid app name');
  if (cleaned.length > 200) throw new Error('App name too long');
  return cleaned;
}

async function appClose(payload: Record<string, unknown>): Promise<CommandResult> {
  const app = payload.app as string;
  if (!app) return { success: false, error: 'Missing app' };
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';
  let safeApp: string;
  try { safeApp = sanitizeAppName(app); } catch { return { success: false, error: 'Invalid app name' }; }
  return new Promise((resolve) => {
    if (isWindows) {
      execFile('taskkill', ['/F', '/IM', `${safeApp}.exe`], { timeout: 5000 }, (err, stdout, stderr) => {
        if (err) {
          execFile('taskkill', ['/F', '/IM', safeApp], { timeout: 5000 }, (err2, stdout2, stderr2) => {
            if (err2) resolve({ success: false, error: `Failed to close ${safeApp}` });
            else resolve({ success: true, data: { app: safeApp, closed: true, output: stdout2.toString() || stderr2.toString() } });
          });
        } else {
          resolve({ success: true, data: { app: safeApp, closed: true, output: stdout.toString() || stderr.toString() } });
        }
      });
    } else {
      execFile('pkill', ['-f', safeApp], { timeout: 5000 }, (err, stdout, stderr) => {
        if (err) resolve({ success: false, error: `Failed to close ${safeApp}` });
        else resolve({ success: true, data: { app: safeApp, closed: true, output: stdout.toString() || stderr.toString() } });
      });
    }
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
      if (isWindows) {
        await new Promise<void>((resolve) => {
          const child = spawn('powershell', ['-NoProfile', '-Command', `Set-Clipboard -Value '${text.replace(/'/g, "''")}'`], { timeout: 5_000 });
          child.on('close', () => resolve());
          child.on('error', () => resolve());
        });
      } else if (isMac) {
        await new Promise<void>((resolve) => {
          const child = spawn('pbcopy', [], { timeout: 5_000 });
          child.stdin?.write(text);
          child.stdin?.end();
          child.on('close', () => resolve());
          child.on('error', () => resolve());
        });
      } else {
        await new Promise<void>((resolve) => {
          const child = spawn('xclip', ['-selection', 'clipboard'], { timeout: 5_000 });
          child.stdin?.write(text);
          child.stdin?.end();
          child.on('close', () => resolve());
          child.on('error', () => resolve());
        });
      }
      return { success: true, data: { written: text } };
    } else {
      return { success: false, error: `Unknown clipboard action: ${action}` };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Clipboard operation failed' };
  }
}

async function mouseClick(payload: Record<string, unknown>): Promise<CommandResult> {
  const x = payload.x as number;
  const y = payload.y as number;
  const button = (payload.button as string) ?? 'left';
  const doubleClick = (payload.doubleClick as boolean) ?? false;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return { success: false, error: 'Missing or invalid x/y coordinates' };
  }

  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      // Use PowerShell with System.Windows.Forms for mouse control
      const clickCount = doubleClick ? 2 : 1;
      const buttonFlag = button === 'right' ? 0x0008 : 0x0002; // RightDown : LeftDown
      const script = `Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo); }'
$down = ${buttonFlag}
$up = ${button === 'right' ? 0x0010 : 0x0004}
for ($i = 0; $i -lt ${clickCount}; $i++) {
  [Mouse]::mouse_event($down, 0, 0, 0, 0)
  Start-Sleep -Milliseconds 50
  [Mouse]::mouse_event($up, 0, 0, 0, 0)
  if (${clickCount} -gt 1) { Start-Sleep -Milliseconds 50 }
}`;
      await execPowerShell(script, 10_000);
    } else if (isMac) {
      const btn = button === 'right' ? 'right click' : 'click';
      const cmd = doubleClick ? `cliclick dd:${x},${y} dd:${x},${y}` : `cliclick ${btn}:${x},${y}`;
      await execCommand(cmd, 10_000);
    } else {
      const btn = button === 'right' ? 'click --right' : 'click';
      const cmd = doubleClick ? `xdotool click --repeat 2 1` : `xdotool ${btn}`;
      await execShell(`xdotool mousemove ${Math.round(x)} ${Math.round(y)} && ${cmd}`, 10_000);
    }
    return { success: true, data: { x, y, button, doubleClick } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Mouse click failed' };
  }
}

async function mouseMove(payload: Record<string, unknown>): Promise<CommandResult> {
  const x = payload.x as number;
  const y = payload.y as number;
  const smooth = (payload.smooth as boolean) ?? false;

  if (typeof x !== 'number' || typeof y !== 'number') {
    return { success: false, error: 'Missing or invalid x/y coordinates' };
  }

  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      const script = `Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(x)}, ${Math.round(y)})`;
      await execPowerShell(script, 5_000);
    } else if (isMac) {
      await execCommand(`cliclick m:${x},${y}`, 5_000);
    } else {
      const smoothFlag = smooth ? '--smooth' : '';
      await execShell(`xdotool mousemove ${smoothFlag} ${Math.round(x)} ${Math.round(y)}`, 5_000);
    }
    return { success: true, data: { x, y, smooth } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Mouse move failed' };
  }
}

async function mouseScroll(payload: Record<string, unknown>): Promise<CommandResult> {
  const direction = (payload.direction as string) ?? 'down';
  const amount = (payload.amount as number) ?? 3;

  if (!['up', 'down', 'left', 'right'].includes(direction)) {
    return { success: false, error: `Invalid scroll direction: ${direction}` };
  }

  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      const wheel = direction === 'up' || direction === 'down' ? 0x0800 : 0x1000;
      const delta = direction === 'up' || direction === 'left' ? -Math.abs(amount) * 120 : Math.abs(amount) * 120;
      const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo); }'
[Mouse]::mouse_event(${wheel}, 0, ${delta}, 0, 0)`;
      await execPowerShell(script, 5_000);
    } else if (isMac) {
      const dy = direction === 'up' ? amount : direction === 'down' ? -amount : 0;
      const dx = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
      await execCommand(`cliclick scroll:${dx},${dy}`, 5_000);
    } else {
      const button = direction === 'up' ? 4 : direction === 'down' ? 5 : 0;
      if (button > 0) {
        for (let i = 0; i < amount; i++) {
          await execShell(`xdotool click ${button}`, 5_000);
        }
      }
    }
    return { success: true, data: { direction, amount } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Scroll failed' };
  }
}

async function mouseDrag(payload: Record<string, unknown>): Promise<CommandResult> {
  const fromX = payload.fromX as number;
  const fromY = payload.fromY as number;
  const toX = payload.toX as number;
  const toY = payload.toY as number;

  if (typeof fromX !== 'number' || typeof fromY !== 'number' || typeof toX !== 'number' || typeof toY !== 'number') {
    return { success: false, error: 'Missing or invalid coordinates (fromX, fromY, toX, toY required)' };
  }

  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      const script = `Add-Type -AssemblyName System.Windows.Forms
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Mouse { [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint cButtons, uint dwExtraInfo); }'
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(fromX)}, ${Math.round(fromY)})
Start-Sleep -Milliseconds 100
[Mouse]::mouse_event(0x0002, 0, 0, 0, 0)
Start-Sleep -Milliseconds 100
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${Math.round(toX)}, ${Math.round(toY)})
Start-Sleep -Milliseconds 100
[Mouse]::mouse_event(0x0004, 0, 0, 0, 0)`;
      await execPowerShell(script, 15_000);
    } else if (isMac) {
      await execCommand(`cliclick dd:${fromX},${fromY} du:${toX},${toY}`, 15_000);
    } else {
      await execShell(
        `xdotool mousemove ${Math.round(fromX)} ${Math.round(fromY)} mousedown 1 mousemove ${Math.round(toX)} ${Math.round(toY)} mouseup 1`,
        15_000,
      );
    }
    return { success: true, data: { fromX, fromY, toX, toY } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Drag failed' };
  }
}

async function windowList(): Promise<CommandResult> {
  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      const script = `Add-Type -AssemblyName System.Windows.Forms
$windows = [System.Diagnostics.Process]::GetProcesses() | Where-Object { $_.MainWindowTitle -ne "" } | Select-Object Id, ProcessName, MainWindowTitle
$windows | ConvertTo-Json`;
      const output = await execPowerShell(script, 10_000);
      const windows = parseWindowsJson(output);
      return { success: true, data: { windows } };
    } else if (isMac) {
      const output = await execCommand(`osascript -e 'tell application "System Events" to get name of every window of every process whose visible is true'`, 10_000);
      const windows = output.split(',').map((title: string) => ({ title: title.trim(), process: '' })).filter((w: { title: string }) => w.title);
      return { success: true, data: { windows } };
    } else {
      const output = await execShell(`wmctrl -l 2>/dev/null || xdotool search "" 2>/dev/null`, 10_000);
      const windows = output.split('\n').filter(Boolean).map((line: string) => {
        const parts = line.split(/\s+/);
        return { id: parts[0], title: parts.slice(3).join(' ') || line };
      });
      return { success: true, data: { windows } };
    }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Window list failed' };
  }
}

async function windowFocus(payload: Record<string, unknown>): Promise<CommandResult> {
  const title = payload.title as string;
  const processName = payload.process as string;

  if (!title && !processName) {
    return { success: false, error: 'Missing title or process name' };
  }

  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      const match = title ? title : processName;
      const script = `Add-Type -AssemblyName System.Windows.Forms
$proc = Get-Process | Where-Object { $_.MainWindowTitle -like "*${match.replace(/"/g, '""')}*" -or $_.ProcessName -like "*${match.replace(/"/g, '""')}*" } | Select-Object -First 1
if ($proc) { [void][Win32]::SetForegroundWindow($proc.MainWindowHandle) }
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); }'`;
      await execPowerShell(script, 10_000);
    } else if (isMac) {
      const app = title ?? processName;
      await execCommand(`osascript -e 'tell application "${app.replace(/"/g, '\\"')}" to activate'`, 10_000);
    } else {
      await execShell(`wmctrl -a "${(title ?? processName).replace(/"/g, '\\"')}" 2>/dev/null || xdotool search --name "${(title ?? processName).replace(/"/g, '\\"')}" windowactivate`, 10_000);
    }
    return { success: true, data: { title, process: processName } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Window focus failed' };
  }
}

async function windowManage(payload: Record<string, unknown>): Promise<CommandResult> {
  const action = payload.action as string;
  const title = payload.title as string;

  if (!action || !['minimize', 'maximize', 'restore', 'close'].includes(action)) {
    return { success: false, error: `Invalid window action: ${action}` };
  }
  if (!title) {
    return { success: false, error: 'Missing window title' };
  }

  const isWindows = platform() === 'win32';
  const isMac = platform() === 'darwin';

  try {
    if (isWindows) {
      const actionMap: Record<string, string> = {
        minimize: '$sw_minimize = 0x0112; $wparam = 6',
        maximize: '$sw_maximize = 0x0112; $wparam = 3',
        restore: '$sw_restore = 0x0112; $wparam = 9',
        close: '$sw_close = 0x0010; $wparam = 0',
      };
      const script = `Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class Win32 { [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam); [DllImport("user32.dll")] public static extern IntPtr FindWindow(string lpClassName, string lpWindowName); }'
$hwnd = [Win32]::FindWindow($null, "${title.replace(/"/g, '""')}")
if ($hwnd -ne [IntPtr]::Zero) { ${actionMap[action]} [Win32]::PostMessage($hwnd, 0x0112, [IntPtr]$wparam, [IntPtr]::Zero) }`;
      await execPowerShell(script, 10_000);
    } else if (isMac) {
      if (action === 'close') {
        await execCommand(`osascript -e 'tell application "${title.replace(/"/g, '\\"')}" to quit'`, 10_000);
      } else {
        const actionMap: Record<string, string> = { minimize: 'minimize', maximize: 'zoom', restore: ' AXRaise' };
        await execCommand(`osascript -e 'tell application "System Events" to ${actionMap[action]} window "${title.replace(/"/g, '\\"')}"'`, 10_000);
      }
    } else {
      const actionMap: Record<string, string> = { minimize: 'iconic', maximize: 'maximized', restore: 'normal', close: 'close' };
      await execShell(`wmctrl -r "${title.replace(/"/g, '\\"')}" -b ${actionMap[action]} 2>/dev/null`, 10_000);
    }
    return { success: true, data: { action, title } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Window manage failed' };
  }
}

// ── Helper functions for command execution ──

async function execPowerShell(script: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('powershell', ['-NoProfile', '-Command', script], { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString());
    });
  });
}

async function execCommand(cmd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString());
    });
  });
}

async function execShell(cmd: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: timeoutMs, maxBuffer: 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout.toString());
    });
  });
}

function parseWindowsJson(output: string): Array<{ id: number; process: string; title: string }> {
  try {
    const trimmed = output.trim();
    if (!trimmed) return [];
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map((p: { Id?: number; ProcessName?: string; MainWindowTitle?: string }) => ({
        id: p.Id ?? 0,
        process: p.ProcessName ?? '',
        title: p.MainWindowTitle ?? '',
      }));
    }
    return [{
      id: parsed.Id ?? 0,
      process: parsed.ProcessName ?? '',
      title: parsed.MainWindowTitle ?? '',
    }];
  } catch {
    return [];
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
