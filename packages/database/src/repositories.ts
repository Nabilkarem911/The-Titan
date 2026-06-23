import type { PoolClient } from 'pg';
import { query, withTransaction } from './client.js';
import { appendWithHashChain } from './audit-integrity.js';
import type { User, PublicUser, Workspace, WorkspaceMember, Session, ApiKey } from '@titan/shared';

function mapUser(row: Record<string, unknown>): PublicUser {
  return {
    id: row.id as string,
    email: row.email as string,
    name: row.name as string,
    isActive: row.is_active as boolean,
    isSystem: row.is_system as boolean,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapWorkspace(row: Record<string, unknown>): Workspace {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    description: (row.description as string | null) ?? null,
    ownerId: row.owner_id as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export const users = {
  async findById(id: string): Promise<PublicUser | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM users WHERE email = $1 AND deleted_at IS NULL',
      [email.toLowerCase()],
    );
    if (!r.rows[0]) return null;
    const u = mapUser(r.rows[0]);
    return { ...u, passwordHash: r.rows[0].password_hash as string };
  },

  async create(input: {
    email: string;
    name: string;
    passwordHash: string;
  }): Promise<PublicUser | null> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO users (email, name, password_hash)
       VALUES ($1, $2, $3)
       ON CONFLICT (lower(email)) WHERE deleted_at IS NULL DO NOTHING
       RETURNING *`,
      [input.email.toLowerCase(), input.name, input.passwordHash],
    );
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  },

  async updatePassword(id: string, passwordHash: string): Promise<void> {
    await query('UPDATE users SET password_hash = $1, updated_at = now() WHERE id = $2', [
      passwordHash,
      id,
    ]);
  },

  async setActive(id: string, active: boolean): Promise<void> {
    await query('UPDATE users SET is_active = $1, updated_at = now() WHERE id = $2', [
      active,
      id,
    ]);
  },

  async count(): Promise<number> {
    const r = await query<{ c: string }>('SELECT count(*)::text AS c FROM users WHERE deleted_at IS NULL');
    return Number(r.rows[0]?.c ?? 0);
  },

  async findFirst(): Promise<PublicUser | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM users WHERE deleted_at IS NULL ORDER BY created_at ASC LIMIT 1',
    );
    return r.rows[0] ? mapUser(r.rows[0]) : null;
  },
};

export const workspaces = {
  async findById(id: string): Promise<Workspace | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM workspaces WHERE id = $1 AND deleted_at IS NULL',
      [id],
    );
    return r.rows[0] ? mapWorkspace(r.rows[0]) : null;
  },

  async findBySlug(slug: string): Promise<Workspace | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM workspaces WHERE slug = $1 AND deleted_at IS NULL',
      [slug],
    );
    return r.rows[0] ? mapWorkspace(r.rows[0]) : null;
  },

  async listForUser(userId: string): Promise<Workspace[]> {
    const r = await query<Record<string, unknown>>(
      `SELECT w.* FROM workspaces w
       INNER JOIN workspace_members m ON m.workspace_id = w.id
       WHERE m.user_id = $1 AND w.deleted_at IS NULL
       ORDER BY w.created_at DESC`,
      [userId],
    );
    return r.rows.map(mapWorkspace);
  },

  async create(input: {
    name: string;
    slug: string;
    description?: string;
    ownerId: string;
  }): Promise<Workspace> {
    return withTransaction(async (client: PoolClient) => {
      const r = await client.query<Record<string, unknown>>(
        `INSERT INTO workspaces (name, slug, description, owner_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.name, input.slug, input.description ?? null, input.ownerId],
      );
      const ws = mapWorkspace(r.rows[0]);
      await client.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'owner')`,
        [ws.id, input.ownerId],
      );
      return ws;
    });
  },

  async update(
    id: string,
    patch: { name?: string; description?: string },
  ): Promise<Workspace | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (patch.name !== undefined) {
      fields.push(`name = $${i++}`);
      values.push(patch.name);
    }
    if (patch.description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(patch.description);
    }
    if (fields.length === 0) return this.findById(id);
    fields.push(`updated_at = now()`);
    values.push(id);
    const r = await query<Record<string, unknown>>(
      `UPDATE workspaces SET ${fields.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      values,
    );
    return r.rows[0] ? mapWorkspace(r.rows[0]) : null;
  },

  async softDelete(id: string): Promise<void> {
    await query('UPDATE workspaces SET deleted_at = now() WHERE id = $1', [id]);
  },
};

