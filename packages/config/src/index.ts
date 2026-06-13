import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  SERVICE_NAME: z.string().min(1).default('titan-core'),
  SERVICE_VERSION: z.string().min(1).default('0.1.0'),

  HTTP_HOST: z.string().default('0.0.0.0'),
  HTTP_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  HTTP_BODY_LIMIT: z.coerce.number().int().positive().default(10_485_760),
  HTTP_REQUEST_TIMEOUT: z.coerce.number().int().positive().default(30_000),
  HTTP_TRUST_PROXY: z
    .union([z.literal('true'), z.literal('false'), z.literal('loopback'), z.string()])
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : v))
    .default('false'),
  HTTP_CSP_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),

  JWT_SECRET: z
    .string()
    .min(64, 'JWT_SECRET must be at least 64 characters')
    .default('dev-only-secret-change-me-in-production-this-must-be-at-least-64-chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(604_800),
  JWT_ISSUER: z.string().default('titan'),
  JWT_AUDIENCE: z.string().default('titan-api'),

  API_KEY_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/i, 'API_KEY_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
    .default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),

  POSTGRES_HOST: z.string().default('localhost'),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().default('titan'),
  POSTGRES_USER: z.string().default('titan'),
  POSTGRES_PASSWORD: z.string().default('titan_dev_password_change_in_production'),
  POSTGRES_POOL_MIN: z.coerce.number().int().min(0).default(2),
  POSTGRES_POOL_MAX: z.coerce.number().int().positive().default(20),
  POSTGRES_STATEMENT_TIMEOUT: z.coerce.number().int().positive().default(30_000),
  POSTGRES_LOG_QUERIES: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_PASSWORD: z.string().default(''),
  REDIS_DB: z.coerce.number().int().min(0).default(0),
  REDIS_KEY_PREFIX: z.string().default('titan:'),
  REDIS_TLS: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  REDIS_CLUSTER: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),

  QUEUE_DEFAULT_PRIORITY: z.coerce.number().int().min(1).max(10).default(5),
  QUEUE_REMOVE_ON_COMPLETE: z.coerce.number().int().nonnegative().default(1_000),
  QUEUE_REMOVE_ON_FAIL: z.coerce.number().int().nonnegative().default(5_000),
  QUEUE_ATTEMPTS_DEFAULT: z.coerce.number().int().positive().default(3),
  QUEUE_BACKOFF_MS: z.coerce.number().int().nonnegative().default(2_000),

  WS_PATH: z.string().default('/ws'),
  WS_PING_INTERVAL: z.coerce.number().int().positive().default(30_000),
  WS_PING_TIMEOUT: z.coerce.number().int().positive().default(10_000),
  WS_MAX_PAYLOAD: z.coerce.number().int().positive().default(10_485_760),
  WS_MAX_CONNECTIONS_PER_USER: z.coerce.number().int().positive().default(10),
  WS_MAX_CONNECTIONS_PER_IP: z.coerce.number().int().positive().default(50),
  WS_MAX_MESSAGES_PER_SECOND: z.coerce.number().int().positive().default(30),
  WS_BACKPRESSURE_THRESHOLD: z.coerce.number().int().positive().default(100),
  WS_ABUSE_DETECTION_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  WS_RECONNECT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  WS_MAX_RECONNECTS_PER_WINDOW: z.coerce.number().int().positive().default(20),
  WS_ALLOWED_ORIGINS: z.string().default(''),

  RATE_LIMIT_GLOBAL_PER_MIN: z.coerce.number().int().positive().default(1_000),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(50),
  RATE_LIMIT_API_PER_MIN: z.coerce.number().int().positive().default(100),

  OTEL_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  OTEL_SERVICE_NAME: z.string().default('titan-core'),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().default('http://localhost:4318'),
  OTEL_TRACES_SAMPLER: z.string().default('parentbased_always_on'),
  OTEL_LOG_LEVEL: z.enum(['none', 'error', 'warn', 'info', 'debug']).default('error'),

  CORS_ORIGIN: z.string().default('*'),
  CORS_CREDENTIALS: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),

  VAULT_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  VAULT_ADDR: z.string().default('http://localhost:8200'),
  VAULT_TOKEN: z.string().default(''),
  VAULT_SECRET_PATH: z.string().default('secret/data/titan'),

  POSTGRES_TLS: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('false'),
  POSTGRES_TLS_REJECT_UNAUTHORIZED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  POSTGRES_SLOW_QUERY_MS: z.coerce.number().int().positive().default(500),

  QUEUE_DLQ_SUFFIX: z.string().default('-dlq'),
  QUEUE_POISON_THRESHOLD: z.coerce.number().int().positive().default(5),
  QUEUE_ENQUEUE_RATE_PER_MIN: z.coerce.number().int().positive().default(600),

  AUDIT_RETENTION_DAYS: z.coerce.number().int().positive().default(365),
  AUDIT_HASH_CHAIN_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
  AUDIT_ARCHIVE_BATCH_SIZE: z.coerce.number().int().positive().default(1000),

  ABUSE_WINDOW_MS: z.coerce.number().int().positive().default(300_000),
  ABUSE_THRESHOLD_HIGH: z.coerce.number().int().positive().default(20),
  ABUSE_THRESHOLD_MEDIUM: z.coerce.number().int().positive().default(10),

  METRICS_ENABLED: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .default('true'),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

