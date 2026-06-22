import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('titan', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('settings:set', s),

  // Connection
  getConnectionStatus: () => ipcRenderer.invoke('connection:status'),
  connectToServer: () => ipcRenderer.invoke('server:connect'),

  // Auth
  login: (serverUrl: string, email: string, password: string) =>
    ipcRenderer.invoke('auth:login', serverUrl, email, password),
  register: (serverUrl: string, email: string, name: string, password: string) =>
    ipcRenderer.invoke('auth:register', serverUrl, email, name, password),
  logout: () => ipcRenderer.invoke('auth:logout'),
  checkAuth: () => ipcRenderer.invoke('auth:check'),
  refreshToken: () => ipcRenderer.invoke('auth:refresh'),

  // Files
  listDir: (path: string) => ipcRenderer.invoke('files:list', path),
  readFile: (path: string) => ipcRenderer.invoke('files:read', path),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('files:write', path, content),

  // Shell
  executeCommand: (cmd: string) => ipcRenderer.invoke('shell:execute', cmd),

  // Screenshot
  takeScreenshot: () => ipcRenderer.invoke('screenshot:capture'),

  // System
  getSystemInfo: () => ipcRenderer.invoke('system:info'),

  // Navigation (from tray)
  onNavigate: (callback: (page: string) => void) =>
    ipcRenderer.on('navigate', (_e, page) => callback(page)),
});
