-- =============================================================================
-- 0009 - Memory Tables (conversation history + vector collections)
-- =============================================================================

-- Conversation message history (pgvector-backed)
CREATE TABLE IF NOT EXISTS memory_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   TEXT NOT NULL,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content      TEXT NOT NULL,
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memory_messages_session_idx ON memory_messages (session_id, created_at DESC);

-- Vector collections registry
CREATE TABLE IF NOT EXISTS memory_collections (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  workspace_id TEXT NOT NULL,
  item_count   INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, workspace_id)
);

CREATE INDEX IF NOT EXISTS memory_collections_workspace_idx ON memory_collections (workspace_id);

-- Vector items (embedding stored as vector if pgvector available, else as JSONB array)
CREATE TABLE IF NOT EXISTS memory_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id UUID NOT NULL REFERENCES memory_collections(id) ON DELETE CASCADE,
  external_id   TEXT NOT NULL,
  content       TEXT NOT NULL,
  embedding     JSONB,
  metadata      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (collection_id, external_id)
);

CREATE INDEX IF NOT EXISTS memory_items_collection_idx ON memory_items (collection_id);
CREATE INDEX IF NOT EXISTS memory_items_external_idx  ON memory_items (collection_id, external_id);
