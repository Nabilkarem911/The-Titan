import { query } from './client.js';
import type { Plugin, PluginVersion } from '@titan/shared';

function mapPlugin(row: Record<string, unknown>): Plugin {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string | null) ?? null,
    author: (row.author as string | null) ?? null,
    source: row.source as 'registry' | 'local' | 'marketplace',
    status: row.status as 'enabled' | 'disabled' | 'error',
    tags: (row.tags as string[] | null) ?? [],
    capabilities: (row.capabilities as string[] | null) ?? [],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapVersion(row: Record<string, unknown>): PluginVersion {
  return {
    id: row.id as string,
    pluginId: row.plugin_id as string,
    version: row.version as string,
    manifest: (row.manifest as Record<string, unknown> | null) ?? {},
    entrypoint: (row.entrypoint as string | null) ?? null,
    checksum: row.checksum as string,
    signature: (row.signature as string | null) ?? null,
    status: row.status as 'draft' | 'published' | 'deprecated',
    createdAt: new Date(row.created_at as string),
  };
}

export const plugins = {
  async findById(id: string): Promise<Plugin | null> {
    const r = await query<Record<string, unknown>>('SELECT * FROM plugins WHERE id = $1', [id]);
    return r.rows[0] ? mapPlugin(r.rows[0]) : null;
  },

  async findByName(name: string): Promise<Plugin | null> {
    const r = await query<Record<string, unknown>>('SELECT * FROM plugins WHERE name = $1', [name]);
    return r.rows[0] ? mapPlugin(r.rows[0]) : null;
  },

  async list(opts?: { status?: string; tag?: string; limit?: number; offset?: number }): Promise<{ items: Plugin[]; total: number }> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (opts?.status) {
      conditions.push(`status = $${paramIdx++}`);
      params.push(opts.status);
    }
    if (opts?.tag) {
      conditions.push(`$${paramIdx++} = ANY(tags)`);
      params.push(opts.tag);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = opts?.limit ?? 100;
    const offset = opts?.offset ?? 0;

    const countR = await query<Record<string, unknown>>(`SELECT COUNT(*) as c FROM plugins ${where}`, params);
    const total = Number(countR.rows[0].c);

    const limitIdx = paramIdx;
    const offsetIdx = paramIdx + 1;
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM plugins ${where} ORDER BY updated_at DESC LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      [...params, limit, offset],
    );

    return { items: r.rows.map(mapPlugin), total };
  },

  async create(input: {
    name: string;
    description?: string;
    author?: string;
    source?: string;
    tags?: string[];
    capabilities?: string[];
  }): Promise<Plugin> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO plugins (name, description, author, source, tags, capabilities)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.name, input.description ?? null, input.author ?? null, input.source ?? 'local', input.tags ?? [], input.capabilities ?? []],
    );
    return mapPlugin(r.rows[0]);
  },

  async updateStatus(id: string, status: string): Promise<Plugin | null> {
    const r = await query<Record<string, unknown>>(
      `UPDATE plugins SET status = $1, updated_at = now() WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return r.rows[0] ? mapPlugin(r.rows[0]) : null;
  },

  async deleteById(id: string): Promise<boolean> {
    const r = await query<Record<string,unknown>>('DELETE FROM plugins WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  },
};

export const pluginVersions = {
  async findById(id: string): Promise<PluginVersion | null> {
    const r = await query<Record<string, unknown>>('SELECT * FROM plugin_versions WHERE id = $1', [id]);
    return r.rows[0] ? mapVersion(r.rows[0]) : null;
  },

  async findByPlugin(pluginId: string): Promise<PluginVersion[]> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM plugin_versions WHERE plugin_id = $1 ORDER BY version DESC',
      [pluginId],
    );
    return r.rows.map(mapVersion);
  },

  async create(input: {
    pluginId: string;
    version: string;
    manifest: Record<string, unknown>;
    entrypoint?: string;
    checksum: string;
    signature?: string;
  }): Promise<PluginVersion> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO plugin_versions (plugin_id, version, manifest, entrypoint, checksum, signature)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.pluginId, input.version, JSON.stringify(input.manifest), input.entrypoint ?? null, input.checksum, input.signature ?? null],
    );
    return mapVersion(r.rows[0]);
  },

  async updateStatus(id: string, status: string): Promise<PluginVersion | null> {
    const r = await query<Record<string, unknown>>(
      `UPDATE plugin_versions SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id],
    );
    return r.rows[0] ? mapVersion(r.rows[0]) : null;
  },
};
