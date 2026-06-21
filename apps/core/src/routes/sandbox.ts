import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'sandbox-routes' });

let sandboxPool: import('@titan/sandbox').SandboxPool | null = null;

async function getOrCreatePool(): Promise<import('@titan/sandbox').SandboxPool | null> {
  if (sandboxPool) return sandboxPool;
  try {
    const { SandboxPool } = await import('@titan/sandbox');
    sandboxPool = new SandboxPool();
    await sandboxPool.initialize();
    return sandboxPool;
  } catch (err) {
    log.warn({ err }, 'failed to initialize sandbox pool');
    return null;
  }
}

export const sandboxRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/sandbox/stats — get sandbox pool statistics
  app.get('/api/v1/sandbox/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const pool = await getOrCreatePool();
    if (!pool) return reply.send({ available: false, stats: null });
    return reply.send({ available: true, stats: pool.getStats() });
  });

  // POST /api/v1/sandbox/execute — execute a command in sandbox
  app.post('/api/v1/sandbox/execute', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { command, timeoutMs } = req.body as { command: string; timeoutMs?: number };

    if (!command || typeof command !== 'string') {
      return reply.code(400).send({ error: 'command is required' });
    }

    const pool = await getOrCreatePool();
    if (!pool) return reply.code(503).send({ error: 'Sandbox unavailable — Docker not connected' });

    const result = await pool.execute(command, timeoutMs ? { timeoutMs } : undefined);
    return reply.send(result);
  });

  // POST /api/v1/sandbox/warm — pre-warm the pool
  app.post('/api/v1/sandbox/warm', { preHandler: [requireAuth] }, async (req, _reply) => {
    const pool = await getOrCreatePool();
    if (!pool) return _reply.code(503).send({ error: 'Sandbox unavailable' });
    return _reply.send({ warmed: true, stats: pool.getStats() });
  });

  // DELETE /api/v1/sandbox/pool — shutdown and clear the pool
  app.delete('/api/v1/sandbox/pool', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    if (sandboxPool) {
      await sandboxPool.shutdown();
      sandboxPool = null;
      log.info('sandbox pool shut down via API');
    }
    return reply.send({ shutDown: true });
  });

  // GET /api/v1/sandbox/config — get sandbox configuration
  app.get('/api/v1/sandbox/config', { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.send({
      strictMode: process.env['SANDBOX_STRICT_MODE'] === 'true',
      autoSandbox: process.env['SANDBOX_AUTO_DANGEROUS'] === 'true',
      dangerousTools: ['execute_bash', 'write_file', 'patch_file', 'docker_orchestrator'],
    });
  });
};
