import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { snapshot, renderPrometheus } from '@titan/observability';
import { getPool } from '@titan/database';
import { getRedis, getQueueStats } from '@titan/queue';
import { requireAuth } from '../plugins/auth.js';

export const metricsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/metrics', { preHandler: requireAuth }, async (_req, reply) => {
    const body = renderPrometheus();
    return reply.type('text/plain; version=0.0.4').send(body);
  });

  app.get('/metrics.json', { preHandler: requireAuth }, async () => {
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

  app.get<{ Params: { name: string } }>('/api/v1/admin/queues/:name/stats', { preHandler: requireAuth }, async (req, reply) => {
    try {
      const stats = await getQueueStats(req.params.name as Parameters<typeof getQueueStats>[0]);
      return reply.send(stats);
    } catch {
      return reply.send({ waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 });
    }
  });
};
