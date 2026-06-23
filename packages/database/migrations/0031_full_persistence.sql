-- Migration 0031: Full persistence for ALL remaining in-memory features

-- Dream insights
CREATE TABLE IF NOT EXISTS dream_insights (
  id TEXT PRIMARY KEY,
  report_id TEXT DEFAULT NULL,
  type TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_di_created_at ON dream_insights(created_at DESC);

-- Prompt optimizer variants
CREATE TABLE IF NOT EXISTS prompt_variants (
  id TEXT PRIMARY KEY,
  prompt_key TEXT NOT NULL,
  variant_text TEXT NOT NULL,
  success_rate REAL NOT NULL DEFAULT 0,
  avg_score REAL NOT NULL DEFAULT 0,
  total_uses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pv_prompt_key ON prompt_variants(prompt_key);

-- Strategy tuner records
CREATE TABLE IF NOT EXISTS strategy_tuner_records (
  id TEXT PRIMARY KEY,
  task_type TEXT NOT NULL DEFAULT 'general',
  strategy TEXT NOT NULL DEFAULT '',
  success BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_str_task_type ON strategy_tuner_records(task_type);

-- Meta-learning optimizer results
CREATE TABLE IF NOT EXISTS meta_learning_results (
  id TEXT PRIMARY KEY,
  optimization_type TEXT NOT NULL DEFAULT 'general',
  target TEXT NOT NULL DEFAULT '',
  before_score REAL NOT NULL DEFAULT 0,
  after_score REAL NOT NULL DEFAULT 0,
  improvement REAL NOT NULL DEFAULT 0,
  config TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mlr_created_at ON meta_learning_results(created_at DESC);

-- User feedback
CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  user_id TEXT DEFAULT NULL,
  rating TEXT NOT NULL DEFAULT 'neutral',
  comment TEXT DEFAULT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_uf_run_id ON user_feedback(run_id);

-- Theory of mind analyses
CREATE TABLE IF NOT EXISTS tom_analyses (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  perspective TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.5,
  prediction TEXT DEFAULT NULL,
  correct BOOLEAN DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tom_entity ON tom_analyses(entity_id);

-- Emotional intelligence readings
CREATE TABLE IF NOT EXISTS emotion_readings (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  valence REAL NOT NULL DEFAULT 0,
  arousal REAL NOT NULL DEFAULT 0,
  dominant_emotion TEXT NOT NULL DEFAULT 'neutral',
  empathy_score REAL NOT NULL DEFAULT 0,
  strategy TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_er_user_id ON emotion_readings(user_id);

-- Curiosity engine explorations
CREATE TABLE IF NOT EXISTS curiosity_explorations (
  id TEXT PRIMARY KEY,
  skill_name TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  proficiency REAL NOT NULL DEFAULT 0,
  findings TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ce_skill ON curiosity_explorations(skill_name);

-- Anti-sycophancy assessments
CREATE TABLE IF NOT EXISTS sycophancy_assessments (
  id TEXT PRIMARY KEY,
  input_text TEXT NOT NULL DEFAULT '',
  sycophancy_score REAL NOT NULL DEFAULT 0,
  hedge_words TEXT[] NOT NULL DEFAULT '{}',
  recommendation TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_created_at ON sycophancy_assessments(created_at DESC);

-- Metacognitive consolidation
CREATE TABLE IF NOT EXISTS metacognitive_reflections (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL DEFAULT 'general',
  content TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.5,
  lesson TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mc_category ON metacognitive_reflections(category);

-- Safety guardrail results
CREATE TABLE IF NOT EXISTS guardrail_results (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'low',
  decision TEXT NOT NULL DEFAULT 'proceed',
  risk_categories TEXT[] NOT NULL DEFAULT '{}',
  reasoning TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gr_decision ON guardrail_results(decision);

-- Multi-layer guardrail results
CREATE TABLE IF NOT EXISTS multilayer_guardrail_results (
  id TEXT PRIMARY KEY,
  input_text TEXT NOT NULL DEFAULT '',
  final_action TEXT NOT NULL DEFAULT 'proceed',
  layer_results TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mlgr_created_at ON multilayer_guardrail_results(created_at DESC);

-- Normative agency
CREATE TABLE IF NOT EXISTS normative_commitments (
  id TEXT PRIMARY KEY,
  norm TEXT NOT NULL DEFAULT '',
  commitment TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nc_status ON normative_commitments(status);

CREATE TABLE IF NOT EXISTS normative_conflicts (
  id TEXT PRIMARY KEY,
  norm1 TEXT NOT NULL DEFAULT '',
  norm2 TEXT NOT NULL DEFAULT '',
  resolution TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Digital twin snapshots
CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id TEXT PRIMARY KEY,
  metrics TEXT NOT NULL DEFAULT '{}',
  predictions TEXT NOT NULL DEFAULT '[]',
  alerts TEXT NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dts_created_at ON digital_twin_snapshots(created_at DESC);

-- Environment graph
CREATE TABLE IF NOT EXISTS environment_entities (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'object',
  name TEXT NOT NULL DEFAULT '',
  properties TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ee_type ON environment_entities(type);

CREATE TABLE IF NOT EXISTS environment_events (
  id TEXT PRIMARY KEY,
  entity_id TEXT DEFAULT NULL,
  event_type TEXT NOT NULL DEFAULT 'observe',
  data TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ev_created_at ON environment_events(created_at DESC);

-- Autonomous loop results
CREATE TABLE IF NOT EXISTS autonomous_loop_results (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT DEFAULT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alr_status ON autonomous_loop_results(status);

-- Hyper agent cycles
CREATE TABLE IF NOT EXISTS hyper_agent_cycles (
  id TEXT PRIMARY KEY,
  cycle INTEGER NOT NULL DEFAULT 0,
  improvement TEXT NOT NULL DEFAULT '',
  gain REAL NOT NULL DEFAULT 0,
  kept BOOLEAN NOT NULL DEFAULT true,
  config TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hac_cycle ON hyper_agent_cycles(cycle DESC);

-- Neuro-symbolic results
CREATE TABLE IF NOT EXISTS neuro_symbolic_results (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL DEFAULT '',
  approach TEXT NOT NULL DEFAULT 'hybrid',
  result TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.5,
  rules_used TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nsr_created_at ON neuro_symbolic_results(created_at DESC);

-- Hypothesis tests
CREATE TABLE IF NOT EXISTS hypothesis_tests (
  id TEXT PRIMARY KEY,
  hypothesis TEXT NOT NULL DEFAULT '',
  test_method TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT 'inconclusive',
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ht_created_at ON hypothesis_tests(created_at DESC);

-- Dynamic tool discovery
CREATE TABLE IF NOT EXISTS discovered_tools (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  source TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT NULL,
  reliability REAL NOT NULL DEFAULT 0.5,
  installed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_dt_name ON discovered_tools(name);

-- Skill synthesis
CREATE TABLE IF NOT EXISTS synthesized_skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  proficiency REAL NOT NULL DEFAULT 0,
  verified BOOLEAN NOT NULL DEFAULT false,
  code TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ss_name ON synthesized_skills(name);

-- Benchmarking results
CREATE TABLE IF NOT EXISTS benchmark_results (
  id TEXT PRIMARY KEY,
  suite_name TEXT NOT NULL DEFAULT '',
  task_name TEXT NOT NULL DEFAULT '',
  score REAL NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  model TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_br_suite ON benchmark_results(suite_name);

-- Test-time recursive thinking results
CREATE TABLE IF NOT EXISTS trt_results (
  id TEXT PRIMARY KEY,
  problem TEXT NOT NULL DEFAULT '',
  rounds INTEGER NOT NULL DEFAULT 0,
  answer TEXT NOT NULL DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0.5,
  abstained BOOLEAN NOT NULL DEFAULT false,
  knowledge_gained TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trt_created_at ON trt_results(created_at DESC);

-- Model router usage
CREATE TABLE IF NOT EXISTS model_router_usage (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL DEFAULT '',
  task_type TEXT NOT NULL DEFAULT 'general',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mru_model ON model_router_usage(model);

-- Apex evolution patches
CREATE TABLE IF NOT EXISTS apex_patches (
  id TEXT PRIMARY KEY,
  cycle INTEGER NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  patch TEXT NOT NULL DEFAULT '',
  applied BOOLEAN NOT NULL DEFAULT false,
  performance_gain REAL NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ap_cycle ON apex_patches(cycle DESC);

-- Swarm evolution
CREATE TABLE IF NOT EXISTS swarm_topologies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  performance REAL NOT NULL DEFAULT 0,
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS swarm_collective_memory (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL DEFAULT '',
  value TEXT NOT NULL DEFAULT '',
  agent_id TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_scm_key ON swarm_collective_memory(key);

-- Message bus history
CREATE TABLE IF NOT EXISTS swarm_messages (
  id TEXT PRIMARY KEY,
  from_agent TEXT NOT NULL DEFAULT '',
  to_agent TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'default',
  content TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sm_created_at ON swarm_messages(created_at DESC);

-- Temporal intelligence
CREATE TABLE IF NOT EXISTS temporal_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL DEFAULT 'observation',
  content TEXT NOT NULL DEFAULT '',
  timestamp_predicted TIMESTAMPTZ DEFAULT NULL,
  confidence REAL NOT NULL DEFAULT 0.5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_te_created_at ON temporal_events(created_at DESC);

-- Infinite self-play archive
CREATE TABLE IF NOT EXISTS self_play_archive (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL DEFAULT '',
  outcome TEXT NOT NULL DEFAULT 'unknown',
  performance REAL NOT NULL DEFAULT 0,
  mutation TEXT DEFAULT NULL,
  generation INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_spa_generation ON self_play_archive(generation DESC);

-- Screen monitor alerts
CREATE TABLE IF NOT EXISTS screen_alerts (
  id TEXT PRIMARY KEY,
  alert_type TEXT NOT NULL DEFAULT 'change',
  description TEXT NOT NULL DEFAULT '',
  screenshot_hash TEXT DEFAULT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sa_created_at ON screen_alerts(created_at DESC);

-- Web MCP invocations
CREATE TABLE IF NOT EXISTS web_mcp_invocations (
  id TEXT PRIMARY KEY,
  server TEXT NOT NULL DEFAULT '',
  tool TEXT NOT NULL DEFAULT '',
  params TEXT NOT NULL DEFAULT '{}',
  result TEXT NOT NULL DEFAULT '{}',
  success BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wmi_created_at ON web_mcp_invocations(created_at DESC);

-- MCP governance audit log
CREATE TABLE IF NOT EXISTS mcp_governance_audit (
  id TEXT PRIMARY KEY,
  server TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT '',
  policy_violated TEXT DEFAULT NULL,
  decision TEXT NOT NULL DEFAULT 'allow',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mga_created_at ON mcp_governance_audit(created_at DESC);

-- Visual workflows
CREATE TABLE IF NOT EXISTS visual_workflows (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  description TEXT DEFAULT NULL,
  nodes TEXT NOT NULL DEFAULT '[]',
  edges TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_vw_status ON visual_workflows(status);

-- Edge privacy federated updates
CREATE TABLE IF NOT EXISTS federated_updates (
  id TEXT PRIMARY KEY,
  model TEXT NOT NULL DEFAULT '',
  update_data TEXT NOT NULL DEFAULT '{}',
  round INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'local',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_fu_model ON federated_updates(model);
