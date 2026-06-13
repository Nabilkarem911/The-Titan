import { pino, type Logger as PinoLogger, type LoggerOptions } from 'pino';
import { loadConfig } from '@titan/config';
import { getLogContext } from './context.js';

export type { LogContext } from './context.js';

let rootLogger: PinoLogger | null = null;

function buildOptions(): LoggerOptions {
  const cfg = loadConfig();
  const isDev = cfg.NODE_ENV === 'development';
  return {
    name: cfg.SERVICE_NAME,
    level: cfg.LOG_LEVEL,
    base: {
      service: cfg.SERVICE_NAME,
      version: cfg.SERVICE_VERSION,
      env: cfg.NODE_ENV,
      pid: process.pid,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    mixin() {
      const ctx = getLogContext();
      return ctx ?? {};
    },
    ...(isDev
      ? {
          transport: {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'SYS:HH:MM:ss.l',
              ignore: 'pid,hostname,service,version,env',
              singleLine: false,
            },
          },
        }
      : {}),
  };
}

export function getLogger(): PinoLogger {
  if (!rootLogger) {
    rootLogger = pino(buildOptions());
  }
  return rootLogger;
}

export function child(bindings: Record<string, unknown>): PinoLogger {
  return getLogger().child(bindings);
}

export type Logger = PinoLogger;

export async function shutdownLogger(): Promise<void> {
  if (rootLogger) {
    await new Promise<void>((resolve) => rootLogger!.flush(() => resolve()));
  }
}
