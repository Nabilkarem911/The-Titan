-- 0032 - Remaining in-memory persistence tables

-- Economy: agent accounts
CREATE TABLE IF NOT EXISTS agent_economy_accounts (
  agent_id TEXT PRIMARY KEY,
  balance BIGINT NOT NULL DEFAULT 0,
  reputation INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Economy: reputation scores
CREATE TABLE IF NOT EXISTS agent_economy_reputation (
  agent_id TEXT PRIMARY KEY,
  test_pass_rate REAL NOT NULL DEFAULT 0,
  task_completion_rate REAL NOT NULL DEFAULT 0,
  peer_rating REAL NOT NULL DEFAULT 0,
  overall REAL NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Economy: skill listings
CREATE TABLE IF NOT EXISTS agent_economy_listings (
  id TEXT PRIMARY KEY,
  seller_id TEXT NOT NULL,
  skill_name TEXT NOT NULL,
  price_per_use BIGINT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ael_seller ON agent_economy_listings(seller_id);

-- Economy: trade offers
CREATE TABLE IF NOT EXISTS agent_economy_offers (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT NOT NULL,
  to_agent_id TEXT NOT NULL,
  listing_id TEXT NOT NULL,
  price BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  parent_offer_id TEXT DEFAULT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aeo_status ON agent_economy_offers(status);

-- Economy: escrows
CREATE TABLE IF NOT EXISTS agent_economy_escrows (
  id TEXT PRIMARY KEY,
  offer_id TEXT NOT NULL,
  buyer_id TEXT NOT NULL,
  seller_id TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ DEFAULT NULL
);

-- Economy: audit log
CREATE TABLE IF NOT EXISTS agent_economy_audit_log (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aeal_agent ON agent_economy_audit_log(agent_id);

-- RL: episodes
CREATE TABLE IF NOT EXISTS rl_episodes (
  id TEXT PRIMARY KEY,
  total_reward REAL NOT NULL DEFAULT 0,
  steps INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- RL: Q-table
CREATE TABLE IF NOT EXISTS rl_q_table (
  state_key TEXT NOT NULL,
  action_key TEXT NOT NULL,
  q_value REAL NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (state_key, action_key)
);

-- Voice: cloned voices
CREATE TABLE IF NOT EXISTS voice_clones (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Voice: sessions
CREATE TABLE IF NOT EXISTS voice_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vs_user ON voice_sessions(user_id);

-- Voice: session history
CREATE TABLE IF NOT EXISTS voice_session_history (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vsh_session ON voice_session_history(session_id);

-- Workflow: DAG executions
CREATE TABLE IF NOT EXISTS dag_executions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_nodes TEXT[] NOT NULL DEFAULT '{}',
  failed_nodes TEXT[] NOT NULL DEFAULT '{}',
  skipped_nodes TEXT[] NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- TRT: results
CREATE TABLE IF NOT EXISTS trt_results (
  id TEXT PRIMARY KEY,
  problem TEXT NOT NULL DEFAULT '',
  final_answer TEXT NOT NULL DEFAULT '',
  total_steps INTEGER NOT NULL DEFAULT 0,
  solver_mode TEXT NOT NULL DEFAULT '',
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TRT: global knowledge
CREATE TABLE IF NOT EXISTS trt_global_knowledge (
  id TEXT PRIMARY KEY,
  knowledge TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-rewriter: pipelines
CREATE TABLE IF NOT EXISTS self_rewrite_pipelines (
  id TEXT PRIMARY KEY,
  target_module TEXT NOT NULL,
  phase TEXT NOT NULL DEFAULT 'diagnosis',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-rewriter: versions
CREATE TABLE IF NOT EXISTS self_rewrite_versions (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  target_module TEXT NOT NULL,
  accepted BOOLEAN NOT NULL DEFAULT false,
  rolled_back BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-healing: lessons
CREATE TABLE IF NOT EXISTS self_healing_lessons (
  id TEXT PRIMARY KEY,
  bug_type TEXT NOT NULL,
  fix_strategy TEXT NOT NULL,
  success_rate REAL NOT NULL DEFAULT 0,
  times_applied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Self-healing: attempts
CREATE TABLE IF NOT EXISTS self_healing_attempts (
  id TEXT PRIMARY KEY,
  bug_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL DEFAULT 0,
  fix_code TEXT DEFAULT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  error TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sha_bug ON self_healing_attempts(bug_id);

-- Neuro-symbolic: rules
CREATE TABLE IF NOT EXISTS neuro_symbolic_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  condition TEXT NOT NULL,
  action TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  times_applied INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hyper-agent: patterns
CREATE TABLE IF NOT EXISTS hyper_agent_patterns (
  id TEXT PRIMARY KEY,
  pattern_type TEXT NOT NULL,
  change TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hyper-agent: performance history
CREATE TABLE IF NOT EXISTS hyper_agent_performance (
  id TEXT PRIMARY KEY,
  performance REAL NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Execution state: checkpoints
CREATE TABLE IF NOT EXISTS execution_checkpoints (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  label TEXT NOT NULL,
  state JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ec_run ON execution_checkpoints(run_id);

-- Benchmarking: suites
CREATE TABLE IF NOT EXISTS benchmark_suites (
  id TEXT PRIMARY KEY,
  suite_name TEXT NOT NULL,
  overall_score REAL NOT NULL DEFAULT 0,
  task_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ DEFAULT NULL
);

-- Apex: principles
CREATE TABLE IF NOT EXISTS apex_principles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  evidence INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tool discovery: queries
CREATE TABLE IF NOT EXISTS tool_discovery_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  results_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Skill synthesis: results
CREATE TABLE IF NOT EXISTS skill_synthesis_results (
  id TEXT PRIMARY KEY,
  input_skills TEXT NOT NULL,
  output_skill TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Multi-layer guardrails: results
CREATE TABLE IF NOT EXISTS multilayer_guardrail_results_v2 (
  id TEXT PRIMARY KEY,
  input_action TEXT NOT NULL DEFAULT '',
  final_decision TEXT NOT NULL DEFAULT '',
  layers_checked INTEGER NOT NULL DEFAULT 0,
  risk_score REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metacognitive: micro lessons
CREATE TABLE IF NOT EXISTS metacognitive_micro_lessons (
  id TEXT PRIMARY KEY,
  lesson TEXT NOT NULL,
  confidence REAL NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'batch',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Metacognitive: meta knowledge
CREATE TABLE IF NOT EXISTS metacognitive_meta_knowledge (
  id TEXT PRIMARY KEY,
  knowledge TEXT NOT NULL UNIQUE,
  confidence REAL NOT NULL DEFAULT 0,
  times_seen INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'batch',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Introspection: reports
CREATE TABLE IF NOT EXISTS introspection_reports_v2 (
  id TEXT PRIMARY KEY,
  detected_biases TEXT[] NOT NULL DEFAULT '{}',
  coherence_score REAL NOT NULL DEFAULT 0,
  self_awareness_score REAL NOT NULL DEFAULT 0,
  recommendations TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Curiosity: knowledge gaps
CREATE TABLE IF NOT EXISTS curiosity_knowledge_gaps (
  id TEXT PRIMARY KEY,
  gap TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Theory of mind: models
CREATE TABLE IF NOT EXISTS tom_models (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  traits JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tom_entity ON tom_models(entity_id);

-- Capability registry
CREATE TABLE IF NOT EXISTS capability_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  config JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Normative: revisions
CREATE TABLE IF NOT EXISTS normative_revisions (
  id TEXT PRIMARY KEY,
  commitment_id TEXT NOT NULL,
  original_description TEXT NOT NULL DEFAULT '',
  revised_description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mirror: episodic buffer items
CREATE TABLE IF NOT EXISTS episodic_buffer_items (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'thought',
  salience REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mirror: inner monologue threads
CREATE TABLE IF NOT EXISTS inner_monologue_threads (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Mirror: narrative history
CREATE TABLE IF NOT EXISTS narrative_history (
  id TEXT PRIMARY KEY,
  narrative TEXT NOT NULL DEFAULT '',
  self_model TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Environment graph: relations
CREATE TABLE IF NOT EXISTS environment_relations (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relation_type TEXT NOT NULL,
  strength REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_er_source ON environment_relations(source_id);
CREATE INDEX IF NOT EXISTS idx_er_target ON environment_relations(target_id);

-- Swarm: shared workspace artifacts
CREATE TABLE IF NOT EXISTS swarm_artifacts (
  id TEXT PRIMARY KEY,
  workspace_key TEXT NOT NULL,
  produced_by TEXT NOT NULL,
  value TEXT NOT NULL DEFAULT '',
  consumed_by TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_key ON swarm_artifacts(workspace_key);

-- Swarm: shared workspace notes
CREATE TABLE IF NOT EXISTS swarm_notes (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Swarm: federation tasks
CREATE TABLE IF NOT EXISTS swarm_federation_tasks (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  skill TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
