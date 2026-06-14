import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { CreateApiKeyInputSchema } from '@titan/shared';
import { createApiKey, revokeApiKey } from '@titan/auth';
import { apiKeys, audit } from '@titan/database';
import { AUDIT_ACTIONS } from '@titan/shared';
import { ValidationError, type ApiKey, type Permission } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';

const RATE_LIMIT_API = { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } };

export const apiKeyRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/api/v1/api-keys', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = CreateApiKeyInputSchema.parse(req.body);
    const created = await createApiKey({
      userId: req.auth.userId,
      ...(input.workspaceId !== undefined ? { workspaceId: input.workspaceId } : {}),
      name: input.name,
      ...(input.scopes !== undefined ? { scopes: input.scopes as readonly Permission[] } : {}),
      ...(input.expiresAt !== undefined ? { expiresAt: new Date(input.expiresAt) } : {}),
    });
    await audit.write({
      actorId: req.auth.userId,
      workspaceId: input.workspaceId ?? null,
      action: AUDIT_ACTIONS.API_KEY_CREATED,
      resource: 'api_key',
      resourceId: created.id,
      metadata: { name: input.name, scopeCount: input.scopes.length },
    });
    return {
      id: created.id,
      name: input.name,
      key: created.plaintext,
      keyPrefix: created.keyPrefix,
      createdAt: created.createdAt.toISOString(),
    };
  });

  app.get('/api/v1/api-keys', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const list = await apiKeys.listForUser(req.auth.userId);
    return {
      items: list.map((k: ApiKey) => ({
        id: k.id,
        name: k.name,
        keyPrefix: k.keyPrefix,
        scopes: k.scopes,
        workspaceId: k.workspaceId,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
      total: list.length,
    };
  });

  app.delete<{ Params: { id: string } }>('/api/v1/api-keys/:id', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    await revokeApiKey(req.auth.userId, req.params.id);
    await audit.write({
      actorId: req.auth.userId,
      workspaceId: null,
      action: AUDIT_ACTIONS.API_KEY_REVOKED,
      resource: 'api_key',
      resourceId: req.params.id,
    });
    return reply.status(204).send();
  });
};
