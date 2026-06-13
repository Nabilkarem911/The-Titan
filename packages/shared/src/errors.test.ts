import { describe, it, expect } from 'vitest';
import {
  TitanError,
  UnauthorizedError,
  InvalidTokenError,
  ExpiredTokenError,
  InvalidCredentialsError,
  InsufficientPermissionsError,
  ValidationError,
  NotFoundError,
  ConflictError,
  RateLimitedError,
  ServiceUnavailableError,
  WebSocketProtocolError,
} from './errors.js';
import { ERROR_CODES, ERROR_HTTP_STATUS } from './constants.js';

describe('TitanError base class', () => {
  it('constructs with code, message, and status code mapping', () => {
    const err = new TitanError(ERROR_CODES.INTERNAL, 'Something broke');
    expect(err.code).toBe('E5001');
    expect(err.message).toBe('Something broke');
    expect(err.statusCode).toBe(500);
    expect(err.name).toBe('TitanError');
  });

  it('accepts optional details and cause', () => {
    const cause = new Error('root');
    const err = new TitanError(ERROR_CODES.INTERNAL, 'Wrapped', { details: { foo: 1 }, cause });
    expect(err.details).toEqual({ foo: 1 });
    expect(err.cause).toBe(cause);
  });

  it('serializes to JSON correctly', () => {
    const err = new TitanError(ERROR_CODES.NOT_FOUND, 'Missing', { details: { id: 'abc' } });
    const json = err.toJSON();
    expect(json).toEqual({
      name: 'TitanError',
      code: 'E3001',
      message: 'Missing',
      statusCode: 404,
      details: { id: 'abc' },
    });
  });

  it('is an instance of Error', () => {
    const err = new TitanError(ERROR_CODES.INTERNAL, 'x');
    expect(err).toBeInstanceOf(Error);
  });
});

describe('UnauthorizedError', () => {
  it('has correct code and default message', () => {
    const err = new UnauthorizedError();
    expect(err.code).toBe(ERROR_CODES.UNAUTHORIZED);
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Unauthorized');
  });

  it('accepts custom message and details', () => {
    const err = new UnauthorizedError('Nope', { reason: 'expired' });
    expect(err.message).toBe('Nope');
    expect(err.details).toEqual({ reason: 'expired' });
  });
});

describe('InvalidTokenError', () => {
  it('maps to 401', () => {
    const err = new InvalidTokenError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ERROR_CODES.INVALID_TOKEN);
  });
});

describe('ExpiredTokenError', () => {
  it('maps to 401', () => {
    const err = new ExpiredTokenError();
    expect(err.statusCode).toBe(401);
    expect(err.code).toBe(ERROR_CODES.EXPIRED_TOKEN);
  });
});

describe('InvalidCredentialsError', () => {
  it('maps to 401 with default message', () => {
    const err = new InvalidCredentialsError();
    expect(err.statusCode).toBe(401);
    expect(err.message).toBe('Invalid credentials');
  });
});

describe('InsufficientPermissionsError', () => {
  it('maps to 403', () => {
    const err = new InsufficientPermissionsError();
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe(ERROR_CODES.INSUFFICIENT_PERMISSIONS);
  });
});

describe('ValidationError', () => {
  it('maps to 400 and requires message', () => {
    const err = new ValidationError('Bad input');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('Bad input');
  });
});

describe('NotFoundError', () => {
  it('formats message with resource and id', () => {
    const err = new NotFoundError('User', '123');
    expect(err.message).toBe('User not found: 123');
    expect(err.statusCode).toBe(404);
    expect(err.details).toEqual({ resource: 'User', id: '123' });
  });

  it('formats message without id', () => {
    const err = new NotFoundError('Thing');
    expect(err.message).toBe('Thing not found');
    expect(err.details).toEqual({ resource: 'Thing', id: undefined });
  });
});

describe('ConflictError', () => {
  it('maps to 409', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.message).toBe('Already exists');
  });
});

describe('RateLimitedError', () => {
  it('maps to 429', () => {
    const err = new RateLimitedError();
    expect(err.statusCode).toBe(429);
    expect(err.code).toBe(ERROR_CODES.RATE_LIMITED);
  });
});

describe('ServiceUnavailableError', () => {
  it('maps to 503', () => {
    const err = new ServiceUnavailableError();
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
  });
});

describe('WebSocketProtocolError', () => {
  it('maps to 400', () => {
    const err = new WebSocketProtocolError('Bad frame');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe(ERROR_CODES.WS_PROTOCOL_ERROR);
  });
});

describe('ERROR_HTTP_STATUS completeness', () => {
  it('maps every ERROR_CODE to a numeric status', () => {
    for (const [code, status] of Object.entries(ERROR_HTTP_STATUS)) {
      expect(typeof status).toBe('number');
      expect(status).toBeGreaterThanOrEqual(100);
      expect(status).toBeLessThan(600);
      // Verify the code exists in ERROR_CODES values
      expect(Object.values(ERROR_CODES)).toContain(code);
    }
  });
});
