import { getLogger } from '@titan/logging';
import { loadConfig } from '@titan/config';
import { members, users, apiKeys, sessions as sessionsRepo, workspaces as wsRepo } from '@titan/database';
import {
  signAccessToken,
  verifyAccessToken,
} from './jwt.js';
import {
  hashPassword,
  verifyPassword,
  generateRefreshToken,
  hashRefreshToken,
  verifyRefreshToken,
  generateApiKey,
  hashApiKey,
  verifyApiKey as verifyApiKeyHash,
} from './crypto.js';
import { getPermissionsForRole } from './rbac.js';
import {
  ConflictError,
  InvalidCredentialsError,
  InvalidTokenError,
  NotFoundError,
  UnauthorizedError,
  type AuthContext,
  type Permission,
} from '@titan/shared';

const log = getLogger().child({ component: 'auth-service' });

interface RegisterInput {
  email: string;
  name: string;
  password: string;
}

async function isFirstUserById(userId: string): Promise<boolean> {
  const allUsers = await users.count();
  if (allUsers <= 1) return true;
  const r = await users.findById(userId);
  if (!r) return false;
  const firstCreated = await users.findFirst();
  return firstCreated?.id === userId;
}

interface LoginInput {
  email: string;
  password: string;
  userAgent?: string;
  ipAddress?: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: 'Bearer';
}

interface AuthResult {
  user: { id: string; email: string; name: string };
  tokens: TokenPair;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.toLowerCase();

  const userCount = await users.count();
  if (userCount > 0 && process.env.DISABLE_REGISTRATION === 'true') {
    throw new UnauthorizedError('Registration is disabled');
  }

  const passwordHash = await hashPassword(input.password);
  const created = await users.create({ email, name: input.name, passwordHash });
  if (!created) {
    throw new ConflictError('A user with that email already exists');
  }
  const tokens = await issueTokenPair(created.id);
  const isFirstUser = userCount === 0;
  log.info({ userId: created.id, isFirstUser, role: isFirstUser ? 'owner' : 'member' }, 'user registered');
  return {
    user: { id: created.id, email: created.email, name: created.name },
    tokens,
  };
}

