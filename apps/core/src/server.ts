import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import sensible from '@fastify/sensible';
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
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'none'"],
          formAction: ["'none'"],
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
    if (url.startsWith('/health/') || url === '/metrics' || url === '/metrics.json' || url === '/') return;
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

  app.setErrorHandler((err, req, reply) => {
    const requestId = req.requestId;
    if (err instanceof ZodError) {
      return reply.status(400).send({
        type: 'https://titan.local/problems/validation',
        title: 'Validation failed',
        status: 400,
        code: 'E2001',
        requestId,
        details: err.issues,
      });
    }
    if (err instanceof TitanError) {
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
    const fastifyErr = err as { validation?: unknown; statusCode?: number; message?: string };
    if (fastifyErr.validation) {
      return reply.status(400).send({
        type: 'https://titan.local/problems/validation',
        title: fastifyErr.message ?? 'Validation error',
        status: 400,
        code: 'E2001',
        requestId,
        details: fastifyErr.validation,
      });
    }
    if (fastifyErr.statusCode === 429) {
      return reply.status(429).send({
        type: 'https://titan.local/problems/rate-limit',
        title: 'Too many requests',
        status: 429,
        code: 'E4001',
        requestId,
      });
    }
    log.error({ err, requestId }, 'unhandled error');
    return reply.status(fastifyErr.statusCode ?? 500).send({
      type: 'https://titan.local/problems/internal',
      title: 'Internal server error',
      status: fastifyErr.statusCode ?? 500,
      code: 'E5001',
      requestId,
    });
  });

  app.setNotFoundHandler((req, reply) => {
    const url = req.url ?? '';
    if (url.startsWith('/api/') || url.startsWith('/health') || url.startsWith('/metrics') || url === '/ws') {
      return reply.status(404).send({
        type: 'https://titan.local/problems/not-found',
        title: 'Not found',
        status: 404,
        code: 'E3001',
        requestId: req.requestId,
        details: { method: req.method, url: req.url },
      });
    }
    return reply.status(404).send({
      type: 'https://titan.local/problems/not-found',
      title: 'Not found',
      status: 404,
      code: 'E3001',
      requestId: req.requestId,
      details: { method: req.method, url: req.url },
    });
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
    app.setNotFoundHandler((_req, reply) => {
      reply.type('text/html').send(indexHtml);
    });
    log.info({ dashboardDist }, 'serving dashboard static files');
  } else {
    app.get('/', async () => ({
      name: cfg.SERVICE_NAME,
      version: cfg.SERVICE_VERSION,
      env: cfg.NODE_ENV,
      endpoints: {
        health: '/health/live',
        ready: '/health/ready',
        api: '/api/v1',
        ws: cfg.WS_PATH,
      },
      timestamp: new Date().toISOString(),
    }));
  }

  return app;
}
