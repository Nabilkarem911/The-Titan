import type { FastifyInstance, FastifyPluginAsync, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { plugins, pluginVersions, pluginRatings, pluginSearch } from '@titan/database';
import { getLogger } from '@titan/logging';
import { getGlobalPluginRunner, getGlobalToolRegistry } from '@titan/agent-engine';
import { requireAuth } from '../plugins/auth.js';

const log = getLogger().child({ component: 'plugin-routes' });
const runner = getGlobalPluginRunner();
const toolRegistry = getGlobalToolRegistry();

const installSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  author: z.string().max(500).optional(),
  source: z.enum(['registry', 'local', 'marketplace']).default('local'),
  tags: z.array(z.string().max(100)).max(50).optional(),
  capabilities: z.array(z.string().max(100)).max(50).optional(),
  version: z.string().min(1).max(100).default('0.1.0'),
  manifest: z.record(z.unknown()).optional(),
  entrypoint: z.string().max(500).optional(),
  checksum: z.string().min(1).max(128),
  signature: z.string().max(2000).optional(),
});

export const pluginRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.get('/api/v1/plugins', async (_req, reply) => {
    try {
      const result = await plugins.list({ limit: 100 });
      return reply.send({ items: result.items, total: result.total });
    } catch (err) {
      log.error({ err }, 'failed to list plugins');
      return reply.status(500).send({ error: 'Failed to list plugins' });
    }
  });

  app.get('/api/v1/plugins/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const plugin = await plugins.findById(id);
      if (!plugin) return reply.status(404).send({ error: 'Plugin not found' });

      const versions = await pluginVersions.findByPlugin(id);
      return reply.send({ ...plugin, versions });
    } catch (err) {
      log.error({ err, id }, 'failed to get plugin');
      return reply.status(500).send({ error: 'Failed to get plugin' });
    }
  });

  app.post('/api/v1/plugins', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    try {
      const body = installSchema.parse(req.body);
      log.info({ name: body.name }, 'installing plugin');

      const existing = await plugins.findByName(body.name);
      if (existing) {
        return reply.status(409).send({ error: 'Plugin with this name already exists' });
      }

      const plugin = await plugins.create({
        name: body.name,
        description: body.description,
        author: body.author,
        source: body.source,
        tags: body.tags,
        capabilities: body.capabilities,
      });

      await pluginVersions.create({
        pluginId: plugin.id,
        version: body.version,
        manifest: body.manifest ?? {},
        entrypoint: body.entrypoint,
        checksum: body.checksum,
        signature: body.signature,
      });

      return reply.status(201).send(plugin);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      log.error({ err }, 'failed to install plugin');
      return reply.status(500).send({ error: 'Failed to install plugin' });
    }
  });

  app.patch('/api/v1/plugins/:id/status', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ status: z.enum(['enabled', 'disabled', 'error']) });
    try {
      const { status } = schema.parse(req.body);
      const plugin = await plugins.findById(id);
      if (!plugin) return reply.status(404).send({ error: 'Plugin not found' });

      const updated = await plugins.updateStatus(id, status);
      if (!updated) return reply.status(404).send({ error: 'Plugin not found' });

      if (status === 'enabled') {
        const versions = await pluginVersions.findByPlugin(id);
        const published = versions.find((v) => v.status === 'published') ?? versions[0];
        if (published) {
          const manifestTools = (published.manifest.tools as Array<{ name: string; description: string; tags?: string[] }> | undefined) ?? [];
          await runner.load({
            name: plugin.name,
            version: published.version,
            description: plugin.description ?? undefined,
            tools: manifestTools,
          });
          // Register placeholder handlers for each plugin tool
          for (const tool of manifestTools) {
            toolRegistry.register({
              name: tool.name,
              description: `${tool.description} (from ${plugin.name})`,
              handler: async () => ({ note: `Plugin tool ${tool.name} executed via ${plugin.name}` }),
              tags: [...(tool.tags ?? []), 'plugin', plugin.name],
            });
          }
          log.info({ plugin: plugin.name }, 'plugin tools registered');
        }
      } else if (status === 'disabled') {
        runner.unload(plugin.name);
        const registered = toolRegistry.list();
        for (const t of registered) {
          if (t.tags?.includes(plugin.name)) {
            toolRegistry.unregister(t.name);
          }
        }
        log.info({ plugin: plugin.name }, 'plugin tools unregistered');
      }

      return reply.send(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      log.error({ err, id }, 'failed to update plugin status');
      return reply.status(500).send({ error: 'Failed to update plugin status' });
    }
  });

  app.post('/api/v1/plugins/:id/execute', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      tool: z.string().min(1),
      params: z.record(z.unknown()).default({}),
    });
    try {
      const { tool, params } = schema.parse(req.body);
      const plugin = await plugins.findById(id);
      if (!plugin) return reply.status(404).send({ error: 'Plugin not found' });
      if (plugin.status !== 'enabled') {
        return reply.status(409).send({ error: 'Plugin is not enabled' });
      }

      const result = await toolRegistry.execute(tool, params);
      return reply.send({ tool, result });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      log.error({ err, id }, 'failed to execute plugin tool');
      return reply.status(500).send({ error: 'Failed to execute plugin tool' });
    }
  });

  app.get('/api/v1/plugins/search', async (req, reply) => {
    try {
      const queryStr = (req.query as Record<string, unknown>).q as string | undefined;
      const tag = (req.query as Record<string, unknown>).tag as string | undefined;
      const capability = (req.query as Record<string, unknown>).capability as string | undefined;
      const source = (req.query as Record<string, unknown>).source as string | undefined;
      const status = (req.query as Record<string, unknown>).status as string | undefined;
      const sortBy = (req.query as Record<string, unknown>).sortBy as string | undefined;
      const limit = Number((req.query as Record<string, unknown>).limit ?? 100);
      const offset = Number((req.query as Record<string, unknown>).offset ?? 0);

      const result = await pluginSearch.search({
        query: queryStr,
        tag,
        capability,
        source,
        status,
        sortBy: sortBy as 'name' | 'updated_at' | 'created_at' | undefined,
        limit,
        offset,
      });
      return reply.send({ items: result.items, total: result.total });
    } catch (err) {
      log.error({ err }, 'failed to search plugins');
      return reply.status(500).send({ error: 'Failed to search plugins' });
    }
  });

  app.post('/api/v1/plugins/:id/rate', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({
      rating: z.number().int().min(1).max(5),
      review: z.string().max(5000).optional(),
    });
    try {
      const body = schema.parse(req.body);
      const auth = (req as { auth?: { userId: string } }).auth;
      const rating = await pluginRatings.create({
        pluginId: id,
        userId: auth?.userId,
        rating: body.rating,
        review: body.review,
      });
      return reply.status(201).send(rating);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      log.error({ err, id }, 'failed to rate plugin');
      return reply.status(500).send({ error: 'Failed to rate plugin' });
    }
  });

  app.get('/api/v1/plugins/:id/ratings', async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const [ratings, avg] = await Promise.all([
        pluginRatings.findByPlugin(id),
        pluginRatings.averageRating(id),
      ]);
      return reply.send({ ratings, average: avg });
    } catch (err) {
      log.error({ err, id }, 'failed to get plugin ratings');
      return reply.status(500).send({ error: 'Failed to get plugin ratings' });
    }
  });

  app.patch('/api/v1/plugins/:id/versions/:vid/publish', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    const { id, vid } = req.params as { id: string; vid: string };
    try {
      const plugin = await plugins.findById(id);
      if (!plugin) return reply.status(404).send({ error: 'Plugin not found' });

      const updated = await pluginVersions.updateStatus(vid, 'published');
      if (!updated) return reply.status(404).send({ error: 'Version not found' });
      return reply.send(updated);
    } catch (err) {
      log.error({ err, id, vid }, 'failed to publish version');
      return reply.status(500).send({ error: 'Failed to publish version' });
    }
  });

  app.patch('/api/v1/plugins/:id/versions/:vid/deprecate', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    const { id, vid } = req.params as { id: string; vid: string };
    try {
      const plugin = await plugins.findById(id);
      if (!plugin) return reply.status(404).send({ error: 'Plugin not found' });

      const updated = await pluginVersions.updateStatus(vid, 'deprecated');
      if (!updated) return reply.status(404).send({ error: 'Version not found' });
      return reply.send(updated);
    } catch (err) {
      log.error({ err, id, vid }, 'failed to deprecate version');
      return reply.status(500).send({ error: 'Failed to deprecate version' });
    }
  });

  app.delete('/api/v1/plugins/:id', { preHandler: [async (req: FastifyRequest) => { await requireAuth(req); }] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    try {
      const removed = await plugins.deleteById(id);
      if (!removed) return reply.status(404).send({ error: 'Plugin not found' });
      return reply.status(204).send();
    } catch (err) {
      log.error({ err, id }, 'failed to delete plugin');
      return reply.status(500).send({ error: 'Failed to delete plugin' });
    }
  });
};
