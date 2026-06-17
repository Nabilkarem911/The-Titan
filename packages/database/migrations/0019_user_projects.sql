-- =============================================================================
-- 0019 - User Projects Table
-- Allows Titan to remember project paths, repos, and descriptions per user.
-- When user says "check my project" Titan knows which one.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_projects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    TEXT NOT NULL,
  name        TEXT NOT NULL,                          -- e.g. "The-Titan", "client-website"
  path        TEXT,                                   -- e.g. "/home/user/projects/The-Titan"
  repo_url    TEXT,                                   -- e.g. "https://github.com/owner/repo"
  branch      TEXT DEFAULT 'main',
  description TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,        -- active project
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, name)
);

CREATE INDEX IF NOT EXISTS user_projects_owner_idx ON user_projects (owner_id);
CREATE INDEX IF NOT EXISTS user_projects_default_idx ON user_projects (owner_id, is_default) WHERE is_default = true;
