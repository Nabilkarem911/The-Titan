import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { getMultimodalProcessor } from '@titan/agent-engine';
import { existsSync } from 'node:fs';

export const multimodalRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/multimodal/analyze — analyze an image or PDF
  app.post('/api/v1/multimodal/analyze', { preHandler: [requireAuth] }, async (req, reply) => {
    const { filePath } = req.body as { filePath: string };
    if (!filePath) return reply.code(400).send({ error: 'filePath is required' });
    if (!existsSync(filePath)) return reply.code(404).send({ error: `File not found: ${filePath}` });

    const processor = getMultimodalProcessor();
    const result = await processor.analyzeFile(filePath);
    return reply.send(result);
  });

  // GET /api/v1/multimodal/formats — get supported formats
  app.get('/api/v1/multimodal/formats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const processor = getMultimodalProcessor();
    return reply.send({
      ...processor.getSupportedFormats(),
      visionEnabled: processor.isVisionEnabled(),
    });
  });
};
