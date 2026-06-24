import { query } from './client.js';
import { randomUUID } from 'node:crypto';

// ── Agent Economy ──
export const economyAccounts = {
  async upsert(agentId: string, balance: number, reputation: number): Promise<void> {
    await query(
      `INSERT INTO agent_economy_accounts (agent_id, balance, reputation) VALUES ($1,$2,$3)
       ON CONFLICT (agent_id) DO UPDATE SET balance = $2, reputation = $3`,
      [agentId, balance, reputation],
    );
  },
  async getRecent(limit = 100): Promise<unknown[]> {
    const r = await query(`SELECT * FROM agent_economy_accounts ORDER BY created_at DESC LIMIT $1`, [limit]);
    return r.rows;
  },
};

export const economyReputation = {
  async upsert(agentId: string, testPassRate: number, taskCompletionRate: number, peerRating: number, overall: number): Promise<void> {
    await query(
      `INSERT INTO agent_economy_reputation (agent_id, test_pass_rate, task_completion_rate, peer_rating, overall) VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (agent_id) DO UPDATE SET test_pass_rate = $2, task_completion_rate = $3, peer_rating = $4, overall = $5, updated_at = now()`,
      [agentId, testPassRate, taskCompletionRate, peerRating, overall],
    );
  },
};

export const economyListings = {
  async insert(id: string, sellerId: string, skillName: string, pricePerUse: number): Promise<void> {
    await query(
      `INSERT INTO agent_economy_listings (id, seller_id, skill_name, price_per_use) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING`,
      [id, sellerId, skillName, pricePerUse],
    );
  },
};

export const economyOffers = {
  async insert(id: string, fromAgent: string, toAgent: string, listingId: string, price: number, parentOfferId: string | null, expiresAt: Date): Promise<void> {
    await query(
      `INSERT INTO agent_economy_offers (id, from_agent_id, to_agent_id, listing_id, price, parent_offer_id, expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING`,
      [id, fromAgent, toAgent, listingId, price, parentOfferId, expiresAt],
    );
  },
};

export const economyEscrows = {
  async insert(id: string, offerId: string, buyerId: string, sellerId: string, amount: number): Promise<void> {
    await query(
      `INSERT INTO agent_economy_escrows (id, offer_id, buyer_id, seller_id, amount) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING`,
      [id, offerId, buyerId, sellerId, amount],
    );
  },
};

export const economyAuditLog = {
  async insert(type: string, agentId: string, amount: number, description: string): Promise<void> {
    await query(
      `INSERT INTO agent_economy_audit_log (id, type, agent_id, amount, description) VALUES ($1,$2,$3,$4,$5)`,
      [randomUUID(), type, agentId, amount, description],
    );
  },
};

// ── RL ──
export const rlEpisodes = {
  async insert(id: string, totalReward: number, steps: number, success: boolean, startedAt: Date, completedAt: Date | null): Promise<void> {
    await query(
      `INSERT INTO rl_episodes (id, total_reward, steps, success, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, totalReward, steps, success, startedAt, completedAt],
    );
  },
};

export const rlQTable = {
  async upsert(stateKey: string, actionKey: string, qValue: number): Promise<void> {
    await query(
      `INSERT INTO rl_q_table (state_key, action_key, q_value) VALUES ($1,$2,$3)
       ON CONFLICT (state_key, action_key) DO UPDATE SET q_value = $3, updated_at = now()`,
      [stateKey, actionKey, qValue],
    );
  },
};

// ── Voice ──
export const voiceClones = {
  async insert(id: string, name: string, voiceId: string): Promise<void> {
    await query(`INSERT INTO voice_clones (id, name, voice_id) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, [id, name, voiceId]);
  },
};

export const voiceSessions = {
  async insert(id: string, userId: string): Promise<void> {
    await query(`INSERT INTO voice_sessions (id, user_id) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [id, userId]);
  },
  async setActive(id: string, isActive: boolean): Promise<void> {
    await query(`UPDATE voice_sessions SET is_active = $2 WHERE id = $1`, [id, isActive]);
  },
};

export const voiceSessionHistory = {
  async insert(sessionId: string, role: string, content: string): Promise<void> {
    await query(`INSERT INTO voice_session_history (id, session_id, role, content) VALUES ($1,$2,$3,$4)`, [randomUUID(), sessionId, role, content]);
  },
};

// ── DAG Executions ──
export const dagExecutions = {
  async insert(id: string, workflowId: string, status: string, completedNodes: string[], failedNodes: string[], skippedNodes: string[]): Promise<void> {
    await query(
      `INSERT INTO dag_executions (id, workflow_id, status, completed_nodes, failed_nodes, skipped_nodes) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO UPDATE SET status = $3, completed_nodes = $4, failed_nodes = $5, skipped_nodes = $6`,
      [id, workflowId, status, completedNodes, failedNodes, skippedNodes],
    );
  },
};

// ── TRT ──
export const trtResultsRepo = {
  async insert(id: string, problem: string, finalAnswer: string, totalSteps: number, solverMode: string, durationMs: number): Promise<void> {
    await query(
      `INSERT INTO trt_results (id, problem, final_answer, total_steps, solver_mode, duration_ms) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, problem, finalAnswer, totalSteps, solverMode, durationMs],
    );
  },
};

