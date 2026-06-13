-- =============================================================================
-- 0003 - Audit Logs (append-only)
-- =============================================================================
-- Audit schema kept separate from `public` for clearer permission boundary.
-- UPDATE and DELETE are blocked at the trigger level.

CREATE TABLE IF NOT EXISTS audit.logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id      UUID,
  workspace_id  UUID,
  action        TEXT NOT NULL,
  resource      TEXT,
  resource_id   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_actor_idx ON audit.logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_workspace_idx ON audit.logs (workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit.logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit.logs (created_at DESC);

-- Block UPDATE
DROP TRIGGER IF EXISTS audit_logs_no_update ON audit.logs;
CREATE TRIGGER audit_logs_no_update
  BEFORE UPDATE ON audit.logs
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_audit_immutable();

-- Block DELETE
DROP TRIGGER IF EXISTS audit_logs_no_delete ON audit.logs;
CREATE TRIGGER audit_logs_no_delete
  BEFORE DELETE ON audit.logs
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_audit_immutable();

REVOKE ALL ON audit.logs FROM PUBLIC;
GRANT INSERT ON audit.logs TO titan;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA audit TO titan;