export const members = {
  async findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | null> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, userId],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      role: row.role as string,
      createdAt: new Date(row.created_at as string),
    };
  },

  async add(workspaceId: string, userId: string, role: string): Promise<WorkspaceMember> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO workspace_members (workspace_id, user_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role
       RETURNING *`,
      [workspaceId, userId, role],
    );
    const row = r.rows[0];
    return {
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      role: row.role as string,
      createdAt: new Date(row.created_at as string),
    };
  },

  async remove(workspaceId: string, userId: string): Promise<void> {
    await query(
      'DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId],
    );
  },

  async list(workspaceId: string): Promise<Array<WorkspaceMember & { email: string; name: string }>> {
    const r = await query<Record<string, unknown>>(
      `SELECT m.*, u.email, u.name
       FROM workspace_members m
       INNER JOIN users u ON u.id = m.user_id
       WHERE m.workspace_id = $1
       ORDER BY m.created_at ASC`,
      [workspaceId],
    );
    return r.rows.map((row) => ({
      id: row.id as string,
      workspaceId: row.workspace_id as string,
      userId: row.user_id as string,
      role: row.role as string,
      createdAt: new Date(row.created_at as string),
      email: row.email as string,
      name: row.name as string,
    }));
  },
};

export const sessions = {
  async create(input: {
    userId: string;
    refreshTokenHash: string;
    userAgent?: string;
    ipAddress?: string;
    expiresAt: Date;
    parentSessionId?: string;
  }): Promise<Session> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at, parent_session_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.userId,
        input.refreshTokenHash,
        input.userAgent ?? null,
        input.ipAddress ?? null,
        input.expiresAt,
        input.parentSessionId ?? null,
      ],
    );
    return mapSession(r.rows[0]);
  },

  async findByRefreshHash(hash: string): Promise<Session | null> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM sessions
       WHERE refresh_token_hash = $1 AND revoked_at IS NULL AND expires_at > now()`,
      [hash],
    );
    return r.rows[0] ? mapSession(r.rows[0]) : null;
  },

  async findByRefreshHashIncludingRevoked(hash: string): Promise<Session | null> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM sessions
       WHERE refresh_token_hash = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [hash],
    );
    return r.rows[0] ? mapSession(r.rows[0]) : null;
  },

  async atomicConsumeByHash(hash: string): Promise<Session | null> {
    const r = await query<Record<string, unknown>>(
      `UPDATE sessions
         SET revoked_at = now()
       WHERE refresh_token_hash = $1
         AND revoked_at IS NULL
         AND expires_at > now()
       RETURNING *`,
      [hash],
    );
    return r.rows[0] ? mapSession(r.rows[0]) : null;
  },

  async getState(
    id: string,
  ): Promise<{ userId: string; revoked: boolean } | null> {
    const r = await query<Record<string, unknown>>(
      `SELECT user_id, revoked_at FROM sessions WHERE id = $1`,
      [id],
    );
    if (!r.rows[0]) return null;
    return {
      userId: r.rows[0].user_id as string,
      revoked: r.rows[0].revoked_at !== null,
    };
  },

  async revoke(id: string): Promise<void> {
    await query('UPDATE sessions SET revoked_at = now() WHERE id = $1', [id]);
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await query('UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [
      userId,
    ]);
  },
};

function mapSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    refreshTokenHash: row.refresh_token_hash as string,
    userAgent: (row.user_agent as string | null) ?? null,
    ipAddress: (row.ip_address as string | null) ?? null,
    expiresAt: new Date(row.expires_at as string),
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
    parentSessionId: (row.parent_session_id as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
  };
}

