import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth } from '../plugins/auth.js';
import { DependencyGraph } from '@titan/agent-engine';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

let graph: DependencyGraph | null = null;

function getGraph(): DependencyGraph {
  if (graph) return graph;
  graph = new DependencyGraph();
  return graph;
}

export const codeArchitectureRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/architecture/index — index a file or directory
  app.post('/api/v1/architecture/index', { preHandler: [requireAuth] }, async (req, reply) => {
    const { filePath } = req.body as { filePath: string };
    if (!filePath || !existsSync(filePath)) {
      return reply.code(400).send({ error: 'Valid filePath is required' });
    }

    const g = getGraph();
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      // Index all TS/JS files in directory (recursive, limited)
      const { readdirSync } = await import('node:fs');
      const indexed: string[] = [];
      const indexDir = (dir: string, depth: number) => {
        if (depth > 5) return;
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist') continue;
          const fullPath = join(dir, entry.name);
          if (entry.isDirectory()) {
            indexDir(fullPath, depth + 1);
          } else if (/\.(ts|js|mjs|tsx|jsx)$/.test(entry.name)) {
            try {
              g.indexFile(fullPath, readFileSync(fullPath, 'utf-8'));
              indexed.push(fullPath);
            } catch { /* skip unreadable files */ }
          }
        }
      };
      indexDir(filePath, 0);
      return reply.send({ indexed: indexed.length, files: indexed });
    } else {
      const node = g.indexFile(filePath, readFileSync(filePath, 'utf-8'));
      return reply.send({ indexed: 1, file: node });
    }
  });

  // GET /api/v1/architecture/impact?file=... — analyze impact of changing a file
  app.get('/api/v1/architecture/impact', { preHandler: [requireAuth] }, async (req, reply) => {
    const { file } = req.query as { file?: string };
    if (!file) return reply.code(400).send({ error: 'file query param is required' });

    const g = getGraph();
    const impact = g.analyzeImpact(file);
    return reply.send(impact);
  });

  // GET /api/v1/architecture/dependencies?file=... — get dependencies of a file
  app.get('/api/v1/architecture/dependencies', { preHandler: [requireAuth] }, async (req, reply) => {
    const { file } = req.query as { file?: string };
    if (!file) return reply.code(400).send({ error: 'file query param is required' });

    const g = getGraph();
    return reply.send({
      file,
      dependencies: g.getDependencies(file),
      dependents: g.getDependents(file),
    });
  });

  // GET /api/v1/architecture/stats — get graph statistics
  app.get('/api/v1/architecture/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const g = getGraph();
    return reply.send(g.stats());
  });

  // GET /api/v1/architecture/cycles — find circular dependencies
  app.get('/api/v1/architecture/cycles', { preHandler: [requireAuth] }, async (_req, reply) => {
    const g = getGraph();
    const cycles = g.findCircularDependencies();
    return reply.send({ cycles, count: cycles.length });
  });

  // GET /api/v1/architecture/files — list all indexed files
  app.get('/api/v1/architecture/files', { preHandler: [requireAuth] }, async (_req, reply) => {
    const g = getGraph();
    return reply.send({ files: g.getAllFiles().map((f: { path: string; name: string; loc: number; exports: string[]; imports: string[] }) => ({ path: f.path, name: f.name, loc: f.loc, exports: f.exports, imports: f.imports })) });
  });
};
