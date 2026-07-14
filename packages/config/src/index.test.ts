import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { loadConfig, resetConfigCache } from './index.js';

/**
 * Minimum env vars needed so loadConfig() succeeds in development mode.
 * All other vars fall back to schema defaults.
 */
const MINIMAL_DEV_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  HTTP_PORT: '3000',
  POSTGRES_PORT: '5432',
};

/**
 * A valid production env that passes every enforceInvariants() check.
 */
const VALID_PRODUCTION_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  JWT_SECRET:
    'production-secret-that-is-very-long-and-secure-and-is-at-least-sixty-four-characters-long-ok',
  API_KEY_ENCRYPTION_KEY: 'aabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccddaabbccdd',
  POSTGRES_PASSWORD: 'strong-production-password',
  REDIS_PASSWORD: 'strong-redis-password',
  CORS_ORIGIN: 'https://app.example.com',
  CORS_CREDENTIALS: 'false',
  WS_ALLOWED_ORIGINS: 'https://app.example.com',
  HTTP_CSP_ENABLED: 'true',
  LLM_API_KEY: 'sk-prod-key-for-llm',
};

describe('@titan/config', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    resetConfigCache();
  });

  afterEach(() => {
    process.env = savedEnv;
    resetConfigCache();
  });

  // ─── loadConfig() basics ───────────────────────────────────────────

  describe('loadConfig()', () => {
    it('returns valid config with defaults when env is minimal', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV);

      const cfg = loadConfig();

      expect(cfg.NODE_ENV).toBe('development');
      expect(cfg.HTTP_PORT).toBe(3000);
      expect(cfg.HTTP_HOST).toBe('0.0.0.0');
      expect(cfg.LOG_LEVEL).toBe('info');
      expect(cfg.SERVICE_NAME).toBe('titan-core');
      expect(cfg.SERVICE_VERSION).toBe('0.1.0');
      expect(cfg.POSTGRES_HOST).toBe('localhost');
      expect(cfg.POSTGRES_PORT).toBe(5432);
      expect(cfg.POSTGRES_DB).toBe('titan');
      expect(cfg.REDIS_HOST).toBe('localhost');
      expect(cfg.REDIS_PORT).toBe(6379);
      expect(cfg.JWT_ACCESS_TTL).toBe(900);
      expect(cfg.JWT_REFRESH_TTL).toBe(604_800);
      expect(cfg.QUEUE_DEFAULT_PRIORITY).toBe(5);
      expect(cfg.WS_PATH).toBe('/ws');
      expect(typeof cfg.CORS_ORIGIN).toBe('string');
      expect(typeof cfg.CORS_CREDENTIALS).toBe('boolean');
      expect(cfg.HTTP_CSP_ENABLED).toBe(true);
      expect(cfg.OTEL_ENABLED).toBe(false);
      expect(cfg.POSTGRES_LOG_QUERIES).toBe(false);
      expect(cfg.REDIS_TLS).toBe(false);
      expect(cfg.METRICS_ENABLED).toBe(true);
    });

    it('caches results — same object returned on consecutive calls', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV);

      const first = loadConfig();
      const second = loadConfig();

      expect(first).toBe(second);
    });

    it('returns a frozen object', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV);

      const cfg = loadConfig();

      expect(Object.isFrozen(cfg)).toBe(true);
    });

    it('throws on invalid env values', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, { HTTP_PORT: '-1' });

      expect(() => loadConfig()).toThrow('Invalid environment configuration');
    });

    it('throws on invalid NODE_ENV', () => {
      Object.assign(process.env, { NODE_ENV: 'invalid-env' });

      expect(() => loadConfig()).toThrow('Invalid environment configuration');
    });
  });

  // ─── resetConfigCache() ────────────────────────────────────────────

  describe('resetConfigCache()', () => {
    it('forces re-parse so updated env vars are picked up', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, { HTTP_PORT: '4000' });
      const first = loadConfig();
      expect(first.HTTP_PORT).toBe(4000);

      resetConfigCache();
      process.env.HTTP_PORT = '5000';

      const second = loadConfig();
      expect(second.HTTP_PORT).toBe(5000);
      expect(first).not.toBe(second);
    });
  });

  // ─── Type coercion ─────────────────────────────────────────────────

  describe('type coercion', () => {
    it('coerces string "3000" to number 3000 for HTTP_PORT', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, { HTTP_PORT: '3000' });

      const cfg = loadConfig();

      expect(cfg.HTTP_PORT).toBe(3000);
      expect(typeof cfg.HTTP_PORT).toBe('number');
    });

    it('coerces numeric string for POSTGRES_PORT', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, { POSTGRES_PORT: '5433' });

      const cfg = loadConfig();

      expect(cfg.POSTGRES_PORT).toBe(5433);
      expect(typeof cfg.POSTGRES_PORT).toBe('number');
    });

    it('coerces HTTP_BODY_LIMIT from string to number', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, { HTTP_BODY_LIMIT: '2097152' });

      const cfg = loadConfig();

      expect(cfg.HTTP_BODY_LIMIT).toBe(2_097_152);
      expect(typeof cfg.HTTP_BODY_LIMIT).toBe('number');
    });

    it('transforms boolean-like strings to actual booleans', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, {
        OTEL_ENABLED: 'true',
        POSTGRES_LOG_QUERIES: 'false',
        REDIS_TLS: 'true',
      });

      const cfg = loadConfig();

      expect(cfg.OTEL_ENABLED).toBe(true);
      expect(cfg.POSTGRES_LOG_QUERIES).toBe(false);
      expect(cfg.REDIS_TLS).toBe(true);
    });

    it('transforms HTTP_TRUST_PROXY string values correctly', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, { HTTP_TRUST_PROXY: 'true' });
      const cfg1 = loadConfig();
      expect(cfg1.HTTP_TRUST_PROXY).toBe(true);

      resetConfigCache();
      process.env.HTTP_TRUST_PROXY = 'false';
      const cfg2 = loadConfig();
      expect(cfg2.HTTP_TRUST_PROXY).toBe(false);

      resetConfigCache();
      process.env.HTTP_TRUST_PROXY = 'loopback';
      const cfg3 = loadConfig();
      expect(cfg3.HTTP_TRUST_PROXY).toBe('loopback');
    });
  });

  // ─── enforceInvariants() — CORS ────────────────────────────────────

  describe('enforceInvariants() — CORS', () => {
    it('throws for CORS_CREDENTIALS=true + CORS_ORIGIN=*', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, {
        CORS_CREDENTIALS: 'true',
        CORS_ORIGIN: '*',
      });

      expect(() => loadConfig()).toThrow(
        'CORS misconfiguration: CORS_CREDENTIALS=true is incompatible with CORS_ORIGIN=*',
      );
    });

    it('allows CORS_CREDENTIALS=true when CORS_ORIGIN is specific', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, {
        CORS_CREDENTIALS: 'true',
        CORS_ORIGIN: 'https://app.example.com',
      });

      const cfg = loadConfig();

      expect(cfg.CORS_CREDENTIALS).toBe(true);
      expect(cfg.CORS_ORIGIN).toBe('https://app.example.com');
    });

    it('allows CORS_CREDENTIALS=false with CORS_ORIGIN=*', () => {
      Object.assign(process.env, MINIMAL_DEV_ENV, {
        CORS_CREDENTIALS: 'false',
        CORS_ORIGIN: '*',
      });

      const cfg = loadConfig();

      expect(cfg.CORS_CREDENTIALS).toBe(false);
      expect(cfg.CORS_ORIGIN).toBe('*');
    });
  });

  // ─── enforceInvariants() — production checks ──────────────────────

  describe('enforceInvariants() — production', () => {
    it('throws with default JWT_SECRET in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        JWT_SECRET:
          'dev-only-secret-change-me-in-production-this-must-be-at-least-64-chars',
      });

      expect(() => loadConfig()).toThrow(
        'JWT_SECRET must be replaced from default in production',
      );
    });

    it('throws with default POSTGRES_PASSWORD in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        POSTGRES_PASSWORD: 'titan_dev_password_change_in_production',
      });

      expect(() => loadConfig()).toThrow(
        'POSTGRES_PASSWORD must be replaced from default in production',
      );
    });

    it('throws with empty REDIS_PASSWORD in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        REDIS_PASSWORD: '',
      });

      expect(() => loadConfig()).toThrow(
        'REDIS_PASSWORD must be set in production',
      );
    });

    it('throws with default API_KEY_ENCRYPTION_KEY (deadbeef) in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        API_KEY_ENCRYPTION_KEY:
          'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
      });

      expect(() => loadConfig()).toThrow(
        'API_KEY_ENCRYPTION_KEY must be replaced from default in production',
      );
    });

    it('throws with default API_KEY_ENCRYPTION_KEY (0123…) in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        API_KEY_ENCRYPTION_KEY:
          '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      });

      expect(() => loadConfig()).toThrow(
        'API_KEY_ENCRYPTION_KEY must be replaced from default in production',
      );
    });

    it('warns with empty WS_ALLOWED_ORIGINS in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        WS_ALLOWED_ORIGINS: '',
      });
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      loadConfig();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('WS_ALLOWED_ORIGINS should be a comma-separated allowlist'),
      );
      spy.mockRestore();
    });

    it('warns with WS_ALLOWED_ORIGINS=* in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        WS_ALLOWED_ORIGINS: '*',
      });
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      loadConfig();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('WS_ALLOWED_ORIGINS should be a comma-separated allowlist'),
      );
      spy.mockRestore();
    });

    it('warns with HTTP_CSP_ENABLED=false in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        HTTP_CSP_ENABLED: 'false',
      });
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      loadConfig();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('HTTP_CSP_ENABLED should be true'),
      );
      spy.mockRestore();
    });

    it('warns with empty LLM_API_KEY in production', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV, {
        LLM_API_KEY: '',
      });
      const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      loadConfig();

      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('LLM_API_KEY should be set'),
      );
      spy.mockRestore();
    });

    it('valid production config passes all invariants', () => {
      Object.assign(process.env, VALID_PRODUCTION_ENV);

      const cfg = loadConfig();

      expect(cfg.NODE_ENV).toBe('production');
      expect(cfg.JWT_SECRET).toBe(VALID_PRODUCTION_ENV.JWT_SECRET);
      expect(cfg.POSTGRES_PASSWORD).toBe('strong-production-password');
      expect(cfg.REDIS_PASSWORD).toBe('strong-redis-password');
      expect(cfg.CORS_ORIGIN).toBe('https://app.example.com');
      expect(cfg.WS_ALLOWED_ORIGINS).toBe('https://app.example.com');
      expect(cfg.HTTP_CSP_ENABLED).toBe(true);
      expect(cfg.LLM_API_KEY).toBe('sk-prod-key-for-llm');
    });
  });
});
