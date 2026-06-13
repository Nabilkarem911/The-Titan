import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import {
  resolveAuthFromAccessToken,
  resolveAuthFromApiKey,
  hasPermission,
  type AuthContext,
} from '@titan/auth';
import { UnauthorizedError, type Permission } from '@titan/shared';

export { canAssignRole, isValidRole } from '@titan/auth';

declare module 'fastify' {
  interface FastifyRequest {
    auth?: AuthContext;
  }
}

export const authPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('auth', undefined);
};

export async function requireAuth(req: FastifyRequest): Promise<void> {
  const apiKeyHeader = req.headers['x-api-key'];
  const apiKey = Array.isArray(apiKeyHeader) ? apiKeyHeader[0] : apiKeyHeader;
  if (apiKey) {
    const ctx = await resolveAuthFromApiKey(apiKey);
    req.auth = ctx;
    return;
  }
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing or malformed Authorization header');
  }
  const token = header.slice('Bearer '.length).trim();
  const ctx = await resolveAuthFromAccessToken(token);
  req.auth = ctx;
}

export async function requireApiKeyAuth(req: FastifyRequest): Promise<void> {
  const header = req.headers['x-api-key'];
  const key = Array.isArray(header) ? header[0] : header;
  if (!key) throw new UnauthorizedError('Missing X-API-Key header');
  const ctx = await resolveAuthFromApiKey(key);
  req.auth = ctx;
}

export function requirePermission(ctx: AuthContext | undefined, permission: Permission): void {
  if (!ctx) {
    throw new UnauthorizedError('Not authenticated');
  }
  if (!hasPermission(ctx.permissions as readonly Permission[], permission)) {
    throw new UnauthorizedError(`Insufficient permissions: ${permission}`);
  }
}
