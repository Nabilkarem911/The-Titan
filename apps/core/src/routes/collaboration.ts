import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import { getCollaborationManager } from '@titan/agent-engine';

export const collaborationRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/collaboration/sessions — create a collaboration session
  app.post('/api/v1/collaboration/sessions', { preHandler: [requireAuth] }, async (req, reply) => {
    const { topic, description } = req.body as { topic: string; description?: string };
    if (!topic) return reply.code(400).send({ error: 'topic is required' });

    const mgr = getCollaborationManager();
    const session = mgr.createSession(topic, description ?? '');
    return reply.send({
      sessionId: session.id,
      topic: session.topic,
      status: session.status,
      createdAt: session.createdAt,
    });
  });

  // GET /api/v1/collaboration/sessions — list active sessions
  app.get('/api/v1/collaboration/sessions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mgr = getCollaborationManager();
    const sessions = mgr.getActiveSessions().map((s: { id: string; topic: string; agents: Map<string, unknown>; messages: unknown[]; status: string; createdAt: Date }) => ({
      sessionId: s.id,
      topic: s.topic,
      agents: s.agents.size,
      messages: s.messages.length,
      status: s.status,
      createdAt: s.createdAt,
    }));
    return reply.send({ sessions });
  });

  // GET /api/v1/collaboration/sessions/:id — get session details
  app.get('/api/v1/collaboration/sessions/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const mgr = getCollaborationManager();
    const session = mgr.getSession(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return reply.send({
      sessionId: session.id,
      topic: session.topic,
      description: session.description,
      status: session.status,
      agents: mgr.getAgents(id),
      messages: mgr.getMessages(id),
      consensus: session.consensus,
      createdAt: session.createdAt,
    });
  });

  // POST /api/v1/collaboration/sessions/:id/join — join a session
  app.post('/api/v1/collaboration/sessions/:id/join', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { agentId, role, name } = req.body as { agentId: string; role: string; name: string };
    if (!agentId || !role) return reply.code(400).send({ error: 'agentId and role are required' });

    const mgr = getCollaborationManager();
    const joined = mgr.joinSession(id, { id: agentId, role, name: name ?? agentId, status: 'idle' });
    if (!joined) return reply.code(404).send({ error: 'Session not found or not active' });
    return reply.send({ joined: true, sessionId: id });
  });

  // POST /api/v1/collaboration/sessions/:id/messages — post a message
  app.post('/api/v1/collaboration/sessions/:id/messages', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { agentId, agentRole, content, type, replyTo } = req.body as {
      agentId: string;
      agentRole: string;
      content: string;
      type: string;
      replyTo?: string;
    };
    if (!agentId || !content) return reply.code(400).send({ error: 'agentId and content are required' });

    const mgr = getCollaborationManager();
    const msg = mgr.postMessage(id, agentId, agentRole ?? 'agent', content, type as Parameters<typeof mgr.postMessage>[4], replyTo);
    if (!msg) return reply.code(404).send({ error: 'Session not found or not active' });
    return reply.send(msg);
  });

  // GET /api/v1/collaboration/sessions/:id/messages — get messages
  app.get('/api/v1/collaboration/sessions/:id/messages', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const { sinceMs } = req.query as { sinceMs?: string };
    const mgr = getCollaborationManager();
    const messages = mgr.getMessages(id, sinceMs ? Number(sinceMs) : undefined);
    return reply.send({ messages });
  });

  // POST /api/v1/collaboration/sessions/:id/complete — complete session with consensus
  app.post('/api/v1/collaboration/sessions/:id/complete', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const { consensus } = req.body as { consensus?: string };
    const mgr = getCollaborationManager();
    const result = mgr.completeSession(id, consensus);
    if (!result) return reply.code(404).send({ error: 'Session not found' });
    return reply.send(result);
  });

  // GET /api/v1/collaboration/stats — global stats
  app.get('/api/v1/collaboration/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const mgr = getCollaborationManager();
    return reply.send(mgr.stats());
  });
};
