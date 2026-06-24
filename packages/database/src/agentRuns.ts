import { query } from './client.js';

export interface AgentRun {
  id: string;
  agentId: string;
  userId: string | null;
  workspaceId: string | null;
  apiKeyId: string | null;
  prompt: string;
  status: string;
  maxSteps: number;
  currentStep: number;
  tokenBudget: number | null;
  tokensUsed: number;
  forbiddenTools: string[] | null;
  finalAnswer: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentStep {
  id: string;
  runId: string;
  stepIndex: number;
  status: string;
  thought: string | null;
  plan: string | null;
  actionName: string | null;
  actionParams: Record<string, unknown> | null;
  observationSuccess: boolean | null;
  observationData: Record<string, unknown> | null;
  observationError: string | null;
  reflection: string | null;
  tokensUsed: number | null;
  latencyMs: number | null;
  createdAt: Date;
  updatedAt: Date;
}

function mapRun(row: Record<string, unknown>): AgentRun {
  return {
    id: row.id as string,
    agentId: row.agent_id as string,
    userId: (row.user_id as string | null) ?? null,
    workspaceId: (row.workspace_id as string | null) ?? null,
    apiKeyId: (row.api_key_id as string | null) ?? null,
    prompt: row.prompt as string,
    status: row.status as string,
    maxSteps: Number(row.max_steps),
    currentStep: Number(row.current_step),
    tokenBudget: row.token_budget !== null ? Number(row.token_budget) : null,
    tokensUsed: Number(row.tokens_used),
    forbiddenTools: (row.forbidden_tools as string[] | null) ?? null,
    finalAnswer: (row.final_answer as string | null) ?? null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

function mapStep(row: Record<string, unknown>): AgentStep {
  return {
    id: row.id as string,
    runId: row.run_id as string,
    stepIndex: Number(row.step_index),
    status: row.status as string,
    thought: (row.thought as string | null) ?? null,
    plan: (row.plan as string | null) ?? null,
    actionName: (row.action_name as string | null) ?? null,
    actionParams: (row.action_params as Record<string, unknown> | null) ?? null,
    observationSuccess: (row.observation_success as boolean | null) ?? null,
    observationData: (row.observation_data as Record<string, unknown> | null) ?? null,
    observationError: (row.observation_error as string | null) ?? null,
    reflection: (row.reflection as string | null) ?? null,
    tokensUsed: row.tokens_used !== null ? Number(row.tokens_used) : null,
    latencyMs: row.latency_ms !== null ? Number(row.latency_ms) : null,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export const agentRuns = {
  async create(input: {
    agentId: string;
    prompt: string;
    userId?: string;
    workspaceId?: string;
    apiKeyId?: string;
    maxSteps?: number;
    tokenBudget?: number;
    forbiddenTools?: string[];
  }): Promise<AgentRun> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO agent_runs
         (agent_id, user_id, workspace_id, api_key_id, prompt, max_steps, token_budget, forbidden_tools)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.agentId,
        input.userId ?? null,
        input.workspaceId ?? null,
        input.apiKeyId ?? null,
        input.prompt,
        input.maxSteps ?? 10,
        input.tokenBudget ?? null,
        input.forbiddenTools ?? null,
      ],
    );
    return mapRun(r.rows[0]!);
  },

  async findById(id: string): Promise<AgentRun | null> {
    const r = await query<Record<string, unknown>>('SELECT * FROM agent_runs WHERE id = $1', [id]);
    return r.rows[0] ? mapRun(r.rows[0]) : null;
  },

  async listForAgent(agentId: string, opts?: { limit?: number; offset?: number }): Promise<AgentRun[]> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM agent_runs WHERE agent_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [agentId, limit, offset],
    );
    return r.rows.map(mapRun);
  },

