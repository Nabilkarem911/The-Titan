import type { FastifyRequest } from 'fastify';
import { buildHybridRateKey, getAbuseDetector } from '@titan/observability';

export type RateLimitBucket = 'global' | 'auth' | 'api' | 'workspace' | 'apikey';

export interface KeyOpts {
  bucket: RateLimitBucket;
  workspaceIdFromUrl?: (req: FastifyRequest) => string | undefined;
  resourceFromUrl?: (req: FastifyRequest) => string | undefined;
}

export function hybridKeyGenerator(opts: KeyOpts) {
  return (req: FastifyRequest): string => {
    const auth = (req as { auth?: { userId?: string; apiKeyId?: string; workspaceId?: string } }).auth;
    const userId = auth?.userId;
    const apiKeyId = auth?.apiKeyId;
    const workspaceId = auth?.workspaceId ?? (opts.workspaceIdFromUrl ? opts.workspaceIdFromUrl(req) : undefined);
    const resource = opts.resourceFromUrl ? opts.resourceFromUrl(req) : undefined;
    return buildHybridRateKey({
      bucket: opts.bucket,
      ip: req.ip,
      ...(userId ? { userId } : {}),
      ...(apiKeyId ? { apiKeyId } : {}),
      ...(workspaceId ? { workspaceId } : {}),
      ...(resource ? { resource } : {}),
    });
  };
}

export function tenantKeyFromUrlParam(param: string) {
  return (req: FastifyRequest): string | undefined => {
    const p = (req.params as Record<string, string> | undefined)?.[param];
    if (!p) return undefined;
    return p;
  };
}

export function recordRateLimitHit(req: FastifyRequest, bucket: RateLimitBucket): void {
  const auth = (req as { auth?: { userId?: string; apiKeyId?: string } }).auth;
  const subject = auth?.userId
    ? `u:${auth.userId}`
    : `ip:${req.ip ?? 'unknown'}`;
  const r = req as { routerPath?: string };
  getAbuseDetector().record({
    signal: 'rate_limit_hit',
    subject,
    metadata: { bucket, route: r.routerPath ?? req.url },
  });
}
