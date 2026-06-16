import { query } from './client.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'agent-profiles' });

export interface AgentProfile {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  systemPrompt: string;
  model: string | null;
  allowedTools: string[];
  forbiddenTools: string[];
  maxSteps: number;
  temperature: number | null;
  ownerId: string;
  workspaceId: string | null;
  isPublic: boolean;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface CreateAgentProfileInput {
  name: string;
  slug: string;
  description?: string;
  systemPrompt?: string;
  model?: string;
  allowedTools?: string[];
  forbiddenTools?: string[];
  maxSteps?: number;
  temperature?: number;
  ownerId: string;
  workspaceId?: string;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

interface UpdateAgentProfileInput {
  name?: string;
  slug?: string;
  description?: string | null;
  systemPrompt?: string;
  model?: string | null;
  allowedTools?: string[];
  forbiddenTools?: string[];
  maxSteps?: number;
  temperature?: number | null;
  isPublic?: boolean;
  metadata?: Record<string, unknown>;
}

interface DbRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  system_prompt: string;
  model: string | null;
  allowed_tools: string[] | null;
  forbidden_tools: string[] | null;
  max_steps: number;
  temperature: number | null;
  owner_id: string;
  workspace_id: string | null;
  is_public: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

function mapRow(row: DbRow): AgentProfile {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    systemPrompt: row.system_prompt,
    model: row.model,
    allowedTools: row.allowed_tools ?? [],
    forbiddenTools: row.forbidden_tools ?? [],
    maxSteps: row.max_steps,
    temperature: row.temperature,
    ownerId: row.owner_id,
    workspaceId: row.workspace_id,
    isPublic: row.is_public,
    metadata: row.metadata ?? {},
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export const agentProfiles = {
  async create(input: CreateAgentProfileInput): Promise<AgentProfile> {
    const r = await query<DbRow>(
      `INSERT INTO agent_profiles (name, slug, description, system_prompt, model, allowed_tools, forbidden_tools, max_steps, temperature, owner_id, workspace_id, is_public, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.name,
        input.slug,
        input.description ?? null,
        input.systemPrompt ?? 'أنت تايتن — شريك ذكي وصديق حقيقي. بتتكلم بطريقة طبيعية وبتفهم اللي قدامك من نص كلمة.',
        input.model ?? null,
        input.allowedTools ?? [],
        input.forbiddenTools ?? [],
        input.maxSteps ?? 10,
        input.temperature ?? null,
        input.ownerId,
        input.workspaceId ?? null,
        input.isPublic ?? false,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
    log.info({ id: r.rows[0].id, name: input.name }, 'agent profile created');
    return mapRow(r.rows[0]);
  },

  async findById(id: string): Promise<AgentProfile | null> {
    const r = await query<DbRow>(
      `SELECT * FROM agent_profiles WHERE id = $1`,
      [id],
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },

  async findBySlug(ownerId: string, slug: string): Promise<AgentProfile | null> {
    const r = await query<DbRow>(
      `SELECT * FROM agent_profiles WHERE owner_id = $1 AND slug = $2`,
      [ownerId, slug],
    );
    return r.rows[0] ? mapRow(r.rows[0]) : null;
  },

  async listForOwner(ownerId: string, opts?: { limit?: number; offset?: number }): Promise<AgentProfile[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const r = await query<DbRow>(
      `SELECT * FROM agent_profiles WHERE owner_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [ownerId, limit, offset],
    );
    return r.rows.map(mapRow);
  },

  async listForWorkspace(workspaceId: string, opts?: { limit?: number; offset?: number }): Promise<AgentProfile[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const r = await query<DbRow>(
      `SELECT * FROM agent_profiles WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [workspaceId, limit, offset],
    );
    return r.rows.map(mapRow);
  },

  async listPublic(opts?: { limit?: number; offset?: number }): Promise<AgentProfile[]> {
    const limit = opts?.limit ?? 50;
    const offset = opts?.offset ?? 0;
    const r = await query<DbRow>(
      `SELECT * FROM agent_profiles WHERE is_public = true ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    return r.rows.map(mapRow);
  },

  async update(id: string, input: UpdateAgentProfileInput): Promise<AgentProfile | null> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) { sets.push(`name = $${idx++}`); vals.push(input.name); }
    if (input.slug !== undefined) { sets.push(`slug = $${idx++}`); vals.push(input.slug); }
    if (input.description !== undefined) { sets.push(`description = $${idx++}`); vals.push(input.description); }
    if (input.systemPrompt !== undefined) { sets.push(`system_prompt = $${idx++}`); vals.push(input.systemPrompt); }
    if (input.model !== undefined) { sets.push(`model = $${idx++}`); vals.push(input.model); }
    if (input.allowedTools !== undefined) { sets.push(`allowed_tools = $${idx++}`); vals.push(input.allowedTools); }
    if (input.forbiddenTools !== undefined) { sets.push(`forbidden_tools = $${idx++}`); vals.push(input.forbiddenTools); }
    if (input.maxSteps !== undefined) { sets.push(`max_steps = $${idx++}`); vals.push(input.maxSteps); }
    if (input.temperature !== undefined) { sets.push(`temperature = $${idx++}`); vals.push(input.temperature); }
    if (input.isPublic !== undefined) { sets.push(`is_public = $${idx++}`); vals.push(input.isPublic); }
    if (input.metadata !== undefined) { sets.push(`metadata = $${idx++}`); vals.push(JSON.stringify(input.metadata)); }

    if (sets.length === 0) return this.findById(id);

    sets.push(`updated_at = now()`);
    vals.push(id);

    const r = await query<DbRow>(
      `UPDATE agent_profiles SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`,
      vals,
    );
    if (!r.rows[0]) return null;
    log.info({ id }, 'agent profile updated');
    return mapRow(r.rows[0]);
  },

  async delete(id: string): Promise<boolean> {
    const r = await query(
      `DELETE FROM agent_profiles WHERE id = $1`,
      [id],
    );
    if (r.rowCount && r.rowCount > 0) {
      log.info({ id }, 'agent profile deleted');
      return true;
    }
    return false;
  },
};
