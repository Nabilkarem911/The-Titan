import { vi, describe, it, expect, beforeEach } from 'vitest';
import { resetConfigCache } from '@titan/config';

const { mockUsers, mockSessions, mockApiKeys, mockMembers, mockWorkspaces } = vi.hoisted(() => ({
  mockUsers: { findById: vi.fn(), findByEmail: vi.fn(), create: vi.fn(), count: vi.fn(), findFirst: vi.fn() },
  mockSessions: { create: vi.fn(), atomicConsumeByHash: vi.fn(), findByRefreshHashIncludingRevoked: vi.fn(), getState: vi.fn(), revoke: vi.fn(), revokeAllForUser: vi.fn() },
  mockApiKeys: { findByHash: vi.fn(), touchLastUsed: vi.fn(), create: vi.fn(), revoke: vi.fn() },
  mockMembers: { findMembership: vi.fn() },
  mockWorkspaces: { findById: vi.fn() },
}));

vi.mock('@titan/database', () => ({
  users: mockUsers,
  sessions: mockSessions,
  apiKeys: mockApiKeys,
  members: mockMembers,
  workspaces: mockWorkspaces,
}));

vi.mock('@titan/logging', () => ({
  getLogger: () => ({
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }),
}));

import {
  registerUser,
  loginUser,
  refreshTokens,
  logout,
  logoutAllForUser,
  resolveAuthFromAccessToken,
  resolveAuthFromApiKey,
  resolveWorkspaceContext,
  createApiKey,
  revokeApiKey,
} from './service.js';
import { hashPassword, verifyPassword, generateApiKey, generateRefreshToken } from './crypto.js';
import { signAccessToken } from './jwt.js';
import {
  ConflictError,
  InvalidCredentialsError,
  InvalidTokenError,
  NotFoundError,
  UnauthorizedError,
} from '@titan/shared';

// ---------------------------------------------------------------------------
// Shared test environment setup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 1. Pure utility functions — password hashing
// ---------------------------------------------------------------------------

describe('Password hashing (service-level)', () => {
  it('hashPassword + verifyPassword round-trip works', async () => {
    const plain = 'correct-horse-battery-staple';
    const hash = await hashPassword(plain);
    const ok = await verifyPassword(plain, hash);
    expect(ok).toBe(true);
  });

  it('hashPassword produces bcrypt $2b$ format', async () => {
    const hash = await hashPassword('test-password');
    expect(hash).toMatch(/^\$2b\$/);
  });

  it('verifyPassword rejects a wrong password', async () => {
    const hash = await hashPassword('real-password');
    const ok = await verifyPassword('wrong-password', hash);
    expect(ok).toBe(false);
  });

  it('verifyPassword timing is similar for valid and invalid users (anti-enumeration)', async () => {
    const hash = await hashPassword('known-password');
    // Dummy hash that loginUser uses when user is not found
    const dummyHash = '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid';

    const iterations = 3;
    const timingsValid: number[] = [];
    const timingsInvalid: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start1 = performance.now();
      await verifyPassword('attempt', hash);
      timingsValid.push(performance.now() - start1);

      const start2 = performance.now();
      try {
        await verifyPassword('attempt', dummyHash);
      } catch {
        // bcrypt may throw on malformed hash – still counts as "work done"
      }
      timingsInvalid.push(performance.now() - start2);
    }

    const avgValid = timingsValid.reduce((a, b) => a + b, 0) / iterations;
    const avgInvalid = timingsInvalid.reduce((a, b) => a + b, 0) / iterations;

    // Both paths should take at least some time (not instant-reject).
    // We allow a generous 10x ratio to avoid flaky tests while still
    // catching an obvious short-circuit (e.g. <1 ms vs 80 ms).
    const ratio = Math.max(avgValid, avgInvalid) / Math.max(Math.min(avgValid, avgInvalid), 0.01);
    expect(ratio).toBeLessThan(10);
  });
});

// ---------------------------------------------------------------------------
// 2. registerUser
// ---------------------------------------------------------------------------

