import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { verifyHashChain, getRetentionInfo, archiveOlderThan, listAuditLogs } from '@titan/database';
import { getLogger } from '@titan/logging';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';

const log = getLogger().child({ component: 'compliance-routes' });

export const complianceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/compliance/audit/verify', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.AUDIT_READ);
    try {
      const result = await verifyHashChain();
      return reply.send(result);
    } catch (err) {
      log.error({ err }, 'failed to verify audit hash chain');
      return reply.status(500).send({ error: 'Failed to verify audit hash chain' });
    }
  });

  app.get('/api/v1/compliance/audit/retention', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.AUDIT_READ);
    try {
      const info = await getRetentionInfo();
      return reply.send(info);
    } catch (err) {
      log.error({ err }, 'failed to get retention info');
      return reply.status(500).send({ error: 'Failed to get retention info' });
    }
  });

  app.post('/api/v1/compliance/audit/archive', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.AUDIT_WRITE);
    const schema = z.object({
      daysOld: z.number().int().min(1).max(3650).default(365),
      batchSize: z.number().int().min(1).max(10000).default(1000),
    });
    try {
      const body = schema.parse(req.body);
      const result = await archiveOlderThan(body.daysOld, body.batchSize);
      return reply.send(result);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      log.error({ err }, 'failed to archive audit logs');
      return reply.status(500).send({ error: 'Failed to archive audit logs' });
    }
  });

  app.get('/api/v1/compliance/audit/logs', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.AUDIT_READ);
    try {
      const qs = req.query as Record<string, string>;
      const result = await listAuditLogs({
        limit: qs.limit ? parseInt(qs.limit, 10) : undefined,
        offset: qs.offset ? parseInt(qs.offset, 10) : undefined,
        action: qs.action,
        resource: qs.resource,
        workspaceId: qs.workspaceId,
        actorId: qs.actorId,
      });
      return reply.send({ items: result, total: result.length });
    } catch (err) {
      log.error({ err }, 'failed to list audit logs');
      return reply.status(500).send({ error: 'Failed to list audit logs' });
    }
  });
};
