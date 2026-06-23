-- Experiences table — persists agent learning experiences for Dream Mode
CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  strategy TEXT NOT NULL DEFAULT '',
  tools_used TEXT[] NOT NULL DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT false,
  user_feedback TEXT DEFAULT NULL,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  error_type TEXT DEFAULT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_experiences_run_id ON experiences(run_id);
CREATE INDEX IF NOT EXISTS idx_experiences_success ON experiences(success);
CREATE INDEX IF NOT EXISTS idx_experiences_timestamp ON experiences(timestamp DESC);

-- Dream reports table — persists Dream Mode analysis results
CREATE TABLE IF NOT EXISTS dream_reports (
  id TEXT PRIMARY KEY,
  experiences_reviewed INTEGER NOT NULL DEFAULT 0,
  insights TEXT NOT NULL DEFAULT '[]',
  patterns TEXT NOT NULL DEFAULT '[]',
  recommendations TEXT NOT NULL DEFAULT '[]',
  strategy_adjustments TEXT NOT NULL DEFAULT '[]',
  health_score REAL NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dream_reports_created_at ON dream_reports(created_at DESC);
