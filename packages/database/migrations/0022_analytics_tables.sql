-- =============================================================================
-- 0022 - Analytics & Cost Tracking Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID,
  model TEXT NOT NULL,
  input_tokens INT NOT NULL DEFAULT 0,
  output_tokens INT NOT NULL DEFAULT 0,
  total_tokens INT NOT NULL DEFAULT 0,
  cost_usd DECIMAL(12,8) DEFAULT 0,
  run_id UUID,
  tool_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tool_execution_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_name TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  duration_ms INT,
  error_type TEXT,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  workspace_id UUID,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_tool_stats_tool ON tool_execution_stats(tool_name);
CREATE INDEX IF NOT EXISTS idx_tool_stats_created ON tool_execution_stats(created_at);
