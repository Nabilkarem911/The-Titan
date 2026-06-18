-- =============================================================================
-- 0024 - Knowledge Index + Workflows + Learning + Marketplace
-- =============================================================================

-- Code & Document Index
CREATE TABLE IF NOT EXISTS indexed_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  chunk_count INT DEFAULT 0,
  total_chars INT DEFAULT 0,
  indexed_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS code_symbols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  file_path TEXT NOT NULL,
  line_number INT,
  exported BOOLEAN DEFAULT false,
  signature TEXT,
  indexed_at TIMESTAMPTZ DEFAULT now()
);

-- Workflows
CREATE TABLE IF NOT EXISTS workflows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID,
  owner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]',
  edges JSONB NOT NULL DEFAULT '[]',
  entry_node TEXT,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending',
  input JSONB,
  node_results JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Learning & Feedback
CREATE TABLE IF NOT EXISTS run_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating TEXT NOT NULL CHECK (rating IN ('positive','negative','neutral')),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Marketplace
CREATE TABLE IF NOT EXISTS marketplace_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('agent','tool','workflow','plugin')),
  name TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id) ON DELETE SET NULL,
  version TEXT DEFAULT '1.0.0',
  downloads INT DEFAULT 0,
  rating_avg FLOAT DEFAULT 0,
  rating_count INT DEFAULT 0,
  manifest JSONB,
  is_verified BOOLEAN DEFAULT false,
  published_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS marketplace_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  listing_id UUID REFERENCES marketplace_listings(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, listing_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_code_symbols_workspace ON code_symbols(workspace_id);
CREATE INDEX IF NOT EXISTS idx_code_symbols_name ON code_symbols(name);
CREATE INDEX IF NOT EXISTS idx_workflows_workspace ON workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_run_feedback_run ON run_feedback(run_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_type ON marketplace_listings(type);
CREATE INDEX IF NOT EXISTS idx_marketplace_downloads ON marketplace_listings(downloads DESC);
