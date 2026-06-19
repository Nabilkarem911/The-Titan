import { loadConfig } from '@titan/config';
import { getLogger, shutdownLogger } from '@titan/logging';
import { initTelemetry } from '@titan/telemetry';
import { initializeQueues, closeAllQueues, getQueueStats, pingRedis, closeRedis, verifyAuthOnStartup } from '@titan/queue';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import { runMigrations, closePool, ping as dbPing, verifyTlsOnStartup } from '@titan/database';
import { RpcRouter, TitanWebSocketServer } from '@titan/websocket';
import { z } from 'zod';
import { buildServer } from './server.js';
import { registerAllQueueSchemas, registerAllWorkers, closeAllWorkers } from './queue-bootstrap.js';
import { startAuditSchedulers, stopAuditSchedulers } from './audit-scheduler.js';
import { startCronScheduler, stopCronScheduler } from './cron-scheduler.js';
import { setWsServer } from './ws-instance.js';
import { registerTelegramWebhook } from './routes/telegram.js';

async function ensureSshKey(): Promise<void> {
  const { existsSync, mkdirSync, readFileSync, appendFileSync, chmodSync } = await import('node:fs');
  const { execSync } = await import('node:child_process');
  const log = getLogger().child({ component: 'ssh-init' });

  const sshDir = '/home/titan/.ssh';
  const keyPath = `${sshDir}/titan_rsa`;

  try {
    if (existsSync(keyPath)) {
      log.info({ keyPath }, 'SSH key already exists');
      return;
    }

    mkdirSync(sshDir, { recursive: true });
    execSync(`ssh-keygen -t rsa -b 2048 -m PEM -f ${keyPath} -N ""`, { stdio: 'pipe' });
    chmodSync(keyPath, 0o600);

    const pubKey = readFileSync(`${keyPath}.pub`, 'utf8').trim();
    log.info({ keyPath, pubKeyFingerprint: pubKey.substring(0, 40) + '...' }, 'SSH key generated');

    try {
      const hostIP = execSync("ip route | grep default | awk '{print $3}'", { stdio: 'pipe' }).toString().trim();
      if (hostIP) {
        const authorizedKeysPath = `${sshDir}/authorized_keys`;
        appendFileSync(authorizedKeysPath, pubKey + '\n');
        log.info({ hostIP }, 'host gateway IP detected — SSH key ready for host access');
      }
    } catch {
      log.info('could not detect host IP — SSH key generated but host access needs manual setup');
    }
  } catch (err) {
    log.warn({ err }, 'SSH key setup failed — non-fatal, continuing startup');
  }
}

async function main(): Promise<void> {
  const cfg = loadConfig();
  const log = getLogger().child({ component: 'bootstrap' });

  await initTelemetry();
  log.info({ service: cfg.SERVICE_NAME, version: cfg.SERVICE_VERSION, env: cfg.NODE_ENV }, 'titan-core starting');

  await ensureSshKey();

  const dbOk = await dbPing().catch(() => false);
  const redisOk = await pingRedis().catch(() => false);
  if (!dbOk) {
    log.fatal('postgres unreachable; aborting startup');
    process.exit(1);
  }
  if (!redisOk) {
    log.fatal('redis unreachable; aborting startup');
    process.exit(1);
  }

  const tlsOk = await verifyTlsOnStartup().catch(() => false);
  if (cfg.POSTGRES_TLS && !tlsOk) {
    log.fatal('postgres TLS required but not active; aborting startup');
    process.exit(1);
  }
  const authOk = await verifyAuthOnStartup().catch(() => false);
  if (cfg.REDIS_PASSWORD && !authOk) {
    log.fatal('redis password required but auth failed; aborting startup');
    process.exit(1);
  }

  const migrationResult = await runMigrations();
  log.info(migrationResult, 'migrations complete');

  await initializeQueues();
  registerAllQueueSchemas();
  registerAllWorkers();
  const queueStats = await Promise.all(
    (Object.values(QUEUE_NAMES) as QueueName[]).map(async (n) => ({ name: n, stats: await getQueueStats(n) })),
  );
  log.info({ queueStats }, 'queue topology ready');

  startAuditSchedulers();
  startCronScheduler();

  const router = new RpcRouter();
  registerRpcMethods(router);

  const app = await buildServer();
  const wsServer = new TitanWebSocketServer({ router, path: cfg.WS_PATH });
  wsServer.attach(app.server);
  setWsServer(wsServer);

  await app.listen({ host: cfg.HTTP_HOST, port: cfg.HTTP_PORT });
  log.info({ host: cfg.HTTP_HOST, port: cfg.HTTP_PORT, ws: cfg.WS_PATH }, 'http+ws server listening');

  // Register Telegram webhook if PUBLIC_URL is set
  const publicUrl = process.env['PUBLIC_URL'];
  if (publicUrl) {
    await registerTelegramWebhook(publicUrl);
  }

  let shuttingDown = false;
  const shutdown = async (signal: string, exitCode = 0) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info({ signal }, 'shutting down');
    try {
      await wsServer.close();
      await app.close();
      stopAuditSchedulers();
      stopCronScheduler();
      await closeAllWorkers();
      await closeAllQueues();
      await closeRedis();
      await closePool();
      await shutdownLogger();
    } catch (err) {
      log.error({ err }, 'error during shutdown');
    }
    process.exit(exitCode);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => {
    log.fatal({ reason }, 'unhandled rejection');
    void shutdown('unhandledRejection', 1);
  });
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'uncaught exception');
    void shutdown('uncaughtException', 1);
  });
}

function registerRpcMethods(router: RpcRouter): void {
  const pingSchema = z.object({}).strict();
  const serverInfoSchema = z.object({}).strict();
  const clientPongSchema = z.object({}).strict();
  const queueStatsSchema = z.object({}).strict();

  router.registerMethod('ping', async () => ({ pong: true, ts: new Date().toISOString() }), {
    description: 'Health check',
    schema: pingSchema,
  });

  router.registerMethod('server.info', async () => {
    const cfg = loadConfig();
    return {
      name: cfg.SERVICE_NAME,
      version: cfg.SERVICE_VERSION,
      env: cfg.NODE_ENV,
      methods: router.listMethods(),
    };
  }, { description: 'Server info', schema: serverInfoSchema });

  router.registerNotification('client.pong', async () => {
    // Heartbeat response from client; no-op
  }, { schema: clientPongSchema });

  router.registerMethod('queue.stats', async () => {
    const stats: Record<string, unknown> = {};
    for (const name of Object.values(QUEUE_NAMES) as QueueName[]) {
      stats[name] = await getQueueStats(name);
    }
    return stats;
  }, { description: 'Queue stats', schema: queueStatsSchema });
}

main().catch((err) => {
  console.error('fatal error during startup:', err);
  process.exit(1);
});
