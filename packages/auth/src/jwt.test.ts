import { describe, it, expect, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';
import { resetConfigCache } from '@titan/config';
import {
  signAccessToken,
  signRefreshJwt,
  verifyAccessToken,
  verifyRefreshJwt,
  type AccessTokenPayload,
} from './jwt.js';
import { InvalidTokenError, ExpiredTokenError } from '@titan/shared';

const TEST_SECRET = 'a'.repeat(64);

function setupEnv(): void {
  process.env.JWT_SECRET = TEST_SECRET;
  process.env.JWT_ACCESS_TTL = '900';
  process.env.JWT_REFRESH_TTL = '604800';
  process.env.JWT_ISSUER = 'titan-test';
  process.env.JWT_AUDIENCE = 'titan-test-api';
  process.env.NODE_ENV = 'test';
  resetConfigCache();
}

describe('JWT access tokens', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('signs and verifies an access token', () => {
    const token = signAccessToken('user-123');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.type).toBe('access');
    expect(payload.sid).toBeUndefined();
  });

  it('includes session id when provided', () => {
    const token = signAccessToken('user-123', 'session-456');
    const payload = verifyAccessToken(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.sid).toBe('session-456');
  });

  it('includes iat, exp, iss, aud claims', () => {
    const now = Math.floor(Date.now() / 1000);
    const token = signAccessToken('user-123');
    const decoded = jwt.decode(token) as AccessTokenPayload;
    expect(decoded.iat).toBeGreaterThanOrEqual(now - 1);
    expect(decoded.exp).toBeGreaterThan(decoded.iat!);
    expect(decoded.iss).toBe('titan-test');
    expect(decoded.aud).toBe('titan-test-api');
  });

  it('rejects a refresh token as access token', () => {
    const refresh = signRefreshJwt('user-123', 'session-456');
    expect(() => verifyAccessToken(refresh)).toThrow(InvalidTokenError);
  });

  it('rejects an expired access token', () => {
    const token = jwt.sign(
      { sub: 'user-123', type: 'access', iat: 0, exp: 1 },
      TEST_SECRET,
      { algorithm: 'HS256' },
    );
    expect(() => verifyAccessToken(token)).toThrow(ExpiredTokenError);
  });

  it('rejects a token signed with wrong secret', () => {
    const badToken = jwt.sign({ sub: 'user-123', type: 'access' }, 'wrong-secret', { algorithm: 'HS256' });
    expect(() => verifyAccessToken(badToken)).toThrow(InvalidTokenError);
  });

  it('rejects a tampered token', () => {
    const token = signAccessToken('user-123');
    const tampered = token.slice(0, -5) + 'XXXXX';
    expect(() => verifyAccessToken(tampered)).toThrow(InvalidTokenError);
  });
});

describe('JWT refresh tokens', () => {
  beforeEach(() => {
    setupEnv();
  });

  it('signs and verifies a refresh token', () => {
    const token = signRefreshJwt('user-123', 'session-456');
    const payload = verifyRefreshJwt(token);
    expect(payload.sub).toBe('user-123');
    expect(payload.sid).toBe('session-456');
    expect(payload.jti).toBe('session-456');
    expect(payload.type).toBe('refresh');
  });

  it('rejects an access token as refresh token', () => {
    const access = signAccessToken('user-123', 'session-456');
    expect(() => verifyRefreshJwt(access)).toThrow(InvalidTokenError);
  });

  it('rejects an expired refresh token', () => {
    const token = jwt.sign(
      { sub: 'user-123', sid: 'session-456', jti: 'session-456', type: 'refresh', iat: 0, exp: 1 },
      TEST_SECRET,
      { algorithm: 'HS256' },
    );
    expect(() => verifyRefreshJwt(token)).toThrow(ExpiredTokenError);
  });

  it('rejects a refresh token with wrong secret', () => {
    const badToken = jwt.sign({ sub: 'user-123', sid: 's1', jti: 's1', type: 'refresh' }, 'wrong-secret', { algorithm: 'HS256' });
    expect(() => verifyRefreshJwt(badToken)).toThrow(InvalidTokenError);
  });
});
