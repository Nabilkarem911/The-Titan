-- Self-improvement proposals archive
CREATE TABLE IF NOT EXISTS self_improvement_proposals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT NOT NULL DEFAULT '',
  suggested_change TEXT NOT NULL DEFAULT '',
  expected_benefit TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sip_status ON self_improvement_proposals(status);
CREATE INDEX IF NOT EXISTS idx_sip_created_at ON self_improvement_proposals(created_at DESC);

-- Self-healing debugger lessons
CREATE TABLE IF NOT EXISTS self_healing_lessons (
  id TEXT PRIMARY KEY,
  bug_id TEXT NOT NULL,
  error_type TEXT NOT NULL DEFAULT '',
  failed_fix TEXT NOT NULL DEFAULT '',
  successful_fix TEXT NOT NULL DEFAULT '',
  lesson TEXT NOT NULL DEFAULT '',
  successful BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shl_bug_id ON self_healing_lessons(bug_id);
CREATE INDEX IF NOT EXISTS idx_shl_error_type ON self_healing_lessons(error_type);

-- Self-healing debugger attempts
CREATE TABLE IF NOT EXISTS self_healing_attempts (
  id TEXT PRIMARY KEY,
  bug_id TEXT NOT NULL,
  attempt INTEGER NOT NULL DEFAULT 0,
  fix_description TEXT NOT NULL DEFAULT '',
  fix_code TEXT DEFAULT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sha_bug_id ON self_healing_attempts(bug_id);

-- Self-rewriter versions
CREATE TABLE IF NOT EXISTS self_rewrite_versions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  code TEXT DEFAULT NULL,
  applied BOOLEAN NOT NULL DEFAULT false,
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  phase TEXT NOT NULL DEFAULT 'diagnosis',
  performance REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_srw_version ON self_rewrite_versions(version DESC);

-- Heuristic store
CREATE TABLE IF NOT EXISTS heuristics (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'general',
  source TEXT NOT NULL DEFAULT 'success',
  task_type TEXT NOT NULL DEFAULT 'general',
  confidence REAL NOT NULL DEFAULT 0.5,
  usage_count INTEGER NOT NULL DEFAULT 0,
  success_rate REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used TIMESTAMPTZ DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_heuristics_category ON heuristics(category);
CREATE INDEX IF NOT EXISTS idx_heuristics_task_type ON heuristics(task_type);

-- Introspection reports
CREATE TABLE IF NOT EXISTS introspection_reports (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_id TEXT NOT NULL DEFAULT '',
  reasoning_quality REAL NOT NULL DEFAULT 50,
  biases_detected TEXT NOT NULL DEFAULT '[]',
  confabulations_detected TEXT NOT NULL DEFAULT '[]',
  confidence REAL NOT NULL DEFAULT 0.5,
  recommendations TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ir_run_id ON introspection_reports(run_id);
CREATE INDEX IF NOT EXISTS idx_ir_created_at ON introspection_reports(created_at DESC);

-- Safety memory entries
CREATE TABLE IF NOT EXISTS safety_memory_entries (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sme_category ON safety_memory_entries(category);
