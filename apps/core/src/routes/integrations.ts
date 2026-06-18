import type { FastifyInstance } from 'fastify';

export default async function integrationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/v1/integrations', async (req, reply) => {
    return {
      integrations: [
        { type: 'slack', status: 'disconnected', available: true },
        { type: 'discord', status: 'disconnected', available: true },
        { type: 'notion', status: 'disconnected', available: true },
        { type: 'linear', status: 'disconnected', available: true },
        { type: 'jira', status: 'disconnected', available: true },
        { type: 'github', status: 'disconnected', available: true },
        { type: 'google_drive', status: 'disconnected', available: true },
        { type: 's3', status: 'disconnected', available: true },
        { type: 'sentry', status: 'disconnected', available: true },
      ],
    };
  });

  app.post('/api/v1/integrations/:type/connect', async (req, reply) => {
    const { type } = req.params as { type: string };
    const config = req.body as Record<string, unknown>;
    return { type, status: 'connected', note: `${type} integration connected — store config in integrations table` };
  });

  app.delete('/api/v1/integrations/:type', async (req, reply) => {
    const { type } = req.params as { type: string };
    return { type, status: 'disconnected', deleted: true };
  });

  app.get('/api/v1/integrations/:type/config', async (req, reply) => {
    const { type } = req.params as { type: string };
    return { type, config: {}, note: 'Decrypt from integrations table' };
  });

  app.post('/api/v1/integrations/:type/test', async (req, reply) => {
    const { type } = req.params as { type: string };
    return { type, success: false, message: 'Integration not configured', note: 'Test actual connection' };
  });

  app.get('/api/v1/integrations/sync-status', async (req, reply) => {
    return { syncs: [], lastSync: null };
  });
}
