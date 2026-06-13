-- =============================================================================
-- 0005 - Refresh token rotation chain tracking
-- =============================================================================
-- Adds parent_session_id so a refresh chain can be traced and revoked
-- together on reuse detection.

ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS parent_session_id UUID
    REFERENCES sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS sessions_parent_idx
  ON sessions (parent_session_id)
  WHERE parent_session_id IS NOT NULL;
