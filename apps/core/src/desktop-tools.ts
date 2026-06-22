import type { ToolRegistry } from '@titan/agent-engine';
import { getDesktopBridge } from './desktop-bridge-instance.js';
import { validateCommand } from '@titan/tools';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'desktop-tools' });

const DESKTOP_FORBIDDEN_EXTRA: readonly string[] = [
  'format',
  'del /f /s /q c:\\',
  'reg delete',
  'diskpart',
  'cipher /w',
];

function validateDesktopCommand(command: string): void {
  validateCommand(command);
  const lower = command.toLowerCase();
  for (const f of DESKTOP_FORBIDDEN_EXTRA) {
    if (lower.includes(f)) {
      throw new Error(`Command contains forbidden pattern: "${f}"`);
    }
  }
}

export function registerDesktopTools(registry: ToolRegistry): void {
  // Always register tools — bridge availability is checked at execution time
  // (bridge may be set after tools are registered due to bootstrap order)

  registry.register({
    name: 'desktop_execute',
    description: 'Execute a shell command on the user\'s local desktop machine. The user must have the Titan Desktop app running and connected.',
    schema: {
      command: { type: 'string', description: 'The shell command to execute' },
      deviceId: { type: 'string', description: 'Optional device ID. If omitted, uses first online device.' },
      cwd: { type: 'string', description: 'Optional working directory' },
      timeoutMs: { type: 'number', description: 'Optional timeout in milliseconds (max 60000)' },
    },
    requiredParams: ['command'],
    tags: ['desktop', 'shell', 'execution'],
    handler: async (params: unknown) => {
      const p = params as { command: string; deviceId?: string; cwd?: string; timeoutMs?: number };
      validateDesktopCommand(p.command);

      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      const result = await bridge.sendCommand(device.userId, device.deviceId, {
        type: 'shell.execute',
        payload: { command: p.command, cwd: p.cwd, timeoutMs: p.timeoutMs },
      });
      return result;
    },
  });

  registry.register({
    name: 'desktop_read_file',
    description: 'Read a file from the user\'s local desktop machine.',
    schema: {
      path: { type: 'string', description: 'Absolute path to the file' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['path'],
    tags: ['desktop', 'filesystem'],
    handler: async (params: unknown) => {
      const p = params as { path: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'file.read',
        payload: { path: p.path },
      });
    },
  });

  registry.register({
    name: 'desktop_write_file',
    description: 'Write content to a file on the user\'s local desktop machine.',
    schema: {
      path: { type: 'string', description: 'Absolute path to the file' },
      content: { type: 'string', description: 'File content to write' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['path', 'content'],
    tags: ['desktop', 'filesystem'],
    handler: async (params: unknown) => {
      const p = params as { path: string; content: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'file.write',
        payload: { path: p.path, content: p.content },
      });
    },
  });

  registry.register({
    name: 'desktop_list_dir',
    description: 'List directory contents on the user\'s local desktop machine.',
    schema: {
      path: { type: 'string', description: 'Absolute path to the directory' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['path'],
    tags: ['desktop', 'filesystem'],
    handler: async (params: unknown) => {
      const p = params as { path: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'file.list',
        payload: { path: p.path },
      });
    },
  });

  registry.register({
    name: 'desktop_delete_file',
    description: 'Delete a file on the user\'s local desktop machine. Use with caution.',
    schema: {
      path: { type: 'string', description: 'Absolute path to the file to delete' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['path'],
    tags: ['desktop', 'filesystem', 'dangerous'],
    handler: async (params: unknown) => {
      const p = params as { path: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'file.delete',
        payload: { path: p.path },
      });
    },
  });

  registry.register({
    name: 'desktop_screenshot',
    description: 'Capture a screenshot from the user\'s local desktop machine. Returns the local file path of the saved screenshot on the server. Use telegram_send_file with type=photo to send it to the user.',
    schema: {
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    tags: ['desktop', 'screenshot'],
    handler: async (params: unknown) => {
      const p = params as { deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      const result = await bridge.sendCommand(device.userId, device.deviceId, {
        type: 'screenshot.capture',
        payload: {},
      });

      // If screenshot succeeded, save base64 to file on server
      if (result.success && (result.data as { image?: string })?.image) {
        try {
          const { writeFile, mkdir } = await import('node:fs/promises');
          const { join } = await import('node:path');
          const { randomUUID } = await import('node:crypto');
          const dir = '/tmp/titan-screenshots';
          await mkdir(dir, { recursive: true });
          const filename = `screenshot-${randomUUID()}.png`;
          const filePath = join(dir, filename);
          const base64Data = (result.data as { image: string }).image;
          await writeFile(filePath, Buffer.from(base64Data, 'base64'));
          log.info({ filePath, deviceId: device.deviceId }, 'screenshot saved to server filesystem');

          // Auto-send screenshot to Telegram chat if chatId is available
          const chatId = (globalThis as Record<string, unknown>).__currentChatId as string;
          if (chatId) {
            try {
              const { readFile } = await import('node:fs/promises');
              const formData = new FormData();
              formData.append('chat_id', chatId);
              const fileBuffer = await readFile(filePath);
              const blob = new Blob([fileBuffer], { type: 'image/png' });
              formData.append('photo', blob, filename);

              const cfg = (await import('@titan/config')).loadConfig();
              const token = cfg.TELEGRAM_BOT_TOKEN;
              await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, {
                method: 'POST',
                body: formData,
              });
              log.info({ chatId, filePath }, 'screenshot sent to telegram automatically');
              return {
                success: true,
                data: {
                  filePath,
                  sentToTelegram: true,
                  message: 'Screenshot captured and sent to the user via Telegram.',
                },
              };
            } catch (sendErr) {
              log.error({ sendErr }, 'failed to auto-send screenshot to telegram');
            }
          }

          return {
            success: true,
            data: {
              filePath,
              message: `Screenshot saved at ${filePath}. Use telegram_send_file with type=photo, filePath=${filePath} to send it to the user.`,
            },
          };
        } catch (err) {
          log.error({ err }, 'failed to save screenshot to file');
          return { success: false, error: 'Screenshot captured but failed to save on server' };
        }
      }

      return result;
    },
  });

  registry.register({
    name: 'desktop_open_app',
    description: 'Open an application on the user\'s local desktop machine.',
    schema: {
      app: { type: 'string', description: 'Application name or path to open' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['app'],
    tags: ['desktop', 'apps'],
    handler: async (params: unknown) => {
      const p = params as { app: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'app.open',
        payload: { app: p.app },
      });
    },
  });

  registry.register({
    name: 'desktop_system_info',
    description: 'Get system information (CPU, memory, disk, OS) from the user\'s local desktop machine.',
    schema: {
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    tags: ['desktop', 'system'],
    handler: async (params: unknown) => {
      const p = params as { deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'system.info',
        payload: {},
      });
    },
  });

  registry.register({
    name: 'desktop_list_devices',
    description: 'List all online desktop devices connected to the user\'s Titan account.',
    schema: {},
    tags: ['desktop', 'devices'],
    handler: async () => {
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, data: { count: 0, devices: [] } };

      const devices = bridge.listOnlineDevices(userId);
      return {
        success: true,
        data: {
          count: devices.length,
          devices: devices.map((d: { deviceId: string; deviceName: string; platform: string; hostname: string | null; capabilities: string[] }) => ({
            deviceId: d.deviceId,
            deviceName: d.deviceName,
            platform: d.platform,
            hostname: d.hostname,
            capabilities: d.capabilities,
          })),
        },
      };
    },
  });

  registry.register({
    name: 'desktop_type_keys',
    description: 'Type text or press keys on the user\'s local desktop machine. Useful for typing into GUI applications that were opened with desktop_open_app. Supports plain text and special key names (e.g. Enter, Tab, Escape, Backspace).',
    schema: {
      text: { type: 'string', description: 'Text to type or special key name (Enter, Tab, Escape, Backspace, Space, etc.)' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['text'],
    tags: ['desktop', 'keyboard'],
    handler: async (params: unknown) => {
      const p = params as { text: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'keys.type',
        payload: { text: p.text },
      });
    },
  });

  registry.register({
    name: 'desktop_close_app',
    description: 'Close an application on the user\'s local desktop machine by process name.',
    schema: {
      app: { type: 'string', description: 'Application process name to close (e.g. calc, notepad, code)' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['app'],
    tags: ['desktop', 'apps'],
    handler: async (params: unknown) => {
      const p = params as { app: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'app.close',
        payload: { app: p.app },
      });
    },
  });

  registry.register({
    name: 'desktop_clipboard',
    description: 'Read from or write to the clipboard on the user\'s local desktop machine.',
    schema: {
      action: { type: 'string', description: 'Either "read" to get clipboard content or "write" to set it' },
      text: { type: 'string', description: 'Text to write to clipboard (only needed for action=write)' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['action'],
    tags: ['desktop', 'clipboard'],
    handler: async (params: unknown) => {
      const p = params as { action: string; text?: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };

      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };

      const device = p.deviceId
        ? { deviceId: p.deviceId, userId }
        : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'clipboard',
        payload: { action: p.action, text: p.text },
      });
    },
  });

  registry.register({
    name: 'desktop_mouse_click',
    description: 'Click the mouse at specific (x,y) coordinates on the user\'s desktop. Supports left/right click and double-click.',
    schema: {
      x: { type: 'number', description: 'X coordinate (pixels from left)' },
      y: { type: 'number', description: 'Y coordinate (pixels from top)' },
      button: { type: 'string', description: 'Mouse button: "left" (default) or "right"' },
      doubleClick: { type: 'boolean', description: 'If true, perform a double-click' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['x', 'y'],
    tags: ['desktop', 'mouse'],
    handler: async (params: unknown) => {
      const p = params as { x: number; y: number; button?: string; doubleClick?: boolean; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'mouse.click',
        payload: { x: p.x, y: p.y, button: p.button ?? 'left', doubleClick: p.doubleClick ?? false },
      });
    },
  });

  registry.register({
    name: 'desktop_mouse_move',
    description: 'Move the mouse cursor to specific (x,y) coordinates on the user\'s desktop.',
    schema: {
      x: { type: 'number', description: 'X coordinate (pixels from left)' },
      y: { type: 'number', description: 'Y coordinate (pixels from top)' },
      smooth: { type: 'boolean', description: 'If true, move smoothly (Linux only)' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['x', 'y'],
    tags: ['desktop', 'mouse'],
    handler: async (params: unknown) => {
      const p = params as { x: number; y: number; smooth?: boolean; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'mouse.move',
        payload: { x: p.x, y: p.y, smooth: p.smooth ?? false },
      });
    },
  });

  registry.register({
    name: 'desktop_scroll',
    description: 'Scroll the mouse wheel in a direction on the user\'s desktop.',
    schema: {
      direction: { type: 'string', description: 'Scroll direction: "up", "down", "left", or "right"' },
      amount: { type: 'number', description: 'Scroll amount (default 3)' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['direction'],
    tags: ['desktop', 'mouse'],
    handler: async (params: unknown) => {
      const p = params as { direction: string; amount?: number; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'mouse.scroll',
        payload: { direction: p.direction, amount: p.amount ?? 3 },
      });
    },
  });

  registry.register({
    name: 'desktop_drag_drop',
    description: 'Drag the mouse from one point to another on the user\'s desktop. Useful for dragging files or UI elements.',
    schema: {
      fromX: { type: 'number', description: 'Start X coordinate' },
      fromY: { type: 'number', description: 'Start Y coordinate' },
      toX: { type: 'number', description: 'End X coordinate' },
      toY: { type: 'number', description: 'End Y coordinate' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['fromX', 'fromY', 'toX', 'toY'],
    tags: ['desktop', 'mouse'],
    handler: async (params: unknown) => {
      const p = params as { fromX: number; fromY: number; toX: number; toY: number; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'mouse.drag',
        payload: { fromX: p.fromX, fromY: p.fromY, toX: p.toX, toY: p.toY },
      });
    },
  });

  registry.register({
    name: 'desktop_list_windows',
    description: 'List all open windows with titles and process names on the user\'s desktop.',
    schema: {
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    tags: ['desktop', 'windows'],
    handler: async (params: unknown) => {
      const p = params as { deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'window.list',
        payload: {},
      });
    },
  });

  registry.register({
    name: 'desktop_focus_window',
    description: 'Focus (bring to front) a window by title or process name on the user\'s desktop.',
    schema: {
      title: { type: 'string', description: 'Window title (partial match)' },
      process: { type: 'string', description: 'Process name (alternative to title)' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    tags: ['desktop', 'windows'],
    handler: async (params: unknown) => {
      const p = params as { title?: string; process?: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'window.focus',
        payload: { title: p.title, process: p.process },
      });
    },
  });

  registry.register({
    name: 'desktop_window_manage',
    description: 'Manage a window on the user\'s desktop: minimize, maximize, restore, or close it by title.',
    schema: {
      action: { type: 'string', description: 'Window action: "minimize", "maximize", "restore", or "close"' },
      title: { type: 'string', description: 'Window title to manage' },
      deviceId: { type: 'string', description: 'Optional device ID' },
    },
    requiredParams: ['action', 'title'],
    tags: ['desktop', 'windows'],
    handler: async (params: unknown) => {
      const p = params as { action: string; title: string; deviceId?: string };
      const userId = (globalThis as Record<string, unknown>).__currentUserId as string;
      if (!userId) return { success: false, error: 'No user context' };
      const bridge = getDesktopBridge();
      if (!bridge) return { success: false, error: 'Desktop bridge not available' };
      const device = p.deviceId ? { deviceId: p.deviceId, userId } : bridge.getFirstOnlineDevice(userId);
      if (!device) return { success: false, error: 'No desktop device connected' };
      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'window.manage',
        payload: { action: p.action, title: p.title },
      });
    },
  });

  log.info(`registered 19 desktop tools`);
}