export async function loginUser(input: LoginInput): Promise<AuthResult> {
  const email = input.email.toLowerCase();
  const user = await users.findByEmail(email);
  if (!user || !user.isActive) {
    await verifyPassword(input.password, '$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid');
    throw new InvalidCredentialsError();
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw new InvalidCredentialsError();
  const tokens = await issueTokenPair(user.id, input.userAgent, input.ipAddress);
  log.info({ userId: user.id }, 'user logged in');
  return {
    user: { id: user.id, email: user.email, name: user.name },
    tokens,
  };
}

export async function refreshTokens(
  refreshToken: string,
  meta?: { userAgent?: string; ipAddress?: string },
): Promise<TokenPair> {
  if (!refreshToken || refreshToken.length < 32) {
    throw new InvalidTokenError('Invalid refresh token');
  }
  const refreshHash = hashRefreshToken(refreshToken);
  const userAgent = meta?.userAgent;
  const ipAddress = meta?.ipAddress;

  const claimed = await sessionsRepo.atomicConsumeByHash(refreshHash);
  if (!claimed) {
    await handleReuseDetection(refreshHash, refreshToken);
    throw new InvalidTokenError('Refresh token not recognized or already used');
  }
  if (!verifyRefreshToken(refreshToken, claimed.refreshTokenHash)) {
    throw new InvalidTokenError('Refresh token hash mismatch');
  }

  return issueTokenPair(
    claimed.userId,
    userAgent,
    ipAddress,
    claimed.id,
  );
}

async function handleReuseDetection(refreshHash: string, refreshTokenPlain: string): Promise<void> {
  const prior = await sessionsRepo.findByRefreshHashIncludingRevoked(refreshHash);
  if (!prior) return;
  if (!verifyRefreshToken(refreshTokenPlain, prior.refreshTokenHash)) return;
  log.warn(
    { userId: prior.userId, sessionId: prior.id },
    'refresh token reuse detected; revoking all sessions for user',
  );
  await sessionsRepo.revokeAllForUser(prior.userId);
}

export async function logout(sessionId: string): Promise<void> {
  await sessionsRepo.revoke(sessionId);
}

export async function logoutAllForUser(userId: string): Promise<void> {
  await sessionsRepo.revokeAllForUser(userId);
}

async function issueTokenPair(
  userId: string,
  userAgent?: string,
  ipAddress?: string,
  parentSessionId?: string,
): Promise<TokenPair> {
  const cfg = loadConfig();
  const refresh = generateRefreshToken();
  const session = await sessionsRepo.create({
    userId,
    refreshTokenHash: refresh.hash,
    ...(userAgent !== undefined ? { userAgent } : {}),
    ...(ipAddress !== undefined ? { ipAddress } : {}),
    ...(parentSessionId !== undefined ? { parentSessionId } : {}),
    expiresAt: new Date(Date.now() + cfg.JWT_REFRESH_TTL * 1000),
  });
  return {
    accessToken: signAccessToken(userId, session.id),
    refreshToken: refresh.plaintext,
    expiresIn: cfg.JWT_ACCESS_TTL,
    tokenType: 'Bearer',
  };
}

export async function resolveAuthFromAccessToken(token: string): Promise<AuthContext> {
  const payload = verifyAccessToken(token);
  const user = await users.findById(payload.sub);
  if (!user || !user.isActive) {
    throw new UnauthorizedError('User not found or inactive');
  }
  if (payload.sid) {
    const sessionState = await sessionsRepo.getState(payload.sid);
    if (!sessionState) {
      throw new UnauthorizedError('Session not found');
    }
    if (sessionState.revoked) {
      throw new UnauthorizedError('Session revoked');
    }
    if (sessionState.userId !== user.id) {
      throw new UnauthorizedError('Session/user mismatch');
    }
  }
  const isFirstUser = await isFirstUserById(user.id);
  const role = isFirstUser ? 'owner' : 'member';
  return {
    userId: user.id,
    ...(payload.sid ? { sessionId: payload.sid } : {}),
    role,
    permissions: getPermissionsForRole(role),
  };
}

export async function resolveAuthFromApiKey(plaintextKey: string): Promise<AuthContext> {
  const hash = hashApiKey(plaintextKey);
  const key = await apiKeys.findByHash(hash);
  if (!key) throw new UnauthorizedError('Invalid API key');
  if (!verifyApiKeyHash(plaintextKey, key.keyHash)) {
    throw new UnauthorizedError('Invalid API key');
  }
  void apiKeys.touchLastUsed(key.id);
  const requested = (key.scopes ?? []).filter((s): s is Permission =>
    (getPermissionsForRole('owner') as readonly string[]).includes(s),
  );
  const permissions: readonly Permission[] = requested;
  return {
    userId: key.userId,
    apiKeyId: key.id,
    ...(key.workspaceId ? { workspaceId: key.workspaceId } : {}),
    permissions,
  };
}

export async function resolveWorkspaceContext(
  userId: string,
  workspaceId: string,
  options?: { apiKeyPermissions?: readonly Permission[]; apiKeyId?: string },
): Promise<AuthContext> {
  const ws = await wsRepo.findById(workspaceId);
  if (!ws) throw new NotFoundError('Workspace', workspaceId);
  const m = await members.findMembership(workspaceId, userId);
  if (!m) throw new UnauthorizedError('Not a member of this workspace', { reason: 'NOT_A_MEMBER' });
  if (options?.apiKeyPermissions !== undefined) {
    return {
      userId,
      workspaceId,
      role: m.role,
      apiKeyId: options.apiKeyId,
      permissions: options.apiKeyPermissions,
    };
  }
  return {
    userId,
    workspaceId,
    role: m.role,
    permissions: getPermissionsForRole(m.role),
  };
}

interface CreateApiKeyInput {
  userId: string;
  workspaceId?: string;
  name: string;
  scopes?: readonly Permission[];
  expiresAt?: Date;
}

export async function createApiKey(
  input: CreateApiKeyInput,
): Promise<{ id: string; plaintext: string; keyPrefix: string; createdAt: Date }> {
  if (input.workspaceId) {
    const membership = await members.findMembership(input.workspaceId, input.userId);
    if (!membership) {
      throw new UnauthorizedError('Cannot create a workspace-scoped key without membership');
    }
  }
  const generated = generateApiKey();
  const created = await apiKeys.create({
    userId: input.userId,
    workspaceId: input.workspaceId ?? null,
    name: input.name,
    keyHash: generated.hash,
    keyPrefix: generated.keyPrefix,
    scopes: [...(input.scopes ?? [])],
    expiresAt: input.expiresAt ?? null,
  });
  return {
    id: created.id,
    plaintext: generated.plaintext,
    keyPrefix: generated.keyPrefix,
    createdAt: created.createdAt,
  };
}

export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const ok = await apiKeys.revoke(keyId, userId);
  if (!ok) throw new NotFoundError('API key', keyId);
}
