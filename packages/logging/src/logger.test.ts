import { describe, it, expect, vi } from 'vitest';

vi.mock('@titan/config', () => ({
  loadConfig: vi.fn(() => ({
    NODE_ENV: 'test',
    SERVICE_NAME: 'titan-test',
    SERVICE_VERSION: '0.0.1',
    LOG_LEVEL: 'silent',
  })),
}));

// Import after mock so the mock is in place when modules initialize.
const { getLogger, child, shutdownLogger } = await import('./logger.js');

describe('getLogger()', () => {
  it('returns a pino logger instance', () => {
    const log = getLogger();

    expect(log).toBeDefined();
    expect(typeof log.info).toBe('function');
    expect(typeof log.error).toBe('function');
    expect(typeof log.warn).toBe('function');
    expect(typeof log.debug).toBe('function');
    expect(typeof log.trace).toBe('function');
    expect(typeof log.fatal).toBe('function');
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    const first = getLogger();
    const second = getLogger();

    expect(first).toBe(second);
  });

  it('has the correct log level from config', () => {
    const log = getLogger();

    // pino uses 'silent' level when set — the level string matches what config provides
    expect(log.level).toBe('silent');
  });
});

describe('child()', () => {
  it('creates a child logger with bound context', () => {
    const childLog = child({ component: 'test-component', requestId: 'abc-123' });

    expect(childLog).toBeDefined();
    expect(typeof childLog.info).toBe('function');
    expect(typeof childLog.error).toBe('function');
  });

  it('child logger is distinct from root logger', () => {
    const root = getLogger();
    const childLog = child({ component: 'child-test' });

    expect(childLog).not.toBe(root);
  });

  it('child logger inherits the log level', () => {
    const childLog = child({ component: 'level-test' });

    expect(childLog.level).toBe('silent');
  });
});

describe('logger levels', () => {
  it('logger exposes standard pino level names', () => {
    const log = getLogger();
    const levelNames = Object.keys(log.levels.values);

    expect(levelNames).toContain('trace');
    expect(levelNames).toContain('debug');
    expect(levelNames).toContain('info');
    expect(levelNames).toContain('warn');
    expect(levelNames).toContain('error');
    expect(levelNames).toContain('fatal');
  });

  it('level numeric values are in ascending order', () => {
    const log = getLogger();
    const vals = log.levels.values;

    expect(vals.trace).toBeLessThan(vals.debug);
    expect(vals.debug).toBeLessThan(vals.info);
    expect(vals.info).toBeLessThan(vals.warn);
    expect(vals.warn).toBeLessThan(vals.error);
    expect(vals.error).toBeLessThan(vals.fatal);
  });
});

describe('shutdownLogger()', () => {
  it('resolves without error', async () => {
    // Ensure root logger exists before shutdown
    getLogger();

    await expect(shutdownLogger()).resolves.toBeUndefined();
  });
});