describe('registerUser', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
    mockUsers.count.mockResolvedValue(0);
    mockUsers.findFirst.mockResolvedValue(null);
  });

  it('creates a user and returns tokens', async () => {
    const fakeUser = { id: 'u1', email: 'alice@example.com', name: 'Alice' };
    const fakeSession = { id: 'sess-1', userId: 'u1', refreshTokenHash: 'h' };

    mockUsers.create.mockResolvedValue(fakeUser);
    mockSessions.create.mockResolvedValue(fakeSession);

    const result = await registerUser({ email: 'Alice@Example.com', name: 'Alice', password: 'pw123' });

    expect(mockUsers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'alice@example.com', name: 'Alice' }),
    );
    expect(result.user.id).toBe('u1');
    expect(result.user.email).toBe('alice@example.com');
    expect(result.tokens.tokenType).toBe('Bearer');
    expect(result.tokens.accessToken).toBeTruthy();
    expect(result.tokens.refreshToken).toBeTruthy();
    expect(result.tokens.expiresIn).toBe(900);
  });

  it('lowercases the email before creating', async () => {
    const fakeUser = { id: 'u2', email: 'bob@test.com', name: 'Bob' };
    mockUsers.create.mockResolvedValue(fakeUser);
    mockSessions.create.mockResolvedValue({ id: 's', userId: 'u2', refreshTokenHash: 'h' });

    await registerUser({ email: 'BOB@TEST.COM', name: 'Bob', password: 'pw' });

    expect(mockUsers.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'bob@test.com' }),
    );
  });

  it('throws ConflictError when email already exists', async () => {
    mockUsers.create.mockResolvedValue(null);

    await expect(
      registerUser({ email: 'dup@example.com', name: 'Dup', password: 'pw' }),
    ).rejects.toThrow(ConflictError);
  });

  it('stores a bcrypt hash, not the raw password', async () => {
    const fakeUser = { id: 'u3', email: 'x@x.com', name: 'X' };
    mockUsers.create.mockResolvedValue(fakeUser);
    mockSessions.create.mockResolvedValue({ id: 's', userId: 'u3', refreshTokenHash: 'h' });

    await registerUser({ email: 'x@x.com', name: 'X', password: 'my-secret' });

    const passedHash = mockUsers.create.mock.calls[0][0].passwordHash;
    expect(passedHash).not.toBe('my-secret');
    expect(passedHash).toMatch(/^\$2[aby]\$/);
  });
});

// ---------------------------------------------------------------------------
// 3. loginUser
// ---------------------------------------------------------------------------

