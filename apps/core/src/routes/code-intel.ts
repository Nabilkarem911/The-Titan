import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { buildCodebaseIndex, findSymbol, findFile, getDependents, getDependencies, getExportedSymbols, type CodebaseIndex } from '@titan/agent-engine';
import { requireAuth } from '../plugins/auth.js';

let currentIndex: CodebaseIndex | null = null;

export const codeIntelRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/codeintel/index — index a directory
  app.post('/api/v1/codeintel/index', { preHandler: [requireAuth] }, async (req, reply) => {
    const { rootDir, maxFiles } = req.body as { rootDir: string; maxFiles?: number };

    if (!rootDir) {
      return reply.status(400).send({ error: 'rootDir is required' });
    }

    try {
      currentIndex = buildCodebaseIndex(rootDir, maxFiles || 5000);
      return reply.send({
        rootDir: currentIndex.rootDir,
        stats: currentIndex.stats,
        indexedAt: currentIndex.indexedAt,
      });
    } catch (err) {
      return reply.status(500).send({
        error: 'Indexing failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // GET /api/v1/codeintel/stats — current index stats
  app.get('/api/v1/codeintel/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    if (!currentIndex) return reply.send({ indexed: false });
    return reply.send({
      indexed: true,
      rootDir: currentIndex.rootDir,
      stats: currentIndex.stats,
      indexedAt: currentIndex.indexedAt,
    });
  });

  // POST /api/v1/codeintel/search/symbols — search symbols
  app.post('/api/v1/codeintel/search/symbols', { preHandler: [requireAuth] }, async (req, reply) => {
    if (!currentIndex) return reply.status(400).send({ error: 'No index. Index a directory first.' });
    const { query, limit } = req.body as { query: string; limit?: number };
    if (!query) return reply.status(400).send({ error: 'query is required' });

    const results = findSymbol(currentIndex, query).slice(0, limit || 50);
    return reply.send({ results, total: results.length });
  });

  // POST /api/v1/codeintel/search/files — search files
  app.post('/api/v1/codeintel/search/files', { preHandler: [requireAuth] }, async (req, reply) => {
    if (!currentIndex) return reply.status(400).send({ error: 'No index. Index a directory first.' });
    const { query, limit } = req.body as { query: string; limit?: number };
    if (!query) return reply.status(400).send({ error: 'query is required' });

    const results = findFile(currentIndex, query).slice(0, limit || 50);
    return reply.send({
      results: results.map(f => ({ relativePath: f.relativePath, extension: f.extension, lines: f.lines, size: f.size })),
      total: results.length,
    });
  });

  // GET /api/v1/codeintel/symbols — all exported symbols
  app.get('/api/v1/codeintel/symbols', { preHandler: [requireAuth] }, async (req, reply) => {
    if (!currentIndex) return reply.status(400).send({ error: 'No index.' });
    const { filePath } = req.query as { filePath?: string };
    const symbols = getExportedSymbols(currentIndex, filePath);
    return reply.send({ symbols, total: symbols.length });
  });

  // GET /api/v1/codeintel/dependencies/:filePath — get dependencies and dependents
  app.get('/api/v1/codeintel/dependencies/*', { preHandler: [requireAuth] }, async (req, reply) => {
    if (!currentIndex) return reply.status(400).send({ error: 'No index.' });
    const filePath = (req.params as { '*': string })['*'];
    const deps = getDependencies(currentIndex, filePath);
    const dependents = getDependents(currentIndex, filePath);
    return reply.send({ filePath, dependencies: deps, dependents });
  });

  // GET /api/v1/codeintel/files — list all indexed files
  app.get('/api/v1/codeintel/files', { preHandler: [requireAuth] }, async (req, reply) => {
    if (!currentIndex) return reply.status(400).send({ error: 'No index.' });
    const { extension } = req.query as { extension?: string };
    let files = currentIndex.files;
    if (extension) files = files.filter(f => f.extension === extension);
    return reply.send({
      files: files.map(f => ({ relativePath: f.relativePath, extension: f.extension, lines: f.lines, size: f.size })),
      total: files.length,
    });
  });
};
