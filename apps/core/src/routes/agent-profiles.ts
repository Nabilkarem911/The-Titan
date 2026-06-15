import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { agentProfiles } from '@titan/database';
import { ValidationError, ConflictError, NotFoundError } from '@titan/shared';
import { requireAuth } from '../plugins/auth.js';

const CreateProfileSchema = z.object({
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().min(1).max(50_000).optional(),
  model: z.string().max(200).optional(),
  allowedTools: z.array(z.string().max(200)).max(100).optional(),
  forbiddenTools: z.array(z.string().max(200)).max(100).optional(),
  maxSteps: z.number().int().min(1).max(50).optional().default(10),
  temperature: z.number().min(0).max(2).optional(),
  workspaceId: z.string().uuid().optional(),
  isPublic: z.boolean().optional().default(false),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateProfileSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/).optional(),
  description: z.string().max(2000).nullable().optional(),
  systemPrompt: z.string().min(1).max(50_000).optional(),
  model: z.string().max(200).nullable().optional(),
  allowedTools: z.array(z.string().max(200)).max(100).optional(),
  forbiddenTools: z.array(z.string().max(200)).max(100).optional(),
  maxSteps: z.number().int().min(1).max(50).optional(),
  temperature: z.number().min(0).max(2).nullable().optional(),
  isPublic: z.boolean().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const RATE_LIMIT_PROFILES = { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } };

function serializeProfile(p: Awaited<ReturnType<typeof agentProfiles.findById>>) {
  if (!p) return null;
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    description: p.description,
    systemPrompt: p.systemPrompt,
    model: p.model,
    allowedTools: p.allowedTools,
    forbiddenTools: p.forbiddenTools,
    maxSteps: p.maxSteps,
    temperature: p.temperature,
    ownerId: p.ownerId,
    workspaceId: p.workspaceId,
    isPublic: p.isPublic,
    metadata: p.metadata,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export const agentProfileRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/agent-profiles — list my agent profiles
  app.get<{ Querystring: { limit?: string; offset?: string; workspaceId?: string } }>(
    '/api/v1/agent-profiles',
    { preHandler: requireAuth, ...RATE_LIMIT_PROFILES },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);

      const profiles = req.query.workspaceId
        ? await agentProfiles.listForWorkspace(req.query.workspaceId, { limit, offset })
        : await agentProfiles.listForOwner(req.auth.userId, { limit, offset });

      return { items: profiles.map(serializeProfile), total: profiles.length };
    },
  );

  // GET /api/v1/agent-profiles/public — list public agent profiles
  app.get<{ Querystring: { limit?: string; offset?: string } }>(
    '/api/v1/agent-profiles/public',
    { ...RATE_LIMIT_PROFILES },
    async (req) => {
      const limit = Math.min(parseInt(req.query.limit ?? '50', 10), 100);
      const offset = parseInt(req.query.offset ?? '0', 10);
      const profiles = await agentProfiles.listPublic({ limit, offset });
      return { items: profiles.map(serializeProfile), total: profiles.length };
    },
  );

  // POST /api/v1/agent-profiles — create new agent profile
  app.post(
    '/api/v1/agent-profiles',
    { preHandler: requireAuth, ...RATE_LIMIT_PROFILES },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const input = CreateProfileSchema.parse(req.body);

      // Check for duplicate slug
      const existing = await agentProfiles.findBySlug(req.auth.userId, input.slug);
      if (existing) throw new ConflictError(`Agent profile with slug '${input.slug}' already exists`);

      const profile = await agentProfiles.create({
        ...input,
        ownerId: req.auth.userId,
      });

      return reply.status(201).send(serializeProfile(profile));
    },
  );

  // GET /api/v1/agent-profiles/:id — get agent profile
  app.get<{ Params: { id: string } }>(
    '/api/v1/agent-profiles/:id',
    { preHandler: requireAuth, ...RATE_LIMIT_PROFILES },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const profile = await agentProfiles.findById(req.params.id);
      if (!profile) throw new NotFoundError('AgentProfile', req.params.id);
      if (profile.ownerId !== req.auth.userId && !profile.isPublic) {
        throw new NotFoundError('AgentProfile', req.params.id);
      }
      return serializeProfile(profile);
    },
  );

  // PATCH /api/v1/agent-profiles/:id — update agent profile
  app.patch<{ Params: { id: string } }>(
    '/api/v1/agent-profiles/:id',
    { preHandler: requireAuth, ...RATE_LIMIT_PROFILES },
    async (req) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const existing = await agentProfiles.findById(req.params.id);
      if (!existing || existing.ownerId !== req.auth.userId) {
        throw new NotFoundError('AgentProfile', req.params.id);
      }

      const input = UpdateProfileSchema.parse(req.body);

      // Check slug conflict if changing
      if (input.slug && input.slug !== existing.slug) {
        const conflict = await agentProfiles.findBySlug(req.auth.userId, input.slug);
        if (conflict) throw new ConflictError(`Agent profile with slug '${input.slug}' already exists`);
      }

      const updated = await agentProfiles.update(req.params.id, input);
      return serializeProfile(updated);
    },
  );

  // DELETE /api/v1/agent-profiles/:id — delete agent profile
  app.delete<{ Params: { id: string } }>(
    '/api/v1/agent-profiles/:id',
    { preHandler: requireAuth, ...RATE_LIMIT_PROFILES },
    async (req, reply) => {
      if (!req.auth) throw new ValidationError('Authentication required');
      const existing = await agentProfiles.findById(req.params.id);
      if (!existing || existing.ownerId !== req.auth.userId) {
        throw new NotFoundError('AgentProfile', req.params.id);
      }
      await agentProfiles.delete(req.params.id);
      return reply.status(204).send();
    },
  );
};
