import type { FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { gitPush } from '@titan/tools';
import type { GitPushInput } from '@titan/tools';

export const gitRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  app.post('/api/v1/git/push', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const input = req.body as GitPushInput;

    // Default workspace path
    const workspaceRoot = input.cwd === '/' ? getWorkspaceRoot(userId) : input.cwd;

    try {
      const result = await gitPush({ ...input, cwd: workspaceRoot });
      return reply.status(result.success ? 200 : 400).send(result);
    } catch (err) {
      return reply.status(500).send({
        success: false,
        message: err instanceof Error ? err.message : 'Git operation failed',
        details: [],
      });
    }
  });
};

function getWorkspaceRoot(userId: string): string {
  const { join } = require('node:path');
  const base = process.env.WORKSPACE_ROOT ?? join(process.cwd(), 'workspaces');
  return join(base, userId);
}
