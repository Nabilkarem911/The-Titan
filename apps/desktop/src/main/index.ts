import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';
import Store from 'electron-store';
import { createWindow, getMainWindow } from './window.js';
import { createTray } from './tray.js';
import { registerIpcHandlers } from './ipc-handlers.js';
import { DesktopWsClient } from './ws-client.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const store = new Store<{
  serverUrl: string;
  token: string;
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
    apiKey: '',
    authMethod: 'jwt',
    deviceName: '',
    capabilities: ['shell', 'files', 'screenshot', 'apps'],
    minimizeToTray: true,
    autoStart: false,
    theme: 'dark',
  },
});

let wsClient: DesktopWsClient | null = null;
let tray: Tray | null = null;

app.whenReady().then(() => {
  registerIpcHandlers(store);

  createWindow();
  tray = createTray();

  const settings = store.store;
  if (settings.serverUrl && (settings.token || settings.apiKey)) {
    wsClient = new DesktopWsClient(settings.serverUrl, settings.token || settings.apiKey, {
      deviceName: settings.deviceName || require('os').hostname(),
      capabilities: settings.capabilities,
    });
    wsClient.connect();
  }

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
  if (wsClient) {
    await wsClient.disconnect();
  }
});

export { store, wsClient, tray };