function loadDotEnvFile(): void {
  const envPath = resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      let trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      // Strip inline comments (only if preceded by whitespace)
      const hashIdx = trimmed.indexOf(' #');
      if (hashIdx >= 0) trimmed = trimmed.slice(0, hashIdx).trim();
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  }
}

export function loadConfig(): Env {
  if (cached) return cached;
  loadDotEnvFile();
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = Object.freeze(parsed.data);
  enforceInvariants(cached);
  return cached;
}

function enforceInvariants(cfg: Env): void {
  if (cfg.CORS_CREDENTIALS && cfg.CORS_ORIGIN === '*') {
    throw new Error(
      'CORS misconfiguration: CORS_CREDENTIALS=true is incompatible with CORS_ORIGIN=*. ' +
        'Set CORS_ORIGIN to a comma-separated list of allowed origins.',
    );
  }
  if (cfg.NODE_ENV === 'production') {
    if (cfg.JWT_SECRET.startsWith('dev-only-')) {
      throw new Error('JWT_SECRET must be replaced from default in production');
    }
    if (cfg.API_KEY_ENCRYPTION_KEY === '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef') {
      throw new Error('API_KEY_ENCRYPTION_KEY must be replaced from default in production');
    }
    if (cfg.POSTGRES_PASSWORD === 'titan_dev_password_change_in_production') {
      throw new Error('POSTGRES_PASSWORD must be replaced from default in production');
    }
    if (cfg.REDIS_PASSWORD === '') {
      throw new Error('REDIS_PASSWORD must be set in production');
    }
    if (!cfg.POSTGRES_TLS) {
      throw new Error('POSTGRES_TLS must be true in production');
    }
    if (!cfg.REDIS_TLS) {
      throw new Error('REDIS_TLS must be true in production');
    }
    if (cfg.WS_ALLOWED_ORIGINS === '' || cfg.WS_ALLOWED_ORIGINS === '*') {
      throw new Error('WS_ALLOWED_ORIGINS must be a comma-separated allowlist in production');
    }
    if (!cfg.HTTP_CSP_ENABLED) {
      throw new Error('HTTP_CSP_ENABLED must be true in production');
    }
    if (cfg.HTTP_TRUST_PROXY === true) {
      throw new Error('HTTP_TRUST_PROXY=true is unsafe; use a specific subnet or false in production');
    }
  }
}

export function resetConfigCache(): void {
  cached = null;
}