  async listForUser(userId: string, opts?: { limit?: number; offset?: number }): Promise<AgentRun[]> {
    const limit = opts?.limit ?? 20;
    const offset = opts?.offset ?? 0;
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM agent_runs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );
    return r.rows.map(mapRun);
  },

  async listRecent(limit: number = 20): Promise<AgentRun[]> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM agent_runs ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return r.rows.map(mapRun);
  },

  async updateStatus(
    id: string,
    status: string,
    patch?: { currentStep?: number; tokensUsed?: number; finalAnswer?: string },
  ): Promise<AgentRun | null> {
    const fields: string[] = ['status = $1', 'updated_at = now()'];
    const values: unknown[] = [status];
    let i = 2;

    if (patch?.currentStep !== undefined) {
      fields.push(`current_step = $${i++}`);
      values.push(patch.currentStep);
    }
    if (patch?.tokensUsed !== undefined) {
      fields.push(`tokens_used = $${i++}`);
      values.push(patch.tokensUsed);
    }
    if (patch?.finalAnswer !== undefined) {
      fields.push(`final_answer = $${i++}`);
      values.push(patch.finalAnswer);
    }
    values.push(id);

    const r = await query<Record<string, unknown>>(
      `UPDATE agent_runs SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return r.rows[0] ? mapRun(r.rows[0]) : null;
  },
};

export const agentSteps = {
  async create(input: {
    runId: string;
    stepIndex: number;
    status?: string;
    thought?: string;
    plan?: string;
    actionName?: string;
    actionParams?: Record<string, unknown>;
    observationSuccess?: boolean;
    observationData?: Record<string, unknown>;
    observationError?: string;
    reflection?: string;
    tokensUsed?: number;
    latencyMs?: number;
  }): Promise<AgentStep> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO agent_steps
         (run_id, step_index, status, thought, plan, action_name, action_params,
          observation_success, observation_data, observation_error, reflection,
          tokens_used, latency_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [
        input.runId,
        input.stepIndex,
        input.status ?? 'pending',
        input.thought ?? null,
        input.plan ?? null,
        input.actionName ?? null,
        input.actionParams ?? null,
        input.observationSuccess ?? null,
        input.observationData ?? null,
        input.observationError ?? null,
        input.reflection ?? null,
        input.tokensUsed ?? null,
        input.latencyMs ?? null,
      ],
    );
    return mapStep(r.rows[0]!);
  },

  async listForRun(runId: string): Promise<AgentStep[]> {
    const r = await query<Record<string, unknown>>(
      `SELECT * FROM agent_steps WHERE run_id = $1 ORDER BY step_index ASC`,
      [runId],
    );
    return r.rows.map(mapStep);
  },

  async updateStatus(
    id: string,
    status: string,
    patch?: Partial<Omit<AgentStep, 'id' | 'runId' | 'stepIndex' | 'createdAt' | 'updatedAt'>>,
  ): Promise<AgentStep | null> {
    const fields: string[] = ['status = $1', 'updated_at = now()'];
    const values: unknown[] = [status];
    let i = 2;

    const addField = (key: string, value: unknown) => {
      fields.push(`${key} = $${i++}`);
      values.push(value);
    };

    if (patch?.thought !== undefined) addField('thought', patch.thought);
    if (patch?.plan !== undefined) addField('plan', patch.plan);
    if (patch?.actionName !== undefined) addField('action_name', patch.actionName);
    if (patch?.actionParams !== undefined) addField('action_params', patch.actionParams);
    if (patch?.observationSuccess !== undefined) addField('observation_success', patch.observationSuccess);
    if (patch?.observationData !== undefined) addField('observation_data', patch.observationData);
    if (patch?.observationError !== undefined) addField('observation_error', patch.observationError);
    if (patch?.reflection !== undefined) addField('reflection', patch.reflection);
    if (patch?.tokensUsed !== undefined) addField('tokens_used', patch.tokensUsed);
    if (patch?.latencyMs !== undefined) addField('latency_ms', patch.latencyMs);

    values.push(id);

    const r = await query<Record<string, unknown>>(
      `UPDATE agent_steps SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values,
    );
    return r.rows[0] ? mapStep(r.rows[0]) : null;
  },
};