describe('loginUser', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
  });

  it('returns tokens for valid credentials', async () => {
    const pw = 'good-password';
    const hash = await hashPassword(pw);
    const fakeUser = { id: 'u1', email: 'a@b.com', name: 'A', passwordHash: hash, isActive: true };
    mockUsers.findByEmail.mockResolvedValue(fakeUser);
    mockSessions.create.mockResolvedValue({ id: 'sess', userId: 'u1', refreshTokenHash: 'h' });

    const result = await loginUser({ email: 'A@B.COM', password: pw });

    expect(result.user.id).toBe('u1');
    expect(result.tokens.accessToken).toBeTruthy();
  });

  it('throws InvalidCredentialsError for non-existent user', async () => {
    mockUsers.findByEmail.mockResolvedValue(null);

    await expect(
      loginUser({ email: 'nobody@example.com', password: 'pw' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for inactive user', async () => {
    const hash = await hashPassword('pw');
    mockUsers.findByEmail.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A', passwordHash: hash, isActive: false,
    });

    await expect(
      loginUser({ email: 'a@b.com', password: 'pw' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('throws InvalidCredentialsError for wrong password', async () => {
    const hash = await hashPassword('correct');
    mockUsers.findByEmail.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A', passwordHash: hash, isActive: true,
    });

    await expect(
      loginUser({ email: 'a@b.com', password: 'wrong' }),
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('lowercases the email before lookup', async () => {
    const hash = await hashPassword('pw');
    mockUsers.findByEmail.mockResolvedValue({
      id: 'u1', email: 'x@y.com', name: 'X', passwordHash: hash, isActive: true,
    });
    mockSessions.create.mockResolvedValue({ id: 's', userId: 'u1', refreshTokenHash: 'h' });

    await loginUser({ email: 'X@Y.COM', password: 'pw' });

    expect(mockUsers.findByEmail).toHaveBeenCalledWith('x@y.com');
  });

  it('passes userAgent and ipAddress through to session creation', async () => {
    const hash = await hashPassword('pw');
    mockUsers.findByEmail.mockResolvedValue({
      id: 'u1', email: 'a@b.com', name: 'A', passwordHash: hash, isActive: true,
    });
    mockSessions.create.mockResolvedValue({ id: 's', userId: 'u1', refreshTokenHash: 'h' });

    await loginUser({ email: 'a@b.com', password: 'pw', userAgent: 'TestAgent/1.0', ipAddress: '10.0.0.1' });

    expect(mockSessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ userAgent: 'TestAgent/1.0', ipAddress: '10.0.0.1' }),
    );
  });
});

// ---------------------------------------------------------------------------
// 4. refreshTokens
// ---------------------------------------------------------------------------

describe('refreshTokens', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
  });

  it('throws InvalidTokenError for empty token', async () => {
    await expect(refreshTokens('')).rejects.toThrow(InvalidTokenError);
  });

  it('throws InvalidTokenError for short token', async () => {
    await expect(refreshTokens('short')).rejects.toThrow(InvalidTokenError);
  });

  it('throws InvalidTokenError when session not found and no prior session', async () => {
    mockSessions.atomicConsumeByHash.mockResolvedValue(null);
    mockSessions.findByRefreshHashIncludingRevoked.mockResolvedValue(null);

    const { plaintext } = generateRefreshToken();
    await expect(refreshTokens(plaintext)).rejects.toThrow(InvalidTokenError);
  });

  it('issues a new token pair on valid refresh', async () => {
    const refresh = generateRefreshToken();
    const fakeSession = {
      id: 'sess-old',
      userId: 'u1',
      refreshTokenHash: refresh.hash,
    };
    mockSessions.atomicConsumeByHash.mockResolvedValue(fakeSession);
    mockSessions.create.mockResolvedValue({ id: 'sess-new', userId: 'u1', refreshTokenHash: 'h2' });

    const tokens = await refreshTokens(refresh.plaintext);

    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken).toBeTruthy();
    expect(tokens.tokenType).toBe('Bearer');
    expect(tokens.expiresIn).toBe(900);
  });

  it('detects reuse and revokes all sessions for the user', async () => {
    const refresh = generateRefreshToken();
    mockSessions.atomicConsumeByHash.mockResolvedValue(null);
    mockSessions.findByRefreshHashIncludingRevoked.mockResolvedValue({
      id: 'sess-old',
      userId: 'u1',
      refreshTokenHash: refresh.hash,
    });

    await expect(refreshTokens(refresh.plaintext)).rejects.toThrow(InvalidTokenError);
    expect(mockSessions.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});

// ---------------------------------------------------------------------------
// 5. logout / logoutAllForUser
// ---------------------------------------------------------------------------

describe('logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes the session', async () => {
    mockSessions.revoke.mockResolvedValue(undefined);
    await logout('sess-1');
    expect(mockSessions.revoke).toHaveBeenCalledWith('sess-1');
  });
});

