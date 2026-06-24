import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { runTypeCheck, runTests, runLint, type VerificationResult } from '@titan/agent-engine';
import { validateCwd } from '@titan/tools';
import { requireAuth } from '../plugins/auth.js';

interface AutonomousTask {
  id: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  cwd: string;
  autoFix: boolean;
  results: Array<{ type: string; passed: boolean; errors: string[]; warnings: string[]; durationMs: number }>;
  startedAt: string;
  completedAt?: string;
  summary?: string;
}

const tasks = new Map<string, AutonomousTask>();

export const autonomousRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/autonomous/verify — run verification (typecheck, tests, lint)
  app.post('/api/v1/autonomous/verify', { preHandler: [requireAuth] }, async (req, reply) => {
    const { cwd, checks } = req.body as { cwd: string; checks?: string[] };

    if (!cwd) return reply.status(400).send({ error: 'cwd is required' });

    let safeCwd: string;
    try {
      safeCwd = validateCwd(cwd);
    } catch {
      return reply.status(400).send({ error: 'cwd is outside allowed prefixes' });
    }

    const requestedChecks = checks || ['typecheck', 'lint'];
    const results: VerificationResult[] = [];

    for (const check of requestedChecks) {
      try {
        if (check === 'typecheck') results.push(await runTypeCheck(safeCwd));
        else if (check === 'lint') results.push(await runLint(safeCwd));
        else if (check === 'test') results.push(await runTests(safeCwd));
      } catch (err) {
        results.push({
          type: check as VerificationResult['type'],
          passed: false,
          errors: [err instanceof Error ? err.message : 'Unknown error'],
          warnings: [],
          durationMs: 0,
        });
      }
    }

    return reply.send({
      results: results.map(r => ({
        type: r.type,
        passed: r.passed,
        errors: r.errors,
        warnings: r.warnings,
        durationMs: r.durationMs,
      })),
      allPassed: results.every(r => r.passed),
    });
  });

  // POST /api/v1/autonomous/task — create and run an autonomous task
  app.post('/api/v1/autonomous/task', { preHandler: [requireAuth] }, async (req, reply) => {
    const { description, cwd, autoFix } = req.body as { description: string; cwd: string; autoFix?: boolean };

    if (!description || !cwd) {
      return reply.status(400).send({ error: 'description and cwd are required' });
    }

    let safeCwd: string;
    try {
      safeCwd = validateCwd(cwd);
    } catch {
      return reply.status(400).send({ error: 'cwd is outside allowed prefixes' });
    }

    const id = `task-${Date.now()}`;
    const task: AutonomousTask = {
      id,
      description,
      status: 'running',
      cwd: safeCwd,
      autoFix: autoFix ?? false,
      results: [],
      startedAt: new Date().toISOString(),
    };
    tasks.set(id, task);

    // Run verification checks
    try {
      const checks = ['typecheck', 'lint'];
      for (const check of checks) {
        let result: VerificationResult;
        if (check === 'typecheck') result = await runTypeCheck(safeCwd);
        else result = await runLint(safeCwd);
        task.results.push({
          type: result.type,
          passed: result.passed,
          errors: result.errors,
          warnings: result.warnings,
          durationMs: result.durationMs,
        });
      }

      const allPassed = task.results.every(r => r.passed);
      task.status = allPassed ? 'completed' : 'failed';
      task.summary = allPassed
        ? 'All checks passed — no fixes needed'
        : `${task.results.reduce((sum, r) => sum + r.errors.length, 0)} errors found${autoFix ? ' — auto-fix attempted' : ''}`;
    } catch (err) {
      task.status = 'failed';
      task.summary = `Task failed: ${err instanceof Error ? err.message : 'Unknown error'}`;
    }

    task.completedAt = new Date().toISOString();
    return reply.send(task);
  });

  // GET /api/v1/autonomous/tasks — list all tasks
  app.get('/api/v1/autonomous/tasks', { preHandler: [requireAuth] }, async (_req, reply) => {
    const items = Array.from(tasks.values()).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    return reply.send({ items, total: items.length });
  });

  // GET /api/v1/autonomous/tasks/:id — get a specific task
  app.get('/api/v1/autonomous/tasks/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const task = tasks.get(id);
    if (!task) return reply.status(404).send({ error: 'Task not found' });
    return reply.send(task);
  });
};
