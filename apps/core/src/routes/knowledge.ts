import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { KnowledgeBase, type KBSearchResult } from '@titan/memory';
import { requireAuth } from '../plugins/auth.js';

// In-memory knowledge base (persists for server lifetime)
const kb = new KnowledgeBase();

export const knowledgeRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // GET /api/v1/knowledge/stats — KB statistics
  app.get('/api/v1/knowledge/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.send(kb.stats());
  });

  // GET /api/v1/knowledge/documents — list all documents
  app.get('/api/v1/knowledge/documents', { preHandler: [requireAuth] }, async (_req, reply) => {
    return reply.send({ items: kb.listDocuments() });
  });

  // POST /api/v1/knowledge/upload — upload text content as a document
  app.post('/api/v1/knowledge/upload', { preHandler: [requireAuth] }, async (req, reply) => {
    const { name, content, type } = req.body as { name: string; content: string; type?: 'text' | 'markdown' };

    if (!name || !content) {
      return reply.status(400).send({ error: 'name and content are required' });
    }

    if (content.length > 500_000) {
      return reply.status(413).send({ error: 'Content too large (max 500KB)' });
    }

    const doc = kb.addDocument(content, name, type || 'text');
    return reply.send({ id: doc.id, name: doc.name, chunks: doc.totalChunks, chars: doc.totalChars });
  });

  // POST /api/v1/knowledge/upload-file — upload a file (multipart)
  app.post('/api/v1/knowledge/upload-file', { preHandler: [requireAuth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No file provided' });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const content = Buffer.concat(chunks).toString('utf-8');

    if (content.length > 500_000) {
      return reply.status(413).send({ error: 'File too large (max 500KB text)' });
    }

    const docType = data.mimetype === 'text/markdown' ? 'markdown' : 'text';
    const doc = kb.addDocument(content, data.filename, docType);
    return reply.send({ id: doc.id, name: doc.name, chunks: doc.totalChunks, chars: doc.totalChars });
  });

  // DELETE /api/v1/knowledge/documents/:docId — remove a document
  app.delete('/api/v1/knowledge/documents/:docId', { preHandler: [requireAuth] }, async (req, reply) => {
    const { docId } = req.params as { docId: string };
    const removed = kb.removeDocument(docId);
    if (!removed) return reply.status(404).send({ error: 'Document not found' });
    return reply.send({ deleted: true, docId });
  });

  // POST /api/v1/knowledge/search — search the KB
  app.post('/api/v1/knowledge/search', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query, limit } = req.body as { query: string; limit?: number };

    if (!query || !query.trim()) {
      return reply.status(400).send({ error: 'query is required' });
    }

    const results: KBSearchResult[] = kb.search(query.trim(), limit || 5);
    return reply.send({
      results: results.map(r => ({
        documentName: r.documentName,
        citation: r.citation,
        score: r.score,
        content: r.chunk.content.slice(0, 1000),
        chunkIndex: r.chunk.index,
      })),
      total: results.length,
    });
  });

  // POST /api/v1/knowledge/query — search + return formatted context for agent injection
  app.post('/api/v1/knowledge/query', { preHandler: [requireAuth] }, async (req, reply) => {
    const { query, limit } = req.body as { query: string; limit?: number };

    if (!query || !query.trim()) {
      return reply.status(400).send({ error: 'query is required' });
    }

    const { answer, citations } = kb.searchWithCitations(query.trim(), limit || 5);
    return reply.send({ context: answer, citations });
  });

  // DELETE /api/v1/knowledge/clear — clear all documents
  app.delete('/api/v1/knowledge/clear', { preHandler: [requireAuth] }, async (_req, reply) => {
    kb.clear();
    return reply.send({ cleared: true });
  });
};