describe('logoutAllForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes all sessions for a user', async () => {
    mockSessions.revokeAllForUser.mockResolvedValue(undefined);
    await logoutAllForUser('u1');
    expect(mockSessions.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});

// ---------------------------------------------------------------------------
// 6. resolveAuthFromAccessToken
// ---------------------------------------------------------------------------

describe('resolveAuthFromAccessToken', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
    mockUsers.count.mockResolvedValue(1);
    mockUsers.findFirst.mockResolvedValue(null);
  });

  it('resolves auth context from a valid token', async () => {
    const token = signAccessToken('u1', 'sess-1');
    mockUsers.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', isActive: true });
    mockSessions.getState.mockResolvedValue({ userId: 'u1', revoked: false });

    const ctx = await resolveAuthFromAccessToken(token);

    expect(ctx.userId).toBe('u1');
    expect(ctx.sessionId).toBe('sess-1');
    expect(ctx.role).toBeDefined();
    expect(ctx.permissions.length).toBeGreaterThan(0);
  });

  it('throws UnauthorizedError when user not found', async () => {
    const token = signAccessToken('u-gone');
    mockUsers.findById.mockResolvedValue(null);

    await expect(resolveAuthFromAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when user is inactive', async () => {
    const token = signAccessToken('u1');
    mockUsers.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', isActive: false });

    await expect(resolveAuthFromAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when session is revoked', async () => {
    const token = signAccessToken('u1', 'sess-revoked');
    mockUsers.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', isActive: true });
    mockSessions.getState.mockResolvedValue({ userId: 'u1', revoked: true });

    await expect(resolveAuthFromAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when session not found', async () => {
    const token = signAccessToken('u1', 'sess-missing');
    mockUsers.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', isActive: true });
    mockSessions.getState.mockResolvedValue(null);

    await expect(resolveAuthFromAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError on session/user mismatch', async () => {
    const token = signAccessToken('u1', 'sess-other');
    mockUsers.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', isActive: true });
    mockSessions.getState.mockResolvedValue({ userId: 'u-other', revoked: false });

    await expect(resolveAuthFromAccessToken(token)).rejects.toThrow(UnauthorizedError);
  });

  it('skips session check when no session id in token', async () => {
    const token = signAccessToken('u1');
    mockUsers.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com', name: 'A', isActive: true });

    const ctx = await resolveAuthFromAccessToken(token);

    expect(ctx.userId).toBe('u1');
    expect(ctx.sessionId).toBeUndefined();
    expect(mockSessions.getState).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// 7. resolveAuthFromApiKey
// ---------------------------------------------------------------------------

describe('resolveAuthFromApiKey', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
  });

  it('resolves auth context for a valid API key', async () => {
    const generated = generateApiKey();
    mockApiKeys.findByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'u1',
      keyHash: generated.hash,
      scopes: ['agent:read', 'agent:write'],
      workspaceId: 'ws-1',
    });
    mockApiKeys.touchLastUsed.mockResolvedValue(undefined);

    const ctx = await resolveAuthFromApiKey(generated.plaintext);

    expect(ctx.userId).toBe('u1');
    expect(ctx.apiKeyId).toBe('key-1');
    expect(ctx.workspaceId).toBe('ws-1');
    expect(ctx.permissions).toContain('agent:read');
    expect(ctx.permissions).toContain('agent:write');
  });

  it('throws UnauthorizedError for unknown API key', async () => {
    mockApiKeys.findByHash.mockResolvedValue(null);

    await expect(resolveAuthFromApiKey('tk_12345678_fake')).rejects.toThrow(UnauthorizedError);
  });

  it('throws UnauthorizedError when hash verification fails', async () => {
    const generated = generateApiKey();
    mockApiKeys.findByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'u1',
      keyHash: 'a'.repeat(64), // wrong hash
      scopes: [],
      workspaceId: null,
    });

    await expect(resolveAuthFromApiKey(generated.plaintext)).rejects.toThrow(UnauthorizedError);
  });

  it('filters scopes to only valid owner permissions', async () => {
    const generated = generateApiKey();
    mockApiKeys.findByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'u1',
      keyHash: generated.hash,
      scopes: ['agent:read', 'totally:bogus', 'workspace:admin'],
      workspaceId: null,
    });
    mockApiKeys.touchLastUsed.mockResolvedValue(undefined);

    const ctx = await resolveAuthFromApiKey(generated.plaintext);

    expect(ctx.permissions).toContain('agent:read');
    expect(ctx.permissions).toContain('workspace:admin');
    expect(ctx.permissions).not.toContain('totally:bogus');
  });

  it('omits workspaceId from context when key has none', async () => {
    const generated = generateApiKey();
    mockApiKeys.findByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'u1',
      keyHash: generated.hash,
      scopes: [],
      workspaceId: null,
    });
    mockApiKeys.touchLastUsed.mockResolvedValue(undefined);

    const ctx = await resolveAuthFromApiKey(generated.plaintext);

    expect(ctx.workspaceId).toBeUndefined();
  });

  it('handles null scopes gracefully', async () => {
    const generated = generateApiKey();
    mockApiKeys.findByHash.mockResolvedValue({
      id: 'key-1',
      userId: 'u1',
      keyHash: generated.hash,
      scopes: null,
      workspaceId: null,
    });
    mockApiKeys.touchLastUsed.mockResolvedValue(undefined);

    const ctx = await resolveAuthFromApiKey(generated.plaintext);

    expect(ctx.permissions).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 8. resolveWorkspaceContext
// ---------------------------------------------------------------------------

describe('resolveWorkspaceContext', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
  });

  it('returns context with role-based permissions for a member', async () => {
    mockWorkspaces.findById.mockResolvedValue({ id: 'ws-1', name: 'My WS' });
    mockMembers.findMembership.mockResolvedValue({ role: 'member' });

    const ctx = await resolveWorkspaceContext('u1', 'ws-1');

    expect(ctx.userId).toBe('u1');
    expect(ctx.workspaceId).toBe('ws-1');
    expect(ctx.role).toBe('member');
    expect(ctx.permissions.length).toBeGreaterThan(0);
  });

  it('throws NotFoundError for non-existent workspace', async () => {
    mockWorkspaces.findById.mockResolvedValue(null);

    await expect(resolveWorkspaceContext('u1', 'ws-gone')).rejects.toThrow(NotFoundError);
  });

  it('throws UnauthorizedError for non-member', async () => {
    mockWorkspaces.findById.mockResolvedValue({ id: 'ws-1', name: 'WS' });
    mockMembers.findMembership.mockResolvedValue(null);

    await expect(resolveWorkspaceContext('u1', 'ws-1')).rejects.toThrow(UnauthorizedError);
  });

  it('uses API key permissions when provided', async () => {
    mockWorkspaces.findById.mockResolvedValue({ id: 'ws-1', name: 'WS' });
    mockMembers.findMembership.mockResolvedValue({ role: 'owner' });

    const ctx = await resolveWorkspaceContext('u1', 'ws-1', {
      apiKeyPermissions: ['agent:read'] as any,
      apiKeyId: 'key-99',
    });

    expect(ctx.permissions).toEqual(['agent:read']);
    expect(ctx.apiKeyId).toBe('key-99');
    expect(ctx.role).toBe('owner');
  });
});

