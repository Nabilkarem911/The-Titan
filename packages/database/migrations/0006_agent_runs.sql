-- =============================================================================
-- 0006 - Agent Engine Schema (agent_runs, agent_steps)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_runs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       TEXT NOT NULL,
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  api_key_id     UUID REFERENCES api_keys(id) ON DELETE SET NULL,
  prompt         TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed')),
  max_steps      INTEGER NOT NULL DEFAULT 10,
  current_step   INTEGER NOT NULL DEFAULT 0,
  token_budget   INTEGER,
  tokens_used    INTEGER NOT NULL DEFAULT 0,
  forbidden_tools TEXT[],
  final_answer   TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS agent_runs_user_idx
  ON agent_runs (user_id, created_at DESC)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_runs_workspace_idx
  ON agent_runs (workspace_id, created_at DESC)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_runs_status_idx
  ON agent_runs (status, created_at DESC);

CREATE TABLE IF NOT EXISTS agent_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id        UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
  step_index    INTEGER NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'planning', 'executing', 'observing', 'reflecting', 'completed', 'failed')),
  thought       TEXT,
  plan          TEXT,
  action_name   TEXT,
  action_params JSONB,
  observation_success BOOLEAN,
  observation_data    JSONB,
  observation_error   TEXT,
  reflection    TEXT,
  tokens_used   INTEGER,
  latency_ms    INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (run_id, step_index)
);

CREATE INDEX IF NOT EXISTS agent_steps_run_idx
  ON agent_steps (run_id, step_index);
