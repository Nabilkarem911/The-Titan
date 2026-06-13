import { Redis as RedisClient, type RedisOptions } from 'ioredis';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { incCounter, setGauge } from '@titan/observability';

let primary: RedisClient | null = null;
let authVerified = false;
let memoryMonitor: NodeJS.Timeout | null = null;

function buildOptions(): RedisOptions {
  const c = loadConfig();
  return {
    host: c.REDIS_HOST,
    port: c.REDIS_PORT,
    password: c.REDIS_PASSWORD || undefined,
    db: c.REDIS_DB,
    keyPrefix: c.REDIS_KEY_PREFIX,
    tls: c.REDIS_TLS ? { rejectUnauthorized: true } : undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: 5_000,
    lazyConnect: false,
  };
}

export function getRedis(): RedisClient {
  if (primary) return primary;
  const log = getLogger().child({ component: 'redis' });
  const opts = buildOptions();
  const cfg = loadConfig();
  if (cfg.REDIS_CLUSTER) {
    log.warn('REDIS_CLUSTER=true is not yet implemented; using single client');
  }
  const client = new RedisClient(opts);
  client.on('error', (err) => {
    log.error({ err }, 'redis error');
    incCounter('redis_errors_total', 'Redis errors', 1);
  });
  client.on('ready', () => {
    log.info('redis connection ready');
    incCounter('redis_ready_total', 'Redis ready events', 1);
  });
  client.on('close', () => log.warn('redis connection closed'));
  client.on('reconnecting', (ms: number) => {
    log.info({ ms }, 'redis reconnecting');
    incCounter('redis_reconnects_total', 'Redis reconnects', 1);
  });
  primary = client;
  startMemoryMonitor();
  return primary;
}

function startMemoryMonitor(): void {
  if (memoryMonitor) return;
  memoryMonitor = setInterval(async () => {
    if (!primary) return;
    try {
      const info = await primary.info('memory');
      const usedMatch = info.match(/used_memory:(\d+)/);
      const maxMatch = info.match(/maxmemory:(\d+)/);
      if (usedMatch) {
        const usedBytes = Number(usedMatch[1]);
        setGauge('redis_used_memory_bytes', 'Redis used memory in bytes', usedBytes);
        if (maxMatch) {
          const maxBytes = Number(maxMatch[1]);
          if (maxBytes > 0) {
            const ratio = usedBytes / maxBytes;
            setGauge('redis_memory_usage_ratio', 'Redis memory usage as ratio of maxmemory', ratio);
            if (ratio > 0.9) {
              const log = getLogger().child({ component: 'redis' });
              log.warn({ usedBytes, maxBytes, ratio }, 'redis memory pressure high');
              incCounter('redis_memory_pressure_total', 'Redis memory pressure events', 1);
            }
          }
        }
      }
    } catch {}
  }, 30_000);
  memoryMonitor.unref();
}

export async function verifyAuthOnStartup(): Promise<boolean> {
  if (authVerified) return true;
  const c = loadConfig();
  if (!c.REDIS_PASSWORD) {
    if (c.NODE_ENV === 'production') {
      const log = getLogger().child({ component: 'redis' });
      log.error('redis password is empty in production');
      return false;
    }
    authVerified = true;
    return true;
  }
  const log = getLogger().child({ component: 'redis' });
  try {
    const client = getRedis();
    const pong = await client.ping();
    if (pong === 'PONG') {
      authVerified = true;
      log.info('redis auth verified on startup');
      incCounter('redis_auth_verified_total', 'Redis auth verifications', 1);
      return true;
    }
    return false;
  } catch (err) {
    log.error({ err }, 'redis auth verification failed');
    return false;
  }
}

export function isAuthVerified(): boolean {
  return authVerified;
}

export function createDedicatedClient(): RedisClient {
  return new RedisClient(buildOptions());
}

export async function pingRedis(): Promise<boolean> {
  const r = await getRedis().ping();
  return r === 'PONG';
}

export async function closeRedis(): Promise<void> {
  if (memoryMonitor) {
    clearInterval(memoryMonitor);
    memoryMonitor = null;
  }
  if (primary) {
    await primary.quit();
    primary = null;
  }
  authVerified = false;
}