// ---------------------------------------------------------------------------
// 9. createApiKey
// ---------------------------------------------------------------------------

describe('createApiKey', () => {
  beforeEach(() => {
    setupEnv();
    vi.clearAllMocks();
  });

  it('creates an API key for a user without workspace', async () => {
    mockApiKeys.create.mockResolvedValue({
      id: 'key-1',
      keyPrefix: 'tk_abcdef01',
      createdAt: new Date('2025-01-01'),
    });

    const result = await createApiKey({ userId: 'u1', name: 'My Key' });

    expect(result.id).toBe('key-1');
    expect(result.plaintext).toMatch(/^tk_/);
    expect(result.keyPrefix).toBeTruthy();
    expect(mockMembers.findMembership).not.toHaveBeenCalled();
  });

  it('checks membership when workspace-scoped', async () => {
    mockMembers.findMembership.mockResolvedValue({ role: 'member' });
    mockApiKeys.create.mockResolvedValue({
      id: 'key-2',
      keyPrefix: 'tk_12345678',
      createdAt: new Date(),
    });

    await createApiKey({ userId: 'u1', workspaceId: 'ws-1', name: 'WS Key' });

    expect(mockMembers.findMembership).toHaveBeenCalledWith('ws-1', 'u1');
  });

  it('throws UnauthorizedError when creating workspace-scoped key without membership', async () => {
    mockMembers.findMembership.mockResolvedValue(null);

    await expect(
      createApiKey({ userId: 'u1', workspaceId: 'ws-1', name: 'Key' }),
    ).rejects.toThrow(UnauthorizedError);
  });
});

// ---------------------------------------------------------------------------
// 10. revokeApiKey
// ---------------------------------------------------------------------------

describe('revokeApiKey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('revokes an API key', async () => {
    mockApiKeys.revoke.mockResolvedValue(true);

    await revokeApiKey('u1', 'key-1');

    expect(mockApiKeys.revoke).toHaveBeenCalledWith('key-1', 'u1');
  });

  it('throws NotFoundError when key does not exist or belongs to another user', async () => {
    mockApiKeys.revoke.mockResolvedValue(false);

    await expect(revokeApiKey('u1', 'key-missing')).rejects.toThrow(NotFoundError);
  });
});
