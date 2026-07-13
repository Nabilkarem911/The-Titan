import type { FastifyPluginAsync } from 'fastify';
import { join, resolve, relative } from 'node:path';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import { gitPush } from '@titan/tools';

const GitPushInputSchema = z.object({
  cwd: z.string().min(1).max(1000),
  commitMessage: z.string().max(5000).optional(),
  remote: z.string().max(200).optional(),
  branch: z.string().max(200).optional(),
  addAll: z.boolean().optional(),
  files: z.array(z.string().min(1).max(500)).optional(),
  skipCommit: z.boolean().optional(),
  skipPush: z.boolean().optional(),
  createTag: z.string().max(200).optional(),
});

export const gitRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  app.post('/api/v1/git/push', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const input = GitPushInputSchema.parse(req.body);

    // Always resolve cwd relative to the user's workspace root
    const workspaceRoot = getWorkspaceRoot(userId);
    const resolvedCwd = (!input.cwd || input.cwd === '/')
      ? workspaceRoot
      : resolve(workspaceRoot, input.cwd.replace(/^\/+/, ''));

    // Validate the resolved path stays inside the workspace
    const rel = relative(workspaceRoot, resolvedCwd);
    if (rel.startsWith('..') || resolve(resolvedCwd) !== resolvedCwd) {
      return reply.status(400).send({
        success: false,
        message: 'Invalid cwd: path must be within your workspace',
        details: [],
      });
    }

    try {
      const result = await gitPush({ ...input, cwd: resolvedCwd });
      return reply.status(result.success ? 200 : 400).send(result);
    } catch (err) {
      console.error('[git] operation failed:', err);
      return reply.status(500).send({
        success: false,
        message: 'Git operation failed',
        details: [],
      });
    }
  });
};

function getWorkspaceRoot(userId: string): string {
  const base = process.env.WORKSPACE_ROOT ?? join(process.cwd(), 'workspaces');
  return join(base, userId);
}
