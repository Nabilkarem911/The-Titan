type UserId = string;
type WorkspaceId = string;
type SessionId = string;
type ApiKeyId = string;
type WorkspaceMemberId = string;
type PluginId = string;
type PluginVersionId = string;

export interface User {
  id: UserId;
  email: string;
  name: string;
  passwordHash: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type PublicUser = Omit<User, 'passwordHash'>;

export interface Workspace {
  id: WorkspaceId;
  name: string;
  slug: string;
  description: string | null;
  ownerId: UserId;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkspaceMember {
  id: WorkspaceMemberId;
  workspaceId: WorkspaceId;
  userId: UserId;
  role: string;
  createdAt: Date;
}

export interface Session {
  id: SessionId;
  userId: UserId;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  parentSessionId: SessionId | null;
  createdAt: Date;
}

export interface ApiKey {
  id: ApiKeyId;
  userId: UserId;
  workspaceId: WorkspaceId | null;
  name: string;
  keyHash: string;
  keyPrefix: string;
  scopes: string[];
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  actorId: UserId | null;
  workspaceId: WorkspaceId | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export interface AuthContext {
  userId: UserId;
  sessionId?: SessionId;
  apiKeyId?: ApiKeyId;
  workspaceId?: WorkspaceId;
  role?: string;
  permissions: readonly string[];
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  total: number;
}

export interface Plugin {
  id: PluginId;
  name: string;
  description: string | null;
  author: string | null;
  source: 'registry' | 'local' | 'marketplace';
  status: 'enabled' | 'disabled' | 'error';
  tags: string[];
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginVersion {
  id: PluginVersionId;
  pluginId: PluginId;
  version: string;
  manifest: Record<string, unknown>;
  entrypoint: string | null;
  checksum: string;
  signature: string | null;
  status: 'draft' | 'published' | 'deprecated';
  createdAt: Date;
}

export interface PluginRating {
  id: string;
  pluginId: PluginId;
  userId: UserId | null;
  rating: number;
  review: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PluginInstall {
  id: string;
  pluginId: PluginId;
  workspaceId: WorkspaceId | null;
  version: string | null;
  installedAt: Date;
  updatedAt: Date;
}
