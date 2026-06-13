import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { snapshot, renderPrometheus } from '@titan/observability';
import { getPool } from '@titan/database';
import { getRedis } from '@titan/queue';

export const metricsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/metrics', async (_req, reply) => {
    const body = renderPrometheus();
    return reply.type('text/plain; version=0.0.4').send(body);
  });

  app.get('/metrics.json', async () => {
    const snap = snapshot();
    let dbPool: { total: number; idle: number; waiting: number } | null = null;
    try {
      const p = getPool();
      dbPool = { total: p.totalCount, idle: p.idleCount, waiting: p.waitingCount };
    } catch {
      /* dbPool stays null */
    }
    let redisInfo: { status: string; memory?: number };
    try {
      const r = getRedis();
      const pong = await r.ping();
      const info = await r.info('memory');
      const used = info.match(/used_memory:(\d+)/);
      redisInfo = { status: pong === 'PONG' ? 'ok' : 'degraded', memory: used ? Number(used[1]) : undefined };
    } catch {
      redisInfo = { status: 'down' };
    }
    return {
      metrics: snap,
      dbPool,
      redis: redisInfo,
      timestamp: new Date().toISOString(),
    };
  });
};
