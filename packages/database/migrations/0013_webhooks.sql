-- =============================================================================
-- 0013 - Webhooks (persistent storage for webhook endpoints)
-- =============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        TEXT NOT NULL,
  workspace_id    TEXT,
  name            TEXT NOT NULL,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL,
  events          JSONB NOT NULL DEFAULT '["*"]'::jsonb,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhooks_owner_idx ON webhooks (owner_id);
CREATE INDEX IF NOT EXISTS webhooks_workspace_idx ON webhooks (workspace_id) WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS webhooks_active_idx ON webhooks (is_active) WHERE is_active = true;
