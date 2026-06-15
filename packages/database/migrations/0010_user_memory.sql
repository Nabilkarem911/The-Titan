-- =============================================================================
-- 0010 - User Memory: secrets (encrypted) + context (key/value facts)
-- =============================================================================

-- Encrypted secrets per user/chat (API keys, passwords, tokens)
-- Values are AES-256 encrypted at app level before INSERT
CREATE TABLE IF NOT EXISTS user_secrets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     TEXT NOT NULL,                          -- telegram chatId or userId
  key          TEXT NOT NULL,                          -- e.g. "github_token", "openai_key"
  value_enc    TEXT NOT NULL,                          -- AES-256-GCM encrypted value
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, key)
);

CREATE INDEX IF NOT EXISTS user_secrets_owner_idx ON user_secrets (owner_id);

-- General context facts per user/chat (preferences, names, etc.)
-- Values stored as plain text — NOT for sensitive data
CREATE TABLE IF NOT EXISTS user_context (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     TEXT NOT NULL,
  key          TEXT NOT NULL,                          -- e.g. "preferred_language", "name"
  value        TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (owner_id, key)
);

CREATE INDEX IF NOT EXISTS user_context_owner_idx ON user_context (owner_id);
