import { ERROR_CODES, ERROR_HTTP_STATUS, type ErrorCode } from './constants.js';

export class TitanError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;
  public readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options?: { details?: unknown; cause?: unknown }) {
    super(message, options?.cause ? { cause: options.cause } : undefined);
    this.name = 'TitanError';
    this.code = code;
    this.statusCode = ERROR_HTTP_STATUS[code];
    this.details = options?.details;
    this.cause = options?.cause;
    Error.captureStackTrace?.(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

export class UnauthorizedError extends TitanError {
  constructor(message = 'Unauthorized', details?: unknown) {
    super(ERROR_CODES.UNAUTHORIZED, message, details !== undefined ? { details } : undefined);
    this.name = 'UnauthorizedError';
  }
}

export class InvalidTokenError extends TitanError {
  constructor(message = 'Invalid token', details?: unknown) {
    super(ERROR_CODES.INVALID_TOKEN, message, details !== undefined ? { details } : undefined);
    this.name = 'InvalidTokenError';
  }
}

export class ExpiredTokenError extends TitanError {
  constructor(message = 'Token expired', details?: unknown) {
    super(ERROR_CODES.EXPIRED_TOKEN, message, details !== undefined ? { details } : undefined);
    this.name = 'ExpiredTokenError';
  }
}

export class InvalidCredentialsError extends TitanError {
  constructor(message = 'Invalid credentials') {
    super(ERROR_CODES.INVALID_CREDENTIALS, message);
    this.name = 'InvalidCredentialsError';
  }
}

export class InsufficientPermissionsError extends TitanError {
  constructor(message = 'Insufficient permissions', details?: unknown) {
    super(ERROR_CODES.INSUFFICIENT_PERMISSIONS, message, details !== undefined ? { details } : undefined);
    this.name = 'InsufficientPermissionsError';
  }
}

export class ValidationError extends TitanError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.VALIDATION_FAILED, message, details !== undefined ? { details } : undefined);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends TitanError {
  constructor(resource: string, id?: string) {
    super(
      ERROR_CODES.NOT_FOUND,
      id ? `${resource} not found: ${id}` : `${resource} not found`,
      { details: { resource, id } },
    );
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends TitanError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.CONFLICT, message, details !== undefined ? { details } : undefined);
    this.name = 'ConflictError';
  }
}

export class RateLimitedError extends TitanError {
  constructor(message = 'Rate limit exceeded', details?: unknown) {
    super(ERROR_CODES.RATE_LIMITED, message, details !== undefined ? { details } : undefined);
    this.name = 'RateLimitedError';
  }
}

export class ServiceUnavailableError extends TitanError {
  constructor(message = 'Service unavailable', details?: unknown) {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, message, details !== undefined ? { details } : undefined);
    this.name = 'ServiceUnavailableError';
  }
}

export class WebSocketProtocolError extends TitanError {
  constructor(message: string, details?: unknown) {
    super(ERROR_CODES.WS_PROTOCOL_ERROR, message, details !== undefined ? { details } : undefined);
    this.name = 'WebSocketProtocolError';
  }
}
