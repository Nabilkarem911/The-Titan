import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { QUEUE_NAMES } from '@titan/shared';
import {
  JobValidationError,
  RetryableError,
  NonRetryableError,
  isRetryable,
  registerJobSchema,
  getJobSchema,
  listRegisteredSchemas,
  validateJob,
  isKnownQueue,
  KNOWN_QUEUE_NAMES,
  checkPoison,
} from './validation.js';

/* ------------------------------------------------------------------ */
/*  Error classes                                                      */
/* ------------------------------------------------------------------ */

describe('JobValidationError', () => {
  it('stores zod issues and formats message', () => {
    const issues: z.ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['name'], message: 'Expected string' },
    ];
    const err = new JobValidationError(issues);
    expect(err.name).toBe('JobValidationError');
    expect(err.code).toBe('JOB_VALIDATION_FAILED');
    expect(err.issues).toBe(issues);
    expect(err.message).toContain('1 issue(s)');
    expect(err).toBeInstanceOf(Error);
  });

  it('handles multiple issues', () => {
    const issues: z.ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['a'], message: 'bad a' },
      { code: 'invalid_type', expected: 'number', received: 'string', path: ['b'], message: 'bad b' },
      { code: 'invalid_type', expected: 'boolean', received: 'string', path: ['c'], message: 'bad c' },
    ];
    const err = new JobValidationError(issues);
    expect(err.issues).toHaveLength(3);
    expect(err.message).toContain('3 issue(s)');
  });
});

describe('RetryableError', () => {
  it('has correct name and code', () => {
    const err = new RetryableError('Timeout');
    expect(err.name).toBe('RetryableError');
    expect(err.code).toBe('RETRYABLE');
    expect(err.message).toBe('Timeout');
    expect(err.retryAfterMs).toBeUndefined();
  });

  it('stores retryAfterMs when provided', () => {
    const err = new RetryableError('Throttled', 5000);
    expect(err.retryAfterMs).toBe(5000);
  });

  it('is an instance of Error', () => {
    expect(new RetryableError('x')).toBeInstanceOf(Error);
  });
});

describe('NonRetryableError', () => {
  it('has correct name and code', () => {
    const err = new NonRetryableError('Bad data');
    expect(err.name).toBe('NonRetryableError');
    expect(err.code).toBe('NON_RETRYABLE');
    expect(err.message).toBe('Bad data');
  });

  it('is an instance of Error', () => {
    expect(new NonRetryableError('x')).toBeInstanceOf(Error);
  });
});

/* ------------------------------------------------------------------ */
/*  isRetryable                                                        */
/* ------------------------------------------------------------------ */

