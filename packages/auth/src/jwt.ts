import jwt from 'jsonwebtoken';
import { loadConfig } from '@titan/config';
import { InvalidTokenError, ExpiredTokenError } from '@titan/shared';

export interface AccessTokenPayload {
  sub: string;
  sid?: string;
  type: 'access';
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export interface RefreshTokenPayload {
  sub: string;
  sid: string;
  type: 'refresh';
  jti: string;
  iat?: number;
  exp?: number;
  iss?: string;
  aud?: string;
}

export function signAccessToken(userId: string, sessionId?: string): string {
  const c = loadConfig();
  const payload: Omit<AccessTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
    sub: userId,
    type: 'access',
    ...(sessionId ? { sid: sessionId } : {}),
  };
  return jwt.sign(payload, c.JWT_SECRET, {
    expiresIn: c.JWT_ACCESS_TTL,
    issuer: c.JWT_ISSUER,
    audience: c.JWT_AUDIENCE,
    algorithm: 'HS256',
  });
}

export function signRefreshJwt(userId: string, sessionId: string): string {
  const c = loadConfig();
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp' | 'iss' | 'aud'> = {
    sub: userId,
    sid: sessionId,
    jti: sessionId,
    type: 'refresh',
  };
  return jwt.sign(payload, c.JWT_SECRET, {
    expiresIn: c.JWT_REFRESH_TTL,
    issuer: c.JWT_ISSUER,
    audience: c.JWT_AUDIENCE,
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  const c = loadConfig();
  try {
    const decoded = jwt.verify(token, c.JWT_SECRET, {
      issuer: c.JWT_ISSUER,
      audience: c.JWT_AUDIENCE,
      algorithms: ['HS256'],
    }) as AccessTokenPayload;
    if (decoded.type !== 'access') {
      throw new InvalidTokenError('Token is not an access token');
    }
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ExpiredTokenError('Access token expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError(err.message);
    }
    throw err;
  }
}

export function verifyRefreshJwt(token: string): RefreshTokenPayload {
  const c = loadConfig();
  try {
    const decoded = jwt.verify(token, c.JWT_SECRET, {
      issuer: c.JWT_ISSUER,
      audience: c.JWT_AUDIENCE,
      algorithms: ['HS256'],
    }) as RefreshTokenPayload;
    if (decoded.type !== 'refresh') {
      throw new InvalidTokenError('Token is not a refresh token');
    }
    return decoded;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new ExpiredTokenError('Refresh token expired');
    }
    if (err instanceof jwt.JsonWebTokenError) {
      throw new InvalidTokenError(err.message);
    }
    throw err;
  }
}
