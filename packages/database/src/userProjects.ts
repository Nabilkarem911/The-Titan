import { query } from './client.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'user-projects' });

export interface UserProject {
  id: string;
  ownerId: string;
  name: string;
  path: string | null;
  repoUrl: string | null;
  branch: string;
  description: string | null;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export const userProjects = {
  async set(
    ownerId: string,
    name: string,
    data: { path?: string; repoUrl?: string; branch?: string; description?: string; isDefault?: boolean },
  ): Promise<UserProject> {
    const r = await query<
      {
        id: string;
        owner_id: string;
        name: string;
        path: string | null;
        repo_url: string | null;
        branch: string;
        description: string | null;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }
    >(
      `INSERT INTO user_projects (owner_id, name, path, repo_url, branch, description, is_default, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, now())
       ON CONFLICT (owner_id, name) DO UPDATE
         SET path = COALESCE(EXCLUDED.path, user_projects.path),
             repo_url = COALESCE(EXCLUDED.repo_url, user_projects.repo_url),
             branch = COALESCE(EXCLUDED.branch, user_projects.branch),
             description = COALESCE(EXCLUDED.description, user_projects.description),
             is_default = COALESCE(EXCLUDED.is_default, user_projects.is_default),
             updated_at = now()
       RETURNING *`,
      [
        ownerId,
        name,
        data.path ?? null,
        data.repoUrl ?? null,
        data.branch ?? 'main',
        data.description ?? null,
        data.isDefault ?? false,
      ],
    );
    const row = r.rows[0];
    log.info({ ownerId, name }, 'project stored');
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      path: row.path,
      repoUrl: row.repo_url,
      branch: row.branch,
      description: row.description,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },

  async get(ownerId: string, name: string): Promise<UserProject | null> {
    const r = await query<
      {
        id: string;
        owner_id: string;
        name: string;
        path: string | null;
        repo_url: string | null;
        branch: string;
        description: string | null;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }
    >(
      `SELECT * FROM user_projects WHERE owner_id = $1 AND name = $2`,
      [ownerId, name],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      path: row.path,
      repoUrl: row.repo_url,
      branch: row.branch,
      description: row.description,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },

  async getDefault(ownerId: string): Promise<UserProject | null> {
    const r = await query<
      {
        id: string;
        owner_id: string;
        name: string;
        path: string | null;
        repo_url: string | null;
        branch: string;
        description: string | null;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }
    >(
      `SELECT * FROM user_projects WHERE owner_id = $1 AND is_default = true LIMIT 1`,
      [ownerId],
    );
    if (!r.rows[0]) return null;
    const row = r.rows[0];
    return {
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      path: row.path,
      repoUrl: row.repo_url,
      branch: row.branch,
      description: row.description,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  },

  async list(ownerId: string): Promise<UserProject[]> {
    const r = await query<
      {
        id: string;
        owner_id: string;
        name: string;
        path: string | null;
        repo_url: string | null;
        branch: string;
        description: string | null;
        is_default: boolean;
        created_at: string;
        updated_at: string;
      }
    >(
      `SELECT * FROM user_projects WHERE owner_id = $1 ORDER BY is_default DESC, name`,
      [ownerId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      ownerId: row.owner_id,
      name: row.name,
      path: row.path,
      repoUrl: row.repo_url,
      branch: row.branch,
      description: row.description,
      isDefault: row.is_default,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    }));
  },

  async delete(ownerId: string, name: string): Promise<void> {
    await query(`DELETE FROM user_projects WHERE owner_id = $1 AND name = $2`, [ownerId, name]);
    log.info({ ownerId, name }, 'project deleted');
  },
};
