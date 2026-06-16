import { query } from './client.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'webhooks-repo' });

export interface WebhookRecord {
  id: string;
  ownerId: string;
  workspaceId: string | null;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isActive: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

function mapRow(row: Record<string, unknown>): WebhookRecord {
  return {
    id: row.id as string,
    ownerId: row.owner_id as string,
    workspaceId: (row.workspace_id as string | null) ?? null,
    name: row.name as string,
    url: row.url as string,
    secret: row.secret as string,
    events: (row.events as string[]) ?? ['*'],
    isActive: row.is_active as boolean,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export const webhooks = {
  async create(input: {
    ownerId: string;
    workspaceId?: string;
    name: string;
    url: string;
    secret: string;
    events?: string[];
  }): Promise<WebhookRecord> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO webhooks (owner_id, workspace_id, name, url, secret, events)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.ownerId, input.workspaceId ?? null, input.name, input.url, input.secret, JSON.stringify(input.events ?? ['*'])],
    );
    log.info({ id: r.rows[0].id, name: input.name }, 'webhook created');
    return mapRow(r.rows[0]);
  },

  async findById(id: string): Promise<WebhookRecord | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM webhooks WHERE id = $1',
      [id],
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },

  async listForOwner(ownerId: string): Promise<WebhookRecord[]> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM webhooks WHERE owner_id = $1 ORDER BY created_at DESC',
      [ownerId],
    );
    return r.rows.map(mapRow);
  },

  async update(id: string, patch: {
    name?: string;
    url?: string;
    events?: string[];
    isActive?: boolean;
  }): Promise<WebhookRecord | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (patch.name !== undefined) { fields.push(`name = $${i++}`); values.push(patch.name); }
    if (patch.url !== undefined) { fields.push(`url = $${i++}`); values.push(patch.url); }
    if (patch.events !== undefined) { fields.push(`events = $${i++}`); values.push(JSON.stringify(patch.events)); }
    if (patch.isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(patch.isActive); }
    if (fields.length === 0) return this.findById(id);
    fields.push('updated_at = now()');
    values.push(id);
    const r = await query<Record<string, unknown>>(
      `UPDATE webhooks SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },

  async rotateSecret(id: string, newSecret: string): Promise<WebhookRecord | null> {
    const r = await query<Record<string, unknown>>(
      'UPDATE webhooks SET secret = $1, updated_at = now() WHERE id = $2 RETURNING *',
      [newSecret, id],
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },

  async delete(id: string): Promise<boolean> {
    const r = await query('DELETE FROM webhooks WHERE id = $1', [id]);
    return (r.rowCount ?? 0) > 0;
  },
};
