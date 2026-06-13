-- =============================================================================
-- 0004 - Foundation Indexes
-- =============================================================================

CREATE INDEX IF NOT EXISTS workspaces_user_listing_idx
  ON workspace_members (user_id, workspace_id);

CREATE INDEX IF NOT EXISTS sessions_cleanup_idx
  ON sessions (expires_at)
  WHERE revoked_at IS NULL;
