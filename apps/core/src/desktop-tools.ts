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
    description: 'Capture a screenshot from the user\'s local desktop machine.',
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

      return bridge.sendCommand(device.userId, device.deviceId, {
        type: 'screenshot.capture',
        payload: {},
      });
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

  log.info(`registered ${9} desktop tools`);
}
