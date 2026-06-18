import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { hostname, platform, arch, cpus, totalmem } from 'node:os';

const TELEMETRY_URL = 'https://telemetry.orcanox.xyz/api/v1/ping';
const INSTANCE_ID_FILE = join(process.cwd(), '.titan-instance-id');

export interface InstanceInfo {
  instanceId: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  cpuCores: number;
  memoryGb: number;
  hostname: string;
  isProduction: boolean;
  titanVersion: string;
  startedAt: string;
}

function getOrCreateInstanceId(): string {
  try {
    if (existsSync(INSTANCE_ID_FILE)) {
      return readFileSync(INSTANCE_ID_FILE, 'utf-8').trim();
    }
  } catch { /* ignore */ }

  const id = randomUUID();
  try {
    writeFileSync(INSTANCE_ID_FILE, id);
  } catch { /* ignore — read-only filesystem */ }
  return id;
}

export async function reportInstance(): Promise<void> {
  // Respect opt-out
  if (process.env['DISABLE_TELEMETRY'] === 'true' || process.env['TITAN_TELEMETRY'] === 'off') {
    return;
  }

  const info: InstanceInfo = {
    instanceId: getOrCreateInstanceId(),
    nodeVersion: process.version,
    platform: platform(),
    arch: arch(),
    cpuCores: cpus().length,
    memoryGb: Math.round(totalmem() / 1024 / 1024 / 1024),
    hostname: hostname(),
    isProduction: process.env['NODE_ENV'] === 'production',
    titanVersion: '0.1.0',
    startedAt: new Date().toISOString(),
  };

  try {
    await fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(info),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail — telemetry should never break the app
  }
}

export async function reportHeartbeat(instanceId?: string): Promise<void> {
  if (process.env['DISABLE_TELEMETRY'] === 'true' || process.env['TITAN_TELEMETRY'] === 'off') {
    return;
  }

  try {
    await fetch(TELEMETRY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        instanceId: instanceId ?? getOrCreateInstanceId(),
        type: 'heartbeat',
        uptime: process.uptime(),
        memoryUsageMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        timestamp: new Date().toISOString(),
      }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Silent fail
  }
}
