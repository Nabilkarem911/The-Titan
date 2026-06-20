import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { getPool, ping, verifyTlsOnStartup, isTlsVerified, getRetentionInfo } from '@titan/database';
import { pingRedis, verifyAuthOnStartup, isAuthVerified, getQueueStats } from '@titan/queue';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import { getLastVerifyResult, getLastArchiveResult } from '../audit-scheduler.js';
import { requireAuth } from '../plugins/auth.js';

export const healthRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/health/live', async () => ({ status: 'live', timestamp: new Date().toISOString() }));

  app.get('/api/v1/health/ready', async (_req, reply) => {
    const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
    let allOk = true;

    const dbStart = Date.now();
    try {
      const ok = await ping();
      checks.postgres = { ok, latencyMs: Date.now() - dbStart };
      if (!ok) allOk = false;
    } catch (err) {
      allOk = false;
      checks.postgres = { ok: false, error: (err as Error).message };
    }

    const redisStart = Date.now();
    try {
      const ok = await pingRedis();
      checks.redis = { ok, latencyMs: Date.now() - redisStart };
      if (!ok) allOk = false;
    } catch (err) {
      allOk = false;
      checks.redis = { ok: false, error: (err as Error).message };
    }

    return reply.status(allOk ? 200 : 503).send({
      status: allOk ? 'ready' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/v1/health/startup', async () => {
    const cfg = await import('@titan/config').then((m) => m.loadConfig());
    const tlsOk = cfg.POSTGRES_TLS ? isTlsVerified() : true;
    const authOk = cfg.REDIS_PASSWORD ? isAuthVerified() : true;
    return {
      status: tlsOk && authOk ? 'started' : 'degraded',
      postgresTlsVerified: tlsOk,
      redisAuthVerified: authOk,
      timestamp: new Date().toISOString(),
    };
  });

  app.get('/api/v1/health/dashboard', { preHandler: requireAuth }, async () => {
    const dbPool = (() => {
      try {
        const p = getPool();
        return { total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount };
      } catch {
        return null;
      }
    })();
    const queueHealth: Record<string, unknown> = {};
    for (const name of Object.values(QUEUE_NAMES) as QueueName[]) {
      try {
        queueHealth[name] = await getQueueStats(name);
      } catch (err) {
        queueHealth[name] = { error: (err as Error).message };
      }
    }
    const retention = await getRetentionInfo().catch(() => null);
    const lastVerify = getLastVerifyResult();
    const lastArchive = getLastArchiveResult();
    return {
      dbPool,
      queues: queueHealth,
      audit: retention,
      auditIntegrity: lastVerify
        ? {
            valid: lastVerify.valid,
            brokenAt: lastVerify.brokenAt,
            checked: lastVerify.checked,
            lastCheckAt: new Date(lastVerify.ts).toISOString(),
          }
        : { status: 'pending', reason: 'scheduler has not run yet' },
      auditArchival: lastArchive
        ? {
            lastArchived: lastArchive.archived,
            lastArchiveAt: new Date(lastArchive.ts).toISOString(),
          }
        : { status: 'pending', reason: 'archival has not run yet' },
      timestamp: new Date().toISOString(),
    };
  });
};

export async function getDbPoolInfo(): Promise<{ total: number; idle: number; waiting: number }> {
  const pool = getPool();
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
  };
}

void verifyTlsOnStartup;
void verifyAuthOnStartup;
