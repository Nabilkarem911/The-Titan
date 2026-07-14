import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { hostname } from 'os';
import { createWindow, getMainWindow } from './window.js';
import { createTray } from './tray.js';
import { registerIpcHandlers, setWsClient } from './ipc-handlers.js';
import { DesktopWsClient } from './ws-client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const store = new Store<{
  serverUrl: string;
  token: string;
  refreshToken: string;
  apiKey: string;
  authMethod: 'jwt' | 'apiKey';
  deviceName: string;
  capabilities: string[];
  minimizeToTray: boolean;
  autoStart: boolean;
  theme: 'dark' | 'light';
}>({
  defaults: {
    serverUrl: 'http://localhost:3000',
    token: '',
    refreshToken: '',
    apiKey: '',
    authMethod: 'jwt',
    deviceName: '',
    capabilities: ['shell', 'files', 'screenshot', 'apps'],
    minimizeToTray: true,
    autoStart: false,
    theme: 'dark',
  },
});

const wsClient: DesktopWsClient | null = null;
let tray: Tray | null = null;

app.whenReady().then(() => {
  registerIpcHandlers(store);

  createWindow();
  tray = createTray();

  // Note: WebSocket connection is established after login via IPC server:connect
  // Do NOT auto-connect here to avoid duplicate connections

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !store.get('minimizeToTray')) {
    app.quit();
  }
});

app.on('before-quit', async () => {
  // wsClient is managed by ipc-handlers now
});

export { store, tray };
