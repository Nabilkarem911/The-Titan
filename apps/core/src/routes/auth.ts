import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  RegisterInputSchema,
  LoginInputSchema,
  RefreshInputSchema,
} from '@titan/shared';
import {
  registerUser,
  loginUser,
  refreshTokens,
  logout,
  logoutAllForUser,
} from '@titan/auth';
import { audit } from '@titan/database';
import { AUDIT_ACTIONS } from '@titan/shared';
import { loadConfig } from '@titan/config';
import { requireAuth } from '../plugins/auth.js';
import { recordAuthFailureHybrid, recordBruteForcePattern, incCounter } from '@titan/observability';
import { AnomalyDetector } from '@titan/shared';

declare module 'fastify' {
  interface FastifyInstance {
    hybridKeyForBucket?: (bucket: 'auth' | 'api') => (req: import('fastify').FastifyRequest) => string;
  }
}

const buildAuthKey = (app: FastifyInstance) => (req: import('fastify').FastifyRequest): string => {
  return app.hybridKeyForBucket ? app.hybridKeyForBucket('auth')(req) : req.ip ?? 'anon';
};

const onAuthRateLimit = (req: import('fastify').FastifyRequest) => {
  recordAuthFailureHybrid({ ip: req.ip });
  incCounter('rate_limit_blocked_total', 'Requests blocked by rate limit', 1, { bucket: 'auth' });
};

const RATE_LIMIT_AUTH = (app: FastifyInstance) => ({
  config: {
    rateLimit: {
      max: 60,
      timeWindow: '1 minute' as const,
      keyGenerator: buildAuthKey(app),
      onExceeded: onAuthRateLimit,
    },
  },
});

const RATE_LIMIT_REFRESH = (app: FastifyInstance) => ({
  config: {
    rateLimit: {
      max: 60,
      timeWindow: '1 minute' as const,
      keyGenerator: buildAuthKey(app),
      onExceeded: onAuthRateLimit,
    },
  },
});

const loginFailureByIp = new Map<string, { count: number; firstAt: number }>();
const BRUTE_FORCE_WINDOW_MS = 5 * 60_000;
const BRUTE_FORCE_TRIGGER = 5;
const anomalyDetector = new AnomalyDetector();

function recordLoginFailure(ip: string): number {
  const now = Date.now();
  const cur = loginFailureByIp.get(ip);
  if (!cur || now - cur.firstAt > BRUTE_FORCE_WINDOW_MS) {
    const next = { count: 1, firstAt: now };
    loginFailureByIp.set(ip, next);
    return 1;
  }
  cur.count += 1;
  return cur.count;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of loginFailureByIp.entries()) {
    if (now - v.firstAt > BRUTE_FORCE_WINDOW_MS) loginFailureByIp.delete(k);
  }
}, 60_000).unref();

export const authRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  app.post('/api/v1/auth/register', RATE_LIMIT_AUTH(app), async (req, reply) => {
    const input = RegisterInputSchema.parse(req.body);
    const result = await registerUser(input);
    const userAgentHeader = req.headers['user-agent'];
    await audit.write({
      actorId: result.user.id,
      workspaceId: null,
      action: AUDIT_ACTIONS.USER_CREATED,
      resource: 'user',
      resourceId: result.user.id,
      metadata: { email: result.user.email },
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(typeof userAgentHeader === 'string' ? { userAgent: userAgentHeader } : {}),
    });
    await audit.writeChained({
      actorId: result.user.id,
      action: AUDIT_ACTIONS.USER_CREATED,
      resource: 'user',
      resourceId: result.user.id,
      metadata: { email: result.user.email, event: 'register' },
    });
    return reply.status(201).send({ user: result.user, ...result.tokens });
  });

  app.post('/api/v1/auth/login', RATE_LIMIT_AUTH(app), async (req, reply) => {
    const input = LoginInputSchema.parse(req.body);
    const userAgentHeader = req.headers['user-agent'];
    try {
      const result = await loginUser({
        ...input,
        ...(req.ip ? { ipAddress: req.ip } : {}),
        ...(typeof userAgentHeader === 'string' ? { userAgent: userAgentHeader } : {}),
      });
      const ip = req.ip ?? 'unknown';
      loginFailureByIp.delete(ip);
      await audit.write({
        actorId: result.user.id,
        workspaceId: null,
        action: AUDIT_ACTIONS.USER_LOGIN,
        resource: 'user',
        resourceId: result.user.id,
        metadata: { email: result.user.email },
        ...(req.ip ? { ipAddress: req.ip } : {}),
        ...(typeof userAgentHeader === 'string' ? { userAgent: userAgentHeader } : {}),
      });
      await audit.writeChained({
        actorId: result.user.id,
        action: AUDIT_ACTIONS.USER_LOGIN,
        resource: 'user',
        resourceId: result.user.id,
        metadata: { email: result.user.email, event: 'login' },
      });
      return reply.send({ user: result.user, ...result.tokens });
    } catch (err) {
      const ip = req.ip ?? 'unknown';
      const subject = `ip:${ip}`;
      const count = recordLoginFailure(ip);
      recordAuthFailureHybrid({ ip });
      const anomaly = anomalyDetector.trackFailedAuth(ip);
      if (anomaly) {
        await audit.write({
          actorId: null,
          workspaceId: null,
          action: AUDIT_ACTIONS.UNAUTHORIZED_ACCESS,
          resource: 'auth',
          resourceId: ip,
          metadata: { anomaly: anomaly.type, severity: anomaly.severity, description: anomaly.description },
          ...(req.ip ? { ipAddress: req.ip } : {}),
        });
      }
      if (count >= BRUTE_FORCE_TRIGGER) {
        recordBruteForcePattern(subject, count);
      }
      throw err;
    }
  });

  app.post('/api/v1/auth/refresh', RATE_LIMIT_REFRESH(app), async (req, reply) => {
    const input = RefreshInputSchema.parse(req.body);
    const cfg = loadConfig();
    const userAgentHeader = req.headers['user-agent'];
    const tokens = await refreshTokens(input.refreshToken, {
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(typeof userAgentHeader === 'string' ? { userAgent: userAgentHeader } : {}),
    });
    return reply.send({
      ...tokens,
      expiresIn: cfg.JWT_ACCESS_TTL,
    });
  });

  app.post('/api/v1/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.auth?.sessionId) {
      return reply.status(400).send({ code: 'E2001', message: 'No session' });
    }
    await logout(req.auth.sessionId);
    return reply.status(204).send();
  });

  app.post('/api/v1/auth/logout-all', { preHandler: requireAuth }, async (req, reply) => {
    if (!req.auth?.userId) {
      return reply.status(400).send({ code: 'E2001', message: 'No session' });
    }
    await logoutAllForUser(req.auth.userId);
    return reply.status(204).send();
  });

  app.get('/api/v1/auth/me', { preHandler: requireAuth }, async (req) => {
    return {
      userId: req.auth!.userId,
      sessionId: req.auth?.sessionId ?? null,
      permissions: req.auth!.permissions,
    };
  });
};
