import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('titan', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSettings: (s: Record<string, unknown>) => ipcRenderer.invoke('settings:set', s),

  // Connection
  getConnectionStatus: () => ipcRenderer.invoke('connection:status'),

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