export const trtGlobalKnowledge = {
  async insert(knowledge: string): Promise<void> {
    await query(`INSERT INTO trt_global_knowledge (id, knowledge) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [randomUUID(), knowledge]);
  },
};

// ── Self-rewriter ──
export const selfRewritePipelines = {
  async insert(id: string, targetModule: string, phase: string): Promise<void> {
    await query(`INSERT INTO self_rewrite_pipelines (id, target_module, phase) VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE SET phase = $3`, [id, targetModule, phase]);
  },
};

export const selfRewriteVersions = {
  async insert(id: string, version: number, targetModule: string, accepted: boolean, rolledBack: boolean): Promise<void> {
    await query(`INSERT INTO self_rewrite_versions (id, version, target_module, accepted, rolled_back) VALUES ($1,$2,$3,$4,$5)`, [id, version, targetModule, accepted, rolledBack]);
  },
};

// ── Self-healing ──
export const selfHealingLessonsV2 = {
  async insert(id: string, bugType: string, fixStrategy: string, successRate: number, timesApplied: number): Promise<void> {
    await query(`INSERT INTO self_healing_lessons (id, bug_type, fix_strategy, success_rate, times_applied) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET success_rate = $4, times_applied = $5`, [id, bugType, fixStrategy, successRate, timesApplied]);
  },
};

export const selfHealingAttemptsV2 = {
  async insert(id: string, bugId: string, attemptNum: number, fixCode: string | null, success: boolean, error: string | null): Promise<void> {
    await query(`INSERT INTO self_healing_attempts (id, bug_id, attempt_number, fix_code, success, error) VALUES ($1,$2,$3,$4,$5,$6)`, [id, bugId, attemptNum, fixCode, success, error]);
  },
};

// ── Neuro-symbolic rules ──
export const neuroSymbolicRules = {
  async insert(id: string, name: string, condition: string, action: string, priority: number): Promise<void> {
    await query(`INSERT INTO neuro_symbolic_rules (id, name, condition, action, priority) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET times_applied = neuro_symbolic_rules.times_applied + 1`, [id, name, condition, action, priority]);
  },
};

// ── Hyper-agent ──
export const hyperAgentPatterns = {
  async insert(patternType: string, change: string): Promise<void> {
    await query(`INSERT INTO hyper_agent_patterns (id, pattern_type, change) VALUES ($1,$2,$3)`, [randomUUID(), patternType, change]);
  },
};

export const hyperAgentPerformance = {
  async insert(performance: number): Promise<void> {
    await query(`INSERT INTO hyper_agent_performance (id, performance) VALUES ($1,$2)`, [randomUUID(), performance]);
  },
};

// ── Execution checkpoints ──
export const executionCheckpoints = {
  async insert(id: string, runId: string, label: string, state: unknown, metadata: unknown): Promise<void> {
    await query(`INSERT INTO execution_checkpoints (id, run_id, label, state, metadata) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET state = $4, metadata = $5`, [id, runId, label, JSON.stringify(state), JSON.stringify(metadata)]);
  },
};

// ── Benchmark suites ──
export const benchmarkSuites = {
  async insert(id: string, suiteName: string, overallScore: number, taskCount: number, startedAt: Date, completedAt: Date | null): Promise<void> {
    await query(`INSERT INTO benchmark_suites (id, suite_name, overall_score, task_count, started_at, completed_at) VALUES ($1,$2,$3,$4,$5,$6)`, [id, suiteName, overallScore, taskCount, startedAt, completedAt]);
  },
};

// ── Apex principles ──
export const apexPrinciples = {
  async upsert(name: string, description: string, evidence: number): Promise<void> {
    await query(`INSERT INTO apex_principles (id, name, description, evidence) VALUES ($1,$2,$3,$4) ON CONFLICT (name) DO UPDATE SET description = $3, evidence = $4`, [randomUUID(), name, description, evidence]);
  },
};

// ── Tool discovery queries ──
export const toolDiscoveryQueries = {
  async insert(id: string, q: string, status: string, resultsCount: number): Promise<void> {
    await query(`INSERT INTO tool_discovery_queries (id, query, status, results_count) VALUES ($1,$2,$3,$4)`, [id, q, status, resultsCount]);
  },
};

// ── Skill synthesis results ──
export const skillSynthesisResults = {
  async insert(id: string, inputSkills: string, outputSkill: string, success: boolean, durationMs: number): Promise<void> {
    await query(`INSERT INTO skill_synthesis_results (id, input_skills, output_skill, success, duration_ms) VALUES ($1,$2,$3,$4,$5)`, [id, inputSkills, outputSkill, success, durationMs]);
  },
};

// ── Multi-layer guardrails results ──
export const multilayerGuardrailResultsV2 = {
  async insert(id: string, inputAction: string, finalDecision: string, layersChecked: number, riskScore: number): Promise<void> {
    await query(`INSERT INTO multilayer_guardrail_results_v2 (id, input_action, final_decision, layers_checked, risk_score) VALUES ($1,$2,$3,$4,$5)`, [id, inputAction, finalDecision, layersChecked, riskScore]);
  },
};

// ── Metacognitive micro lessons ──
export const metacognitiveMicroLessons = {
  async insert(lesson: string, confidence: number, source: string): Promise<void> {
    await query(`INSERT INTO metacognitive_micro_lessons (id, lesson, confidence, source) VALUES ($1,$2,$3,$4)`, [randomUUID(), lesson, confidence, source]);
  },
};

export const metacognitiveMetaKnowledge = {
  async upsert(knowledge: string, confidence: number, source: string): Promise<void> {
    await query(`INSERT INTO metacognitive_meta_knowledge (id, knowledge, confidence, times_seen, source) VALUES ($1,$2,$3,1,$4) ON CONFLICT (knowledge) DO UPDATE SET confidence = $2, times_seen = metacognitive_meta_knowledge.times_seen + 1, source = $4, last_updated = now()`, [randomUUID(), knowledge, confidence, source]);
  },
};

// ── Introspection reports ──
export const introspectionReportsV2 = {
  async insert(id: string, detectedBiases: string[], coherenceScore: number, selfAwarenessScore: number, recommendations: string): Promise<void> {
    await query(`INSERT INTO introspection_reports_v2 (id, detected_biases, coherence_score, self_awareness_score, recommendations) VALUES ($1,$2,$3,$4,$5)`, [id, detectedBiases, coherenceScore, selfAwarenessScore, recommendations]);
  },
};

// ── Curiosity knowledge gaps ──
export const curiosityKnowledgeGaps = {
  async insert(gap: string): Promise<void> {
    await query(`INSERT INTO curiosity_knowledge_gaps (id, gap) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [randomUUID(), gap]);
  },
};

