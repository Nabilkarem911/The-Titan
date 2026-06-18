-- =============================================================================
-- 0021 - User Long-Term Memory, Conversation Summaries, Project Context
-- Persistent identity — Titan remembers users across sessions
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_long_term_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('preference', 'fact', 'relationship', 'project', 'skill', 'custom')),
  confidence FLOAT DEFAULT 0.5 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT DEFAULT 'inferred' CHECK (source IN ('inferred', 'explicit', 'observed')),
  access_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, key)
);

CREATE TABLE IF NOT EXISTS conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  topics TEXT[] DEFAULT '{}',
  decisions TEXT[] DEFAULT '{}',
  action_items TEXT[] DEFAULT '{}',
  mood TEXT DEFAULT 'neutral' CHECK (mood IN ('positive', 'neutral', 'frustrated', 'excited')),
  message_count INT DEFAULT 0,
  tokens_used INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS project_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_path TEXT,
  tech_stack TEXT[] DEFAULT '{}',
  architecture_notes TEXT,
  known_issues TEXT[] DEFAULT '{}',
  recent_changes TEXT[] DEFAULT '{}',
  notes TEXT[] DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_ltm_user ON user_long_term_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ltm_category ON user_long_term_memory(user_id, category);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_user ON conversation_summaries(user_id);
CREATE INDEX IF NOT EXISTS idx_conv_summaries_session ON conversation_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_project_ctx_user ON project_context(user_id);

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_ltm_timestamp() RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ltm_updated ON user_long_term_memory;
CREATE TRIGGER trg_ltm_updated BEFORE UPDATE ON user_long_term_memory FOR EACH ROW EXECUTE FUNCTION update_ltm_timestamp();

DROP TRIGGER IF EXISTS trg_project_ctx_updated ON project_context;
CREATE TRIGGER trg_project_ctx_updated BEFORE UPDATE ON project_context FOR EACH ROW EXECUTE FUNCTION update_ltm_timestamp();
