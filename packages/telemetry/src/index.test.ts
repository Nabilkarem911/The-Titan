import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @titan/config to return OTEL_ENABLED=false by default
vi.mock('@titan/config', () => {
  let _cfg = {
    NODE_ENV: 'test',
    SERVICE_NAME: 'titan-test',
    SERVICE_VERSION: '0.0.1',
    LOG_LEVEL: 'silent',
    OTEL_ENABLED: false,
    OTEL_SERVICE_NAME: 'titan-test',
    OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
  };
  return {
    loadConfig: vi.fn(() => _cfg),
    resetConfigCache: vi.fn(),
    __setOtelEnabled: (v: boolean) => { _cfg = { ..._cfg, OTEL_ENABLED: v }; },
  };
});

// Mock @titan/logging so getLogger().child() returns a silent stub
vi.mock('@titan/logging', () => {
  const noop = () => {};
  const logStub = {
    info: vi.fn(noop),
    warn: vi.fn(noop),
    error: vi.fn(noop),
    debug: vi.fn(noop),
    child: vi.fn(() => logStub),
  };
  return { getLogger: vi.fn(() => logStub) };
});

describe('@titan/telemetry', () => {
  beforeEach(() => {
    // Reset module registry so `initialized` flag resets between tests
    vi.resetModules();
  });

  describe('initTelemetry() with OTEL_ENABLED=false', () => {
    it('resolves without throwing', async () => {
      const { initTelemetry } = await import('./index.js');

      await expect(initTelemetry()).resolves.toBeUndefined();
    });

    it('is idempotent — second call returns immediately', async () => {
      const { initTelemetry } = await import('./index.js');

      await initTelemetry();
      // Second call should also resolve without error
      await expect(initTelemetry()).resolves.toBeUndefined();
    });
  });

  describe('initTelemetry() with OTEL_ENABLED=true but missing SDK', () => {
    it('resolves without throwing when OTEL packages are not installed', async () => {
      // Enable OTEL via the mock helper
      const config = await import('@titan/config');
      (config as unknown as { __setOtelEnabled: (v: boolean) => void }).__setOtelEnabled(true);

      const { initTelemetry } = await import('./index.js');

      // The dynamic import of @opentelemetry/* will fail (not installed in test),
      // so it should gracefully fall back to no-op and log a warning
      await expect(initTelemetry()).resolves.toBeUndefined();
    });
  });

  describe('shutdownTelemetry()', () => {
    it('resolves without throwing', async () => {
      const { shutdownTelemetry } = await import('./index.js');

      await expect(shutdownTelemetry()).resolves.toBeUndefined();
    });
  });

  describe('exported API surface', () => {
    it('exports initTelemetry and shutdownTelemetry as functions', async () => {
      const mod = await import('./index.js');

      expect(typeof mod.initTelemetry).toBe('function');
      expect(typeof mod.shutdownTelemetry).toBe('function');
    });
  });
});
