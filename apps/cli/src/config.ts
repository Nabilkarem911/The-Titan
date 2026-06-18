import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const TITAN_DIR = join(homedir(), '.titan');
const CONFIG_FILE = join(TITAN_DIR, 'config.json');
const AUTH_FILE = join(TITAN_DIR, 'auth.json');

export interface TitanConfig {
  serverUrl: string;
  defaultAgent?: string;
  model?: string;
  theme: 'dark' | 'light';
  streaming: boolean;
  maxSteps: number;
}

export interface AuthData {
  accessToken: string;
  refreshToken: string;
  email: string;
  expiresAt: number;
}

const DEFAULT_CONFIG: TitanConfig = {
  serverUrl: 'http://localhost:3000',
  theme: 'dark',
  streaming: true,
  maxSteps: 15,
};

function ensureDir(): void {
  if (!existsSync(TITAN_DIR)) {
    mkdirSync(TITAN_DIR, { recursive: true });
  }
}

export function loadConfig(): TitanConfig {
  ensureDir();
  try {
    const raw = readFileSync(CONFIG_FILE, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function saveConfig(config: Partial<TitanConfig>): void {
  ensureDir();
  const current = loadConfig();
  const merged = { ...current, ...config };
  writeFileSync(CONFIG_FILE, JSON.stringify(merged, null, 2));
}

export function loadAuth(): AuthData | null {
  try {
    const raw = readFileSync(AUTH_FILE, 'utf-8');
    const data = JSON.parse(raw) as AuthData;
    if (data.expiresAt && Date.now() > data.expiresAt) return null;
    return data;
  } catch {
    return null;
  }
}

export function saveAuth(auth: AuthData): void {
  ensureDir();
  writeFileSync(AUTH_FILE, JSON.stringify(auth, null, 2));
}

export function clearAuth(): void {
  try {
    writeFileSync(AUTH_FILE, '{}');
  } catch { /* ignore */ }
}

export function getConfigDir(): string {
  return TITAN_DIR;
}
