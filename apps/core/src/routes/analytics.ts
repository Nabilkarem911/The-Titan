import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { tokenUsage, toolExecutionStats } from '@titan/database';

export const analyticsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/analytics/tokens', { preHandler: [requireAuth] }, async (req, reply) => {
    const { from, to, model } = req.query as { from?: string; to?: string; model?: string };
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const stats = await tokenUsage.getStats(fromDate, toDate, model);
    const recent = await tokenUsage.getRecent(100);
    return reply.send({
      period: { from: from ?? '24h', to: to ?? 'now' },
      model: model ?? 'all',
      totalTokens: stats.totalTokens,
      totalCostCents: stats.totalCostCents,
      byModel: stats.byModel,
      data: recent,
    });
  });

  app.get('/api/v1/analytics/cost', { preHandler: [requireAuth] }, async (_req, reply) => {
    const stats = await tokenUsage.getStats();
    return reply.send({
      totalCostCents: stats.totalCostCents,
      byModel: stats.byModel,
      period: 'all_time',
    });
  });

  app.get('/api/v1/analytics/agent-performance', { preHandler: [requireAuth] }, async (_req, reply) => {
    const stats = await toolExecutionStats.getStats();
    return reply.send({
      tools: stats.tools,
      totalCalls: stats.totalCalls,
      errorRate: stats.errorRate,
    });
  });

  app.get('/api/v1/analytics/tool-usage', { preHandler: [requireAuth] }, async (_req, reply) => {
    const stats = await toolExecutionStats.getStats();
    return reply.send(stats);
  });

  app.get('/api/v1/analytics/traces/:runId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { runId } = req.params as { runId: string };
    const result = await toolExecutionStats.getRecent(50);
    const filtered = result.filter((r) => (r as Record<string, unknown>).run_id === runId);
    return reply.send({ runId, spans: filtered, totalDuration: 0 });
  });

  app.post('/api/v1/analytics/export', { preHandler: [requireAuth] }, async (req, reply) => {
    const { format, type } = req.body as { format?: string; type?: string };
    let data: unknown[];
    if (type === 'tokens') {
      data = await tokenUsage.getRecent(1000);
    } else if (type === 'tools') {
      data = await toolExecutionStats.getRecent(1000);
    } else {
      data = [];
    }
    return reply.send({ status: 'completed', format: format ?? 'json', type: type ?? 'tokens', data });
  });
};
