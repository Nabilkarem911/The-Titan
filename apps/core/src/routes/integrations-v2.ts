import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { requireAuth, requirePermission } from '../plugins/auth.js';
import { PERMISSIONS } from '@titan/shared';
import {
  A2AProtocolAdapter,
  SkillMdRegistry,
  BrowserAgent,
  WebIntelligence,
  createProviderFromEnv,
} from '@titan/agent-engine';

let a2aAdapter: A2AProtocolAdapter | null = null;
let skillMdRegistry: SkillMdRegistry | null = null;
let browserAgent: BrowserAgent | null = null;
let webIntelligence: WebIntelligence | null = null;

function getA2AAdapter(): A2AProtocolAdapter {
  if (a2aAdapter) return a2aAdapter;
  a2aAdapter = new A2AProtocolAdapter();
  return a2aAdapter;
}

function getSkillMdRegistry(): SkillMdRegistry {
  if (skillMdRegistry) return skillMdRegistry;
  skillMdRegistry = new SkillMdRegistry();
  return skillMdRegistry;
}

function getBrowserAgent(): BrowserAgent | null {
  if (browserAgent) return browserAgent;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  browserAgent = new BrowserAgent(llm);
  return browserAgent;
}

function getWebIntelligence(): WebIntelligence {
  if (webIntelligence) return webIntelligence;
  webIntelligence = new WebIntelligence();
  return webIntelligence;
}

