import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  CreateWorkspaceInputSchema,
  UpdateWorkspaceInputSchema,
  AddMemberInputSchema,
  PERMISSIONS,
} from '@titan/shared';
import { workspaces, members, users as usersRepo } from '@titan/database';
import { resolveWorkspaceContext } from '@titan/auth';
import { requirePermission, requireAuth, canAssignRole, isValidRole } from '../plugins/auth.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
} from '@titan/shared';
import { getAbuseDetector } from '@titan/observability';

const abuse = getAbuseDetector();

async function resolveCtxWithAbuse(userId: string, workspaceId: string, auth: { apiKeyId?: string; permissions: readonly string[] }, url: string) {
  try {
    return await resolveWorkspaceContext(userId, workspaceId, apiKeyOptions(auth));
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      abuse.record({
        signal: 'cross_workspace_access',
        subject: `u:${userId}`,
        metadata: { workspaceId, route: url, reason: (err as Error).message },
      });
    }
    throw err;
  }
}

const RATE_LIMIT_API = { config: { rateLimit: { max: 100, timeWindow: '1 minute' } } };

export const workspaceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/workspaces', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const list = await workspaces.listForUser(req.auth.userId);
    return { items: list, total: list.length };
  });

  app.post('/workspaces', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const input = CreateWorkspaceInputSchema.parse(req.body);
    const existing = await workspaces.findBySlug(input.slug);
    if (existing) throw new ConflictError(`Workspace with slug '${input.slug}' already exists`);
    const created = await workspaces.create({
      name: input.name,
      slug: input.slug,
      ...(input.description !== undefined ? { description: input.description } : {}),
      ownerId: req.auth.userId,
    });
    return reply.status(201).send(created);
  });

  app.get<{ Params: { id: string } }>('/workspaces/:id', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const ctx = await resolveCtxWithAbuse(req.auth.userId, req.params.id, req.auth, req.url);
    requirePermission(ctx, PERMISSIONS.WORKSPACE_READ);
    const ws = await workspaces.findById(ctx.workspaceId!);
    if (!ws) throw new NotFoundError('Workspace', req.params.id);
    return { ...ws, role: ctx.role };
  });

  app.patch<{ Params: { id: string } }>('/workspaces/:id', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const ctx = await resolveCtxWithAbuse(req.auth.userId, req.params.id, req.auth, req.url);
    requirePermission(ctx, PERMISSIONS.WORKSPACE_WRITE);
    const input = UpdateWorkspaceInputSchema.parse(req.body);
    const updated = await workspaces.update(ctx.workspaceId!, input);
    if (!updated) throw new NotFoundError('Workspace', req.params.id);
    return updated;
  });

  app.delete<{ Params: { id: string } }>('/workspaces/:id', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const ctx = await resolveCtxWithAbuse(req.auth.userId, req.params.id, req.auth, req.url);
    requirePermission(ctx, PERMISSIONS.WORKSPACE_DELETE);
    await workspaces.softDelete(ctx.workspaceId!);
    return reply.status(204).send();
  });

  app.get<{ Params: { id: string } }>('/workspaces/:id/members', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const ctx = await resolveCtxWithAbuse(req.auth.userId, req.params.id, req.auth, req.url);
    requirePermission(ctx, PERMISSIONS.WORKSPACE_READ);
    const list = await members.list(ctx.workspaceId!);
    return { items: list, total: list.length };
  });

  app.post<{ Params: { id: string } }>('/workspaces/:id/members', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const ctx = await resolveCtxWithAbuse(req.auth.userId, req.params.id, req.auth, req.url);
    requirePermission(ctx, PERMISSIONS.WORKSPACE_ADMIN);
    const input = AddMemberInputSchema.parse(req.body);
    if (!isValidRole(input.role)) {
      throw new ValidationError(`Invalid role: ${input.role}`);
    }
    if (!ctx.role || !canAssignRole(ctx.role, input.role)) {
      throw new UnauthorizedError(`Role '${ctx.role}' cannot assign role '${input.role}'`);
    }
    const target = await usersRepo.findById(input.userId);
    if (!target) throw new NotFoundError('User', input.userId);
    const added = await members.add(ctx.workspaceId!, input.userId, input.role);
    return added;
  });

  app.delete<{ Params: { id: string; userId: string } }>('/workspaces/:id/members/:userId', { preHandler: requireAuth, ...RATE_LIMIT_API }, async (req, reply) => {
    if (!req.auth) throw new ValidationError('Authentication required');
    const ctx = await resolveCtxWithAbuse(req.auth.userId, req.params.id, req.auth, req.url);
    requirePermission(ctx, PERMISSIONS.WORKSPACE_ADMIN);
    if (!ctx.role || ctx.role === 'viewer') {
      throw new UnauthorizedError('Insufficient privileges to remove members');
    }
    await members.remove(ctx.workspaceId!, req.params.userId);
    return reply.status(204).send();
  });
};

function apiKeyOptions(auth: { apiKeyId?: string; permissions: readonly string[] }) {
  if (!auth.apiKeyId) return undefined;
  return { apiKeyId: auth.apiKeyId, apiKeyPermissions: auth.permissions as readonly never[] };
}
