import Fastify, { type FastifyInstance, type FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
import multipart from '@fastify/multipart';
import staticFiles from '@fastify/static';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { TitanError, InsufficientPermissionsError } from '@titan/shared';
import { ZodError } from 'zod';
import { requestContextPlugin } from './plugins/request-context.js';
import { authPlugin } from './plugins/auth.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { workspaceRoutes } from './routes/workspaces.js';
import { apiKeyRoutes } from './routes/api-keys.js';
import { metricsRoutes } from './routes/metrics.js';
import { agentRoutes } from './routes/agents.js';
import { swarmRoutes } from './routes/swarm.js';
import { pluginRoutes } from './routes/plugins.js';
import { complianceRoutes } from './routes/compliance.js';
import { cronRoutes } from './routes/cron.js';
import { webhookRoutes } from './routes/webhooks.js';
import { chatRoutes } from './routes/chat.js';
import { agentProfileRoutes } from './routes/agent-profiles.js';
import { registerTelegramRoutes } from './routes/telegram.js';
import { fileRoutes } from './routes/files.js';
import { userKeyRoutes } from './routes/user-keys.js';
import { terminalRoutes } from './routes/terminal.js';
import { gitRoutes } from './routes/git.js';
import { userContextRoutes } from './routes/user-context.js';
import { voiceRoutes } from './routes/voice.js';
import { knowledgeRoutes } from './routes/knowledge.js';
import { hybridKeyGenerator, recordRateLimitHit } from './plugins/hybrid-rate-limit.js';
import { getAbuseDetector, incCounter } from '@titan/observability';

export async function buildServer(): Promise<FastifyInstance> {
  const cfg = loadConfig();
  const log = getLogger().child({ component: 'server' });
  const abuse = getAbuseDetector();

  const app = Fastify({
    logger: false,
    bodyLimit: cfg.HTTP_BODY_LIMIT,
    requestTimeout: cfg.HTTP_REQUEST_TIMEOUT,
    trustProxy: cfg.HTTP_TRUST_PROXY,
    disableRequestLogging: true,
    genReqId: (req) => {
      const incoming = req.headers['x-request-id'];
      if (typeof incoming === 'string' && incoming.length > 0) return incoming;
      return randomUUID();
    },
  });

  const helmetOptions = {
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' as const },
    crossOriginResourcePolicy: { policy: 'same-site' as const },
    referrerPolicy: { policy: 'no-referrer' as const },
  };
  if (cfg.HTTP_CSP_ENABLED) {
    await app.register(helmet, {
      ...helmetOptions,
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-eval'", 'blob:'],
          workerSrc: ["'self'", 'blob:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          fontSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'wss:', 'ws:', 'https:'],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
        },
      },
    });
  } else {
    await app.register(helmet, { ...helmetOptions, contentSecurityPolicy: false });
  }
  await app.register(cors, {
    origin: cfg.CORS_ORIGIN === '*' ? false : cfg.CORS_ORIGIN.split(',').map((o) => o.trim()).filter(Boolean),
    credentials: cfg.CORS_CREDENTIALS,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Request-Id'],
  });
  await app.register(sensible);
  await app.register(multipart, { limits: { fileSize: 50 * 1024 * 1024 } });

  const globalHybridKey = hybridKeyGenerator({ bucket: 'global' });
  const authHybridKey = hybridKeyGenerator({ bucket: 'auth' });
  const apiHybridKey = hybridKeyGenerator({ bucket: 'api' });

  await app.register(rateLimit, {
    global: false,
    max: cfg.RATE_LIMIT_GLOBAL_PER_MIN,
    timeWindow: '1 minute',
    keyGenerator: (req) => globalHybridKey(req),
    onExceeded: (req) => {
      recordRateLimitHit(req, 'global');
      incCounter('rate_limit_blocked_total', 'Requests blocked by rate limit', 1, { bucket: 'global' });
    },
  });

  app.decorate('hybridKeyForBucket', (bucket: 'auth' | 'api') => {
    if (bucket === 'auth') return authHybridKey;
    return apiHybridKey;
  });

  app.addHook('onRequest', async (req) => {
    const url = req.url ?? '';
    if (
      url.startsWith('/health/') ||
      url === '/metrics' ||
      url === '/metrics.json' ||
      url === '/' ||
      url.startsWith('/assets/') ||
      url === '/favicon.ico' ||
      url.endsWith('.js') ||
      url.endsWith('.css') ||
      url.endsWith('.svg') ||
      url.endsWith('.png') ||
      url.endsWith('.ico') ||
      url.endsWith('.woff') ||
      url.endsWith('.woff2')
    ) return;
    const ip = req.ip ?? 'unknown';
    const auth = (req as { auth?: { userId?: string } }).auth;
    const subject = auth?.userId ? `u:${auth.userId}` : `ip:${ip}`;
    if (abuse.isBlocked(subject)) {
      incCounter('abuse_blocked_total', 'Requests blocked by abuse detector', 1, { subject: subject.startsWith('u:') ? 'user' : 'ip' });
      throw new InsufficientPermissionsError('Subject is blocked by abuse detector');
    }
  });

  await app.register(requestContextPlugin);
  await app.register(authPlugin);

  function sendZodError(reply: FastifyReply, err: ZodError, requestId: string) {
    return reply.status(400).send({
      type: 'https://titan.local/problems/validation',
      title: 'Validation failed',
      status: 400,
      code: 'E2001',
      requestId,
      details: err.issues,
    });
  }

  function sendTitanError(reply: FastifyReply, err: TitanError, requestId: string) {
    log.warn({ err, requestId, code: err.code }, 'titan error');
    return reply.status(err.statusCode).send({
      type: `https://titan.local/problems/${err.code.toLowerCase()}`,
      title: err.message,
      status: err.statusCode,
      code: err.code,
      requestId,
      ...(err.details !== undefined ? { details: err.details } : {}),
    });
  }

  function sendValidationError(reply: FastifyReply, err: { message?: string; validation?: unknown }, requestId: string) {
    return reply.status(400).send({
      type: 'https://titan.local/problems/validation',
      title: err.message ?? 'Validation error',
      status: 400,
      code: 'E2001',
      requestId,
      details: err.validation,
    });
  }

  function sendRateLimitError(reply: FastifyReply, requestId: string) {
    return reply.status(429).send({
      type: 'https://titan.local/problems/rate-limit',
      title: 'Too many requests',
      status: 429,
      code: 'E4001',
      requestId,
    });
  }

  function sendInternalError(reply: FastifyReply, err: unknown, requestId: string, statusCode?: number) {
    log.error({ err, requestId }, 'unhandled error');
    return reply.status(statusCode ?? 500).send({
      type: 'https://titan.local/problems/internal',
      title: 'Internal server error',
      status: statusCode ?? 500,
      code: 'E5000',
      requestId,
    });
  }

  app.setErrorHandler((err, req, reply) => {
    const requestId = req.requestId;
    if (err instanceof ZodError) return sendZodError(reply, err, requestId);
    if (err instanceof TitanError) return sendTitanError(reply, err, requestId);
    const fastifyErr = err as { validation?: unknown; statusCode?: number; message?: string };
    if (fastifyErr.validation) return sendValidationError(reply, fastifyErr, requestId);
    if (fastifyErr.statusCode === 429) return sendRateLimitError(reply, requestId);
    return sendInternalError(reply, err, requestId, fastifyErr.statusCode);
  });


  await app.register(healthRoutes);
  await app.register(metricsRoutes);
  await app.register(authRoutes);
  await app.register(workspaceRoutes);
  await app.register(apiKeyRoutes);
  await app.register(agentRoutes);
  await app.register(swarmRoutes);
  await app.register(pluginRoutes);
  await app.register(complianceRoutes);
  await app.register(cronRoutes);
  await app.register(webhookRoutes);
  await app.register(chatRoutes);
  await app.register(agentProfileRoutes);
  await app.register(fileRoutes);
  await app.register(userKeyRoutes);
  await app.register(terminalRoutes);
  await app.register(gitRoutes);
  await app.register(userContextRoutes);
  await app.register(voiceRoutes);
  await app.register(knowledgeRoutes);
  await registerTelegramRoutes(app);

  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dashboardDist = resolve(__dirname, '..', '..', '..', 'apps', 'dashboard', 'dist');
  const dashboardExists = existsSync(dashboardDist);

  if (dashboardExists) {
    await app.register(staticFiles, {
      root: dashboardDist,
      prefix: '/',
      decorateReply: false,
      index: 'index.html',
    });
    const indexHtml = readFileSync(join(dashboardDist, 'index.html'), 'utf-8');
    app.setNotFoundHandler((req, reply) => {
      const url = req.url ?? '';
      if (url.startsWith('/api/') || url.startsWith('/health') || url.startsWith('/metrics') || url === '/ws') {
        return reply.status(404).send({
          type: 'https://titan.local/problems/not-found',
          title: 'Not found',
          status: 404,
          code: 'E3001',
          requestId: req.requestId,
          details: { method: req.method, url },
        });
      }
      return reply.type('text/html').send(indexHtml);
    });
    log.info({ dashboardDist }, 'serving dashboard static files');
  } else {
    app.get('/', async () => ({
      name: cfg.SERVICE_NAME,
      version: cfg.SERVICE_VERSION,
      env: cfg.NODE_ENV,
      endpoints: {
        health: '/api/v1/health/live',
        ready: '/api/v1/health/ready',
        api: '/api/v1',
        ws: cfg.WS_PATH,
      },
      timestamp: new Date().toISOString(),
    }));
    app.setNotFoundHandler((req, reply) => {
      reply.status(404).send({
        type: 'https://titan.local/problems/not-found',
        title: 'Not found',
        status: 404,
        code: 'E3001',
        requestId: req.requestId,
        details: { method: req.method, url: req.url },
      });
    });
  }

  return app;
}