describe('isRetryable', () => {
  it('returns false for NonRetryableError', () => {
    expect(isRetryable(new NonRetryableError('bad'))).toBe(false);
  });

  it('returns true for RetryableError', () => {
    expect(isRetryable(new RetryableError('retry me'))).toBe(true);
  });

  it('returns false for JobValidationError', () => {
    const issues: z.ZodIssue[] = [
      { code: 'invalid_type', expected: 'string', received: 'number', path: ['x'], message: 'bad' },
    ];
    expect(isRetryable(new JobValidationError(issues))).toBe(false);
  });

  it('returns false for plain object with code NON_RETRYABLE', () => {
    expect(isRetryable({ code: 'NON_RETRYABLE', message: 'done' })).toBe(false);
  });

  it('returns true for plain object with code RETRYABLE', () => {
    expect(isRetryable({ code: 'RETRYABLE', message: 'retry' })).toBe(true);
  });

  it('returns true for generic Error (unknown errors are retryable)', () => {
    expect(isRetryable(new Error('something broke'))).toBe(true);
  });

  it('returns true for null/undefined (default to retryable)', () => {
    expect(isRetryable(null)).toBe(true);
    expect(isRetryable(undefined)).toBe(true);
  });

  it('returns true for a string (not an object)', () => {
    expect(isRetryable('some string')).toBe(true);
  });

  it('returns true for a number', () => {
    expect(isRetryable(42)).toBe(true);
  });

  it('returns true for object with unrecognized code', () => {
    expect(isRetryable({ code: 'SOMETHING_ELSE' })).toBe(true);
  });

  it('checks NonRetryableError before RetryableError in precedence', () => {
    // NonRetryableError takes priority -- it's checked first
    const err = new NonRetryableError('stop');
    expect(isRetryable(err)).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  Schema registration & validation                                   */
/* ------------------------------------------------------------------ */

const TestSchema = z.object({
  name: z.string().min(1).max(200),
  count: z.number().int().positive(),
});

describe('registerJobSchema / getJobSchema / listRegisteredSchemas', () => {
  beforeEach(() => {
    // Register a schema for a known queue
    registerJobSchema(QUEUE_NAMES.AGENT_EXECUTE, TestSchema);
  });

  it('stores and retrieves a schema by queue name', () => {
    const schema = getJobSchema(QUEUE_NAMES.AGENT_EXECUTE);
    expect(schema).toBeDefined();
  });

  it('returns undefined for unregistered queue', () => {
    expect(getJobSchema(QUEUE_NAMES.WEBHOOK_DELIVER)).toBeUndefined();
  });

  it('lists registered schema queue names', () => {
    const list = listRegisteredSchemas();
    expect(list).toContain(QUEUE_NAMES.AGENT_EXECUTE);
  });
});

describe('validateJob', () => {
  beforeEach(() => {
    registerJobSchema(QUEUE_NAMES.MEMORY_INDEX, TestSchema);
  });

  it('returns parsed data for valid input', () => {
    const result = validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 'hello', count: 5 });
    expect(result).toEqual({ name: 'hello', count: 5 });
  });

  it('throws NonRetryableError when no schema is registered', () => {
    expect(() => validateJob(QUEUE_NAMES.SANDBOX_EXEC, { anything: true })).toThrow(NonRetryableError);
    try {
      validateJob(QUEUE_NAMES.SANDBOX_EXEC, { anything: true });
    } catch (e) {
      expect((e as NonRetryableError).message).toContain('No schema registered');
      expect((e as NonRetryableError).message).toContain(QUEUE_NAMES.SANDBOX_EXEC);
    }
  });

  it('throws JobValidationError for invalid data', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: '', count: -1 })).toThrow(JobValidationError);
  });

  it('throws JobValidationError when required fields are missing', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, {})).toThrow(JobValidationError);
  });

  it('throws JobValidationError for wrong types', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 123, count: 'abc' })).toThrow(JobValidationError);
  });

  it('reports correct number of issues', () => {
    try {
      validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 123, count: 'abc' });
    } catch (e) {
      expect(e).toBeInstanceOf(JobValidationError);
      expect((e as JobValidationError).issues.length).toBeGreaterThanOrEqual(2);
    }
  });

  // Edge cases
  it('rejects empty string for name (min length 1)', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: '', count: 1 })).toThrow(JobValidationError);
  });

  it('rejects zero count (must be positive)', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 'ok', count: 0 })).toThrow(JobValidationError);
  });

  it('rejects negative count', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 'ok', count: -5 })).toThrow(JobValidationError);
  });

  it('rejects float count (must be int)', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 'ok', count: 1.5 })).toThrow(JobValidationError);
  });

  it('accepts name at maximum length boundary (200 chars)', () => {
    const longName = 'a'.repeat(200);
    const result = validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: longName, count: 1 });
    expect(result).toEqual({ name: longName, count: 1 });
  });

  it('rejects name exceeding maximum length (201 chars)', () => {
    const tooLong = 'a'.repeat(201);
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: tooLong, count: 1 })).toThrow(JobValidationError);
  });

  it('strips unknown extra fields (zod default behavior)', () => {
    const result = validateJob(QUEUE_NAMES.MEMORY_INDEX, { name: 'ok', count: 1, extra: 'ignored' });
    expect(result).toEqual({ name: 'ok', count: 1 });
  });

  it('rejects null as input', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, null)).toThrow(JobValidationError);
  });

  it('rejects undefined as input', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, undefined)).toThrow(JobValidationError);
  });

  it('rejects an array as input', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, [1, 2, 3])).toThrow(JobValidationError);
  });

  it('rejects a string as input', () => {
    expect(() => validateJob(QUEUE_NAMES.MEMORY_INDEX, 'not an object')).toThrow(JobValidationError);
  });
});

/* ------------------------------------------------------------------ */
/*  isKnownQueue                                                       */
/* ------------------------------------------------------------------ */

describe('isKnownQueue', () => {
  it('returns true for all defined QUEUE_NAMES', () => {
    for (const name of Object.values(QUEUE_NAMES)) {
      expect(isKnownQueue(name)).toBe(true);
    }
  });

  it('returns false for unknown queue names', () => {
    expect(isKnownQueue('nonexistent-queue')).toBe(false);
    expect(isKnownQueue('')).toBe(false);
    expect(isKnownQueue('agent-execute-typo')).toBe(false);
  });
});

describe('KNOWN_QUEUE_NAMES', () => {
  it('contains all queue names from QUEUE_NAMES constant', () => {
    const expected = Object.values(QUEUE_NAMES);
    expect(KNOWN_QUEUE_NAMES).toEqual(expect.arrayContaining(expected));
    expect(KNOWN_QUEUE_NAMES).toHaveLength(expected.length);
  });
});

/* ------------------------------------------------------------------ */
/*  checkPoison                                                        */
/* ------------------------------------------------------------------ */

describe('checkPoison', () => {
  it('returns false when attempts are below threshold', () => {
    expect(checkPoison('job-1', 0, 5)).toBe(false);
    expect(checkPoison('job-1', 1, 5)).toBe(false);
    expect(checkPoison('job-1', 4, 5)).toBe(false);
  });

  it('returns true when attempts equal threshold', () => {
    expect(checkPoison('job-1', 5, 5)).toBe(true);
  });

  it('returns true when attempts exceed threshold', () => {
    expect(checkPoison('job-1', 10, 5)).toBe(true);
    expect(checkPoison('job-1', 100, 3)).toBe(true);
  });

  it('returns true at threshold boundary of 1', () => {
    expect(checkPoison('job-1', 1, 1)).toBe(true);
    expect(checkPoison('job-1', 0, 1)).toBe(false);
  });
});
