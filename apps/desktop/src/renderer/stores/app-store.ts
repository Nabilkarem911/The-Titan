import { create } from 'zustand';

export type Page = 'chat' | 'files' | 'terminal' | 'screenshot' | 'settings' | 'devices';

interface AppState {
  currentPage: Page;
  connected: boolean;
  isLoggedIn: boolean;
  user: { id: string; email: string; name: string } | null;
  serverUrl: string;
  deviceName: string;
  theme: 'dark' | 'light';
  systemInfo: {
    platform: string;
    os: string;
    osVersion: string;
    hostname: string;
    cpu: { cores: number; model: string; speed: number };
    memory: { total: number; used: number; free: number; usagePercent: number };
  } | null;
  setPage: (page: Page) => void;
  setConnected: (connected: boolean) => void;
  setLoggedIn: (loggedIn: boolean) => void;
  setUser: (user: AppState['user']) => void;
  setServerUrl: (url: string) => void;
  setDeviceName: (name: string) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setSystemInfo: (info: AppState['systemInfo']) => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentPage: 'chat',
  connected: false,
  isLoggedIn: false,
  user: null,
  serverUrl: 'http://localhost:3000',
  deviceName: '',
  theme: 'dark',
  systemInfo: null,
  setPage: (page) => set({ currentPage: page }),
  setConnected: (connected) => set({ connected }),
  setLoggedIn: (isLoggedIn) => set({ isLoggedIn }),
  setUser: (user) => set({ user }),
  setServerUrl: (serverUrl) => set({ serverUrl }),
  setDeviceName: (deviceName) => set({ deviceName }),
  setTheme: (theme) => set({ theme }),
  setSystemInfo: (systemInfo) => set({ systemInfo }),
}));
