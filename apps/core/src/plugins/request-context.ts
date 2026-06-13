import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { getLogger, runWithLogContext } from '@titan/logging';
import { randomUUID } from 'node:crypto';

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
    traceId?: string;
    spanId?: string;
  }
}

const REQUEST_ID_HEADER = 'x-request-id';
const TRACEPARENT_HEADER = 'traceparent';

interface TraceparentParts {
  version: string;
  traceId: string;
  parentSpanId: string;
  flags: string;
}

function parseTraceparent(value: string | undefined): TraceparentParts | null {
  if (!value) return null;
  const parts = value.trim().split('-');
  if (parts.length !== 4) return null;
  const [version, traceId, parentSpanId, flags] = parts;
  if (version !== '00') return null;
  if (!/^[0-9a-f]{32}$/i.test(traceId)) return null;
  if (!/^[0-9a-f]{16}$/i.test(parentSpanId)) return null;
  if (!/^[0-9a-f]{2}$/i.test(flags)) return null;
  return { version, traceId, parentSpanId, flags };
}

function genTraceId(): string {
  return randomUUID().replace(/-/g, '');
}

function genSpanId(): string {
  const buf = randomUUID().replace(/-/g, '').slice(0, 16);
  return buf.padEnd(16, '0');
}

export const requestContextPlugin: FastifyPluginAsync = async (app) => {
  const log = getLogger().child({ component: 'http' });

  app.addHook('onRequest', (req, reply, done) => {
    const incomingId = req.headers[REQUEST_ID_HEADER];
    const requestId = (typeof incomingId === 'string' && incomingId.length > 0) ? incomingId : randomUUID();
    const incomingTp = req.headers[TRACEPARENT_HEADER];
    const tp = parseTraceparent(typeof incomingTp === 'string' ? incomingTp : undefined);
    const traceId = tp ? tp.traceId : genTraceId();
    const spanId = genSpanId();
    req.requestId = requestId;
    req.traceId = traceId;
    req.spanId = spanId;
    reply.header(REQUEST_ID_HEADER, requestId);
    if (!tp) {
      const flags = '01';
      const traceparent = `00-${traceId}-${spanId}-${flags}`;
      reply.header(TRACEPARENT_HEADER, traceparent);
    }
    runWithLogContext({ requestId, traceId, spanId }, () => done());
  });

  app.addHook('onResponse', (req, reply, done) => {
    log.info(
      {
        requestId: req.requestId,
        traceId: req.traceId,
        spanId: req.spanId,
        method: req.method,
        url: req.url,
        status: reply.statusCode,
        durationMs: reply.elapsedTime?.toFixed(1),
        ip: req.ip,
      },
      'http request',
    );
    done();
  });
};

export function getRequestId(req: FastifyRequest): string {
  return req.requestId;
}