export const apiKeys = {
  async create(input: {
    userId: string;
    workspaceId: string | null;
    name: string;
    keyHash: string;
    keyPrefix: string;
    scopes: string[];
    expiresAt: Date | null;
  }): Promise<ApiKey> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO api_keys (user_id, workspace_id, name, key_hash, key_prefix, scopes, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.userId,
        input.workspaceId,
        input.name,
        input.keyHash,
        input.keyPrefix,
        JSON.stringify(input.scopes),
        input.expiresAt,
      ],
    );
    return mapApiKey(r.rows[0]);
  },

  async findByHash(hash: string): Promise<ApiKey | null> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM api_keys
       WHERE key_hash = $1 AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > now())`,
      [hash],
    );
    return r.rows[0] ? mapApiKey(r.rows[0]) : null;
  },

  async touchLastUsed(id: string): Promise<void> {
    await query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [id]);
  },

  async revoke(id: string, userId: string): Promise<boolean> {
    const r = await query(
      `UPDATE api_keys SET revoked_at = now()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL`,
      [id, userId],
    );
    return (r.rowCount ?? 0) > 0;
  },

  async listForUser(userId: string): Promise<ApiKey[]> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM api_keys
       WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId],
    );
    return r.rows.map(mapApiKey);
  },
};

function mapApiKey(row: Record<string, unknown>): ApiKey {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    name: row.name as string,
    keyHash: row.key_hash as string,
    keyPrefix: row.key_prefix as string,
    scopes: Array.isArray(row.scopes) ? (row.scopes as string[]) : [],
    expiresAt: row.expires_at ? new Date(row.expires_at as string) : null,
    lastUsedAt: row.last_used_at ? new Date(row.last_used_at as string) : null,
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string) : null,
    createdAt: new Date(row.created_at as string),
  };
}

export const audit = {
  async write(input: {
    actorId: string | null;
    workspaceId: string | null;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO audit.logs
         (actor_id, workspace_id, action, resource, resource_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        input.actorId,
        input.workspaceId,
        input.action,
        input.resource ?? null,
        input.resourceId ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );
  },

  async writeChained(input: {
    actorId: string | null;
    action: string;
    resource?: string;
    resourceId?: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ id: string; hash: string }> {
    return appendWithHashChain(
      input.actorId,
      input.action,
      input.resource ?? null,
      input.resourceId ?? null,
      input.metadata ?? {},
    );
  },
};

export interface ExperienceRow {
  id: string;
  run_id: string;
  prompt: string;
  strategy: string;
  tools_used: string[];
  success: boolean;
  user_feedback: string | null;
  tokens_used: number;
  duration_ms: number;
  error_type: string | null;
  timestamp: Date;
}

export const experiences = {
  async insert(exp: {
    id: string;
    runId: string;
    prompt: string;
    strategy: string;
    toolsUsed: string[];
    success: boolean;
    userFeedback?: string | null;
    tokensUsed: number;
    durationMs: number;
    errorType?: string | null;
    timestamp: Date;
  }): Promise<void> {
    await query(
      `INSERT INTO experiences (id, run_id, prompt, strategy, tools_used, success, user_feedback, tokens_used, duration_ms, error_type, timestamp)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       ON CONFLICT (id) DO NOTHING`,
      [
        exp.id,
        exp.runId,
        exp.prompt,
        exp.strategy,
        exp.toolsUsed,
        exp.success,
        exp.userFeedback ?? null,
        exp.tokensUsed,
        exp.durationMs,
        exp.errorType ?? null,
        exp.timestamp,
      ],
    );
  },

  async getRecent(limit = 100): Promise<ExperienceRow[]> {
    const result = await query(
      `SELECT * FROM experiences ORDER BY timestamp DESC LIMIT $1`,
      [limit],
    );
    return result.rows as ExperienceRow[];
  },

  async count(): Promise<number> {
    const result = await query(`SELECT COUNT(*) as cnt FROM experiences`);
    return Number((result.rows[0] as Record<string, unknown>).cnt ?? 0);
  },
};

export interface DreamReportRow {
  id: string;
  experiences_reviewed: number;
  insights: unknown[];
  patterns: unknown[];
  recommendations: unknown[];
  strategy_adjustments: unknown[];
  health_score: number;
  created_at: Date;
}

export const dreamReports = {
  async insert(report: {
    id: string;
    experiencesReviewed: number;
    insights: unknown[];
    patterns: unknown[];
    recommendations: unknown[];
    strategyAdjustments: unknown[];
    healthScore: number;
    createdAt: Date;
  }): Promise<void> {
    await query(
      `INSERT INTO dream_reports (id, experiences_reviewed, insights, patterns, recommendations, strategy_adjustments, health_score, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        report.id,
        report.experiencesReviewed,
        JSON.stringify(report.insights),
        JSON.stringify(report.patterns),
        JSON.stringify(report.recommendations),
        JSON.stringify(report.strategyAdjustments),
        report.healthScore,
        report.createdAt,
      ],
    );
  },

  async getRecent(limit = 10): Promise<DreamReportRow[]> {
    const result = await query(
      `SELECT * FROM dream_reports ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return result.rows.map((row) => ({
      ...row,
      insights: JSON.parse(row.insights as string),
      patterns: JSON.parse(row.patterns as string),
      recommendations: JSON.parse(row.recommendations as string),
      strategy_adjustments: JSON.parse(row.strategy_adjustments as string),
    })) as DreamReportRow[];
  },
};
