import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { plugins, pluginVersions } from '@titan/database';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'plugin-routes' });

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

  app.post('/api/v1/plugins', async (req, reply) => {
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

  app.patch('/api/v1/plugins/:id/status', async (req, reply) => {
    const { id } = req.params as { id: string };
    const schema = z.object({ status: z.enum(['enabled', 'disabled', 'error']) });
    try {
      const { status } = schema.parse(req.body);
      const updated = await plugins.updateStatus(id, status);
      if (!updated) return reply.status(404).send({ error: 'Plugin not found' });
      return reply.send(updated);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({ error: err.errors });
      }
      log.error({ err, id }, 'failed to update plugin status');
      return reply.status(500).send({ error: 'Failed to update plugin status' });
    }
  });

  app.delete('/api/v1/plugins/:id', async (req, reply) => {
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