// ── Theory of mind models ──
export const tomModels = {
  async upsert(entityId: string, entityType: string, traits: unknown): Promise<void> {
    await query(`INSERT INTO tom_models (id, entity_id, entity_type, traits) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET traits = $4, updated_at = now()`, [randomUUID(), entityId, entityType, JSON.stringify(traits)]);
  },
};

// ── Capability registry ──
export const capabilityRegistryRepo = {
  async upsert(id: string, name: string, enabled: boolean, config: unknown): Promise<void> {
    await query(`INSERT INTO capability_registry (id, name, enabled, config) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET enabled = $3, config = $4, updated_at = now()`, [id, name, enabled, JSON.stringify(config)]);
  },
};

// ── Normative revisions ──
export const normativeRevisions = {
  async insert(id: string, commitmentId: string, originalDesc: string, revisedDesc: string): Promise<void> {
    await query(`INSERT INTO normative_revisions (id, commitment_id, original_description, revised_description) VALUES ($1,$2,$3,$4)`, [id, commitmentId, originalDesc, revisedDesc]);
  },
};

// ── Episodic buffer items ──
export const episodicBufferItems = {
  async insert(content: string, type: string, salience: number): Promise<void> {
    await query(`INSERT INTO episodic_buffer_items (id, content, type, salience) VALUES ($1,$2,$3,$4)`, [randomUUID(), content, type, salience]);
  },
};

// ── Inner monologue threads ──
export const innerMonologueThreads = {
  async insert(id: string, type: string, content: string): Promise<void> {
    await query(`INSERT INTO inner_monologue_threads (id, type, content) VALUES ($1,$2,$3)`, [id, type, content]);
  },
};

// ── Narrative history ──
export const narrativeHistoryRepo = {
  async insert(narrative: string, selfModel: string): Promise<void> {
    await query(`INSERT INTO narrative_history (id, narrative, self_model) VALUES ($1,$2,$3)`, [randomUUID(), narrative, selfModel]);
  },
};

// ── Environment relations ──
export const environmentRelations = {
  async insert(id: string, sourceId: string, targetId: string, relationType: string, strength: number): Promise<void> {
    await query(`INSERT INTO environment_relations (id, source_id, target_id, relation_type, strength) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO UPDATE SET strength = $5`, [id, sourceId, targetId, relationType, strength]);
  },
};

// ── Swarm artifacts ──
export const swarmArtifacts = {
  async insert(id: string, workspaceKey: string, producedBy: string, value: string): Promise<void> {
    await query(`INSERT INTO swarm_artifacts (id, workspace_key, produced_by, value) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO UPDATE SET value = $4`, [id, workspaceKey, producedBy, value]);
  },
};

// ── Swarm notes ──
export const swarmNotes = {
  async insert(agentId: string, note: string): Promise<void> {
    await query(`INSERT INTO swarm_notes (id, agent_id, note) VALUES ($1,$2,$3)`, [randomUUID(), agentId, note]);
  },
};

// ── Swarm federation tasks ──
export const swarmFederationTasks = {
  async insert(id: string, taskType: string, fromAgent: string, toAgent: string, skill: string): Promise<void> {
    await query(`INSERT INTO swarm_federation_tasks (id, task_type, from_agent, to_agent, skill) VALUES ($1,$2,$3,$4,$5)`, [id, taskType, fromAgent, toAgent, skill]);
  },
};