export const integrationsRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // === A2A Protocol ===

  // POST /api/v1/a2a/register-self — register Titan as an A2A agent
  app.post('/api/v1/a2a/register-self', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { name, description, url, capabilities, authentication } = req.body as {
      name: string; description: string; url: string; capabilities: string[];
      authentication?: { type: 'none' | 'api_key' | 'oauth2' | 'bearer'; credentials?: string };
    };
    const adapter = getA2AAdapter();
    const card = adapter.registerSelf({ name, description, url, capabilities, authentication });
    return reply.send(card);
  });

  // POST /api/v1/a2a/agents — register an external agent
  app.post('/api/v1/a2a/agents', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const adapter = getA2AAdapter();
    adapter.registerAgent(req.body as any);
    return reply.send({ success: true });
  });

  // GET /api/v1/a2a/agents — list registered agents
  app.get('/api/v1/a2a/agents', { preHandler: [requireAuth] }, async (_req, reply) => {
    const adapter = getA2AAdapter();
    return reply.send({ agents: adapter.getRegisteredAgents() });
  });

  // GET /api/v1/a2a/agents/:capability — find agents by capability
  app.get('/api/v1/a2a/agents/cap/:capability', { preHandler: [requireAuth] }, async (req, reply) => {
    const { capability } = req.params as { capability: string };
    const adapter = getA2AAdapter();
    return reply.send({ agents: adapter.findAgentsByCapability(capability) });
  });

  // DELETE /api/v1/a2a/agents/:id — unregister an agent
  app.delete('/api/v1/a2a/agents/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const adapter = getA2AAdapter();
    const removed = adapter.unregisterAgent(id);
    return reply.send({ success: removed });
  });

  // POST /api/v1/a2a/tasks — send a task to an agent
  app.post('/api/v1/a2a/tasks', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { agentId, name, description, content, parts, metadata } = req.body as {
      agentId: string; name: string; description?: string; content: string;
      parts?: unknown[]; metadata?: Record<string, unknown>;
    };
    const adapter = getA2AAdapter();
    const task = adapter.sendTask(agentId, { name, description, content, parts: parts as any, metadata });
    return reply.send(task);
  });

  // GET /api/v1/a2a/tasks — list tasks
  app.get('/api/v1/a2a/tasks', { preHandler: [requireAuth] }, async (req, reply) => {
    const { agentId, state } = req.query as { agentId?: string; state?: string };
    const adapter = getA2AAdapter();
    return reply.send({ tasks: adapter.getTasks({ agentId, state: state as any }) });
  });

  // GET /api/v1/a2a/tasks/:id — get a task
  app.get('/api/v1/a2a/tasks/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const adapter = getA2AAdapter();
    const task = adapter.getTask(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return reply.send(task);
  });

  // POST /api/v1/a2a/tasks/:id/update — update task state
  app.post('/api/v1/a2a/tasks/:id/update', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const { state, content, parts, artifacts } = req.body as {
      state: string; content?: string; parts?: unknown[]; artifacts?: unknown[];
    };
    const adapter = getA2AAdapter();
    const task = adapter.updateTaskState(id, state as any, content ? { content, parts: parts as any, artifacts: artifacts as any } : undefined);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return reply.send(task);
  });

  // POST /api/v1/a2a/tasks/:id/cancel — cancel a task
  app.post('/api/v1/a2a/tasks/:id/cancel', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const adapter = getA2AAdapter();
    const task = adapter.cancelTask(id);
    if (!task) return reply.code(404).send({ error: 'Task not found' });
    return reply.send(task);
  });

  // GET /api/v1/a2a/stats — get A2A stats
  app.get('/api/v1/a2a/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const adapter = getA2AAdapter();
    return reply.send(adapter.stats());
  });

  // === SKILL.md Registry ===

  // POST /api/v1/skills-md/register-dir — register a skill directory
  app.post('/api/v1/skills-md/register-dir', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { dir } = req.body as { dir: string };
    const registry = getSkillMdRegistry();
    registry.registerDirectory(dir);
    return reply.send({ success: true, skills: registry.getAllSkills().map((s) => s.frontmatter.name) });
  });

  // GET /api/v1/skills-md — list all skills
  app.get('/api/v1/skills-md', { preHandler: [requireAuth] }, async (_req, reply) => {
    const registry = getSkillMdRegistry();
    return reply.send({ skills: registry.getAllSkills() });
  });

  // GET /api/v1/skills-md/:name — get a specific skill
  app.get('/api/v1/skills-md/:name', { preHandler: [requireAuth] }, async (req, reply) => {
    const { name } = req.params as { name: string };
    const registry = getSkillMdRegistry();
    const skill = registry.getSkill(name);
    if (!skill) return reply.code(404).send({ error: 'Skill not found' });
    return reply.send(skill);
  });

  // POST /api/v1/skills-md/match — match skills to a task
  app.post('/api/v1/skills-md/match', { preHandler: [requireAuth] }, async (req, reply) => {
    const { taskDescription, topK } = req.body as { taskDescription: string; topK?: number };
    const registry = getSkillMdRegistry();
    return reply.send({ matches: registry.matchSkills(taskDescription, topK) });
  });

  // POST /api/v1/skills-md/create — create a new skill
  app.post('/api/v1/skills-md/create', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { dir, frontmatter, body } = req.body as {
      dir: string;
      frontmatter: { name: string; description: string; license?: string; compatibility?: string; allowedTools?: string[] };
      body: string;
    };
    const registry = getSkillMdRegistry();
    const skill = registry.createSkill(dir, frontmatter, body);
    return reply.send(skill);
  });

  // POST /api/v1/skills-md/reload — reload all skills
  app.post('/api/v1/skills-md/reload', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const registry = getSkillMdRegistry();
    registry.reload();
    return reply.send({ success: true, count: registry.getAllSkills().length });
  });

  // GET /api/v1/skills-md/stats — get skill stats
  app.get('/api/v1/skills-md/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const registry = getSkillMdRegistry();
    return reply.send(registry.stats());
  });

  // === Browser Agent ===

  // POST /api/v1/browser/execute — execute a browser task
  app.post('/api/v1/browser/execute', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { task, startUrl } = req.body as { task: string; startUrl?: string };
    if (!task) return reply.code(400).send({ error: 'task is required' });
    const agent = getBrowserAgent();
    if (!agent) return reply.code(503).send({ error: 'No LLM provider available' });
    const result = await agent.executeTask(task, startUrl);
    return reply.send(result);
  });

  // GET /api/v1/browser/sessions — list active sessions
  app.get('/api/v1/browser/sessions', { preHandler: [requireAuth] }, async (_req, reply) => {
    const agent = getBrowserAgent();
    if (!agent) return reply.send({ sessions: [] });
    return reply.send({ sessions: agent.getActiveSessions() });
  });

  // GET /api/v1/browser/sessions/:id — get session details
  app.get('/api/v1/browser/sessions/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const agent = getBrowserAgent();
    if (!agent) return reply.code(503).send({ error: 'No LLM provider available' });
    const session = agent.getSession(id);
    if (!session) return reply.code(404).send({ error: 'Session not found' });
    return reply.send(session);
  });

  // POST /api/v1/browser/sessions/:id/close — close a session
  app.post('/api/v1/browser/sessions/:id/close', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { id } = req.params as { id: string };
    const agent = getBrowserAgent();
    if (!agent) return reply.code(503).send({ error: 'No LLM provider available' });
    const closed = agent.closeSession(id);
    return reply.send({ success: closed });
  });

  // GET /api/v1/browser/stats — get browser agent stats
  app.get('/api/v1/browser/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const agent = getBrowserAgent();
    if (!agent) return reply.send({ totalSessions: 0, activeSessions: 0, totalActions: 0, avgActionsPerSession: 0 });
    return reply.send(agent.stats());
  });

  // === Web Intelligence ===

  // POST /api/v1/web/search — search the web
  app.post('/api/v1/web/search', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { query, maxResults, source, timeRange } = req.body as {
      query: string; maxResults?: number; source?: string; timeRange?: string;
    };
    if (!query) return reply.code(400).send({ error: 'query is required' });
    const wi = getWebIntelligence();
    const results = await wi.search(query, { maxResults, source, timeRange: timeRange as any });
    return reply.send({ results });
  });

  // POST /api/v1/web/scrape — scrape a URL
  app.post('/api/v1/web/scrape', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { url, format, extractLinks, extractImages } = req.body as {
      url: string; format?: string; extractLinks?: boolean; extractImages?: boolean;
    };
    if (!url) return reply.code(400).send({ error: 'url is required' });
    const wi = getWebIntelligence();
    const result = await wi.scrape(url, { format: format as any, extractLinks, extractImages });
    return reply.send(result);
  });

  // POST /api/v1/web/crawl — crawl a website
  app.post('/api/v1/web/crawl', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { rootUrl, maxPages, maxDepth, sameDomainOnly } = req.body as {
      rootUrl: string; maxPages?: number; maxDepth?: number; sameDomainOnly?: boolean;
    };
    if (!rootUrl) return reply.code(400).send({ error: 'rootUrl is required' });
    const wi = getWebIntelligence();
    const result = await wi.crawl(rootUrl, { maxPages, maxDepth, sameDomainOnly });
    return reply.send(result);
  });

  // POST /api/v1/web/interact — interact with a web page
  app.post('/api/v1/web/interact', { preHandler: [requireAuth] }, async (req, reply) => {
    requirePermission(req.auth, PERMISSIONS.TOOL_EXECUTE);
    const { url, action, selector, value, extractData } = req.body as {
      url: string; action: string; selector?: string; value?: string; extractData?: boolean;
    };
    if (!url || !action) return reply.code(400).send({ error: 'url and action are required' });
    const wi = getWebIntelligence();
    const result = await wi.interact(url, action, { selector, value, extractData });
    return reply.send(result);
  });

  // GET /api/v1/web/stats — get web intelligence stats
  app.get('/api/v1/web/stats', { preHandler: [requireAuth] }, async (_req, reply) => {
    const wi = getWebIntelligence();
    return reply.send(wi.stats());
  });
};
