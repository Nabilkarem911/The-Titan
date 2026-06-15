-- =============================================================================
-- 0011 - Agent Profiles (custom agents per user/workspace)
-- =============================================================================

CREATE TABLE IF NOT EXISTS agent_profiles (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  description    TEXT,
  system_prompt  TEXT NOT NULL DEFAULT 'You are a helpful AI assistant.',
  model          TEXT,
  allowed_tools  TEXT[],
  forbidden_tools TEXT[],
  max_steps      INTEGER NOT NULL DEFAULT 10,
  temperature    REAL,
  owner_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  workspace_id   UUID REFERENCES workspaces(id) ON DELETE SET NULL,
  is_public      BOOLEAN NOT NULL DEFAULT false,
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, slug)
);

CREATE INDEX IF NOT EXISTS agent_profiles_owner_idx
  ON agent_profiles (owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS agent_profiles_workspace_idx
  ON agent_profiles (workspace_id, created_at DESC)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS agent_profiles_public_idx
  ON agent_profiles (is_public, created_at DESC)
  WHERE is_public = true;
