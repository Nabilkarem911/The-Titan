import { query } from './client.js';

function makeSimpleRepo(tableName: string, columns: string[]) {
  return {
    async insert(id: string, data: Record<string, unknown>): Promise<void> {
      const cols = ['id', ...columns];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = [id, ...columns.map((c) => data[c] ?? null)];
      await query(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        values,
      );
    },

    async upsert(id: string, data: Record<string, unknown>, updateCols: string[]): Promise<void> {
      const cols = ['id', ...columns];
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const values = [id, ...columns.map((c) => data[c] ?? null)];
      const updateSet = updateCols.map((c) => `${c} = EXCLUDED.${c}`).join(', ');
      await query(
        `INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders}) ON CONFLICT (id) DO UPDATE SET ${updateSet}`,
        values,
      );
    },

    async getRecent(limit = 100): Promise<Record<string, unknown>[]> {
      const result = await query(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1`, [limit]);
      return result.rows as Record<string, unknown>[];
    },

    async findById(id: string): Promise<Record<string, unknown> | null> {
      const result = await query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
      return (result.rows[0] as Record<string, unknown>) ?? null;
    },

    async listAll(limit = 1000): Promise<Record<string, unknown>[]> {
      const result = await query(`SELECT * FROM ${tableName} ORDER BY created_at DESC LIMIT $1`, [limit]);
      return result.rows as Record<string, unknown>[];
    },

    async deleteById(id: string): Promise<void> {
      await query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
    },

    async count(): Promise<number> {
      const result = await query(`SELECT COUNT(*) as cnt FROM ${tableName}`);
      return Number((result.rows[0] as Record<string, unknown>).cnt ?? 0);
    },
  };
}

export const dreamInsights = makeSimpleRepo('dream_insights', ['report_id', 'type', 'content', 'confidence']);
export const promptVariants = makeSimpleRepo('prompt_variants', ['prompt_key', 'variant_text', 'success_rate', 'avg_score', 'total_uses']);
export const strategyTunerRecords = makeSimpleRepo('strategy_tuner_records', ['task_type', 'strategy', 'success', 'duration_ms']);
export const metaLearningResults = makeSimpleRepo('meta_learning_results', ['optimization_type', 'target', 'before_score', 'after_score', 'improvement', 'config']);
export const userFeedback = makeSimpleRepo('user_feedback', ['run_id', 'user_id', 'rating', 'comment', 'tags']);
export const tomAnalyses = makeSimpleRepo('tom_analyses', ['entity_id', 'perspective', 'confidence', 'prediction', 'correct']);
export const emotionReadings = makeSimpleRepo('emotion_readings', ['user_id', 'valence', 'arousal', 'dominant_emotion', 'empathy_score', 'strategy']);
export const curiosityExplorations = makeSimpleRepo('curiosity_explorations', ['skill_name', 'domain', 'status', 'proficiency', 'findings']);
export const sycophancyAssessments = makeSimpleRepo('sycophancy_assessments', ['input_text', 'sycophancy_score', 'hedge_words', 'recommendation']);
export const metacognitiveReflections = makeSimpleRepo('metacognitive_reflections', ['category', 'content', 'confidence', 'lesson']);
export const guardrailResults = makeSimpleRepo('guardrail_results', ['action', 'risk_level', 'decision', 'risk_categories', 'reasoning']);
export const multilayerGuardrailResults = makeSimpleRepo('multilayer_guardrail_results', ['input_text', 'final_action', 'layer_results']);
export const normativeCommitments = makeSimpleRepo('normative_commitments', ['norm', 'commitment', 'status']);
export const normativeConflicts = makeSimpleRepo('normative_conflicts', ['norm1', 'norm2', 'resolution']);
export const digitalTwinSnapshots = makeSimpleRepo('digital_twin_snapshots', ['metrics', 'predictions', 'alerts']);
export const environmentEntities = makeSimpleRepo('environment_entities', ['type', 'name', 'properties']);
export const environmentEvents = makeSimpleRepo('environment_events', ['entity_id', 'event_type', 'data']);
export const autonomousLoopResults = makeSimpleRepo('autonomous_loop_results', ['task', 'status', 'result', 'duration_ms']);
export const hyperAgentCycles = makeSimpleRepo('hyper_agent_cycles', ['cycle', 'improvement', 'gain', 'kept', 'config']);
export const neuroSymbolicResults = makeSimpleRepo('neuro_symbolic_results', ['query', 'approach', 'result', 'confidence', 'rules_used']);
export const hypothesisTests = makeSimpleRepo('hypothesis_tests', ['hypothesis', 'test_method', 'result', 'confidence']);
export const discoveredTools = makeSimpleRepo('discovered_tools', ['name', 'source', 'description', 'reliability', 'installed']);
export const synthesizedSkills = makeSimpleRepo('synthesized_skills', ['name', 'description', 'proficiency', 'verified', 'code']);
export const benchmarkResults = makeSimpleRepo('benchmark_results', ['suite_name', 'task_name', 'score', 'duration_ms', 'model']);
export const trtResults = makeSimpleRepo('trt_results', ['problem', 'rounds', 'answer', 'confidence', 'abstained', 'knowledge_gained']);
export const modelRouterUsage = makeSimpleRepo('model_router_usage', ['model', 'task_type', 'tokens_used', 'latency_ms', 'success']);
export const apexPatches = makeSimpleRepo('apex_patches', ['cycle', 'description', 'patch', 'applied', 'performance_gain']);
export const swarmTopologies = makeSimpleRepo('swarm_topologies', ['name', 'config', 'performance', 'is_current']);
export const swarmCollectiveMemory = makeSimpleRepo('swarm_collective_memory', ['key', 'value', 'agent_id']);
export const swarmMessages = makeSimpleRepo('swarm_messages', ['from_agent', 'to_agent', 'channel', 'content']);
export const temporalEvents = makeSimpleRepo('temporal_events', ['event_type', 'content', 'timestamp_predicted', 'confidence']);
export const selfPlayArchive = makeSimpleRepo('self_play_archive', ['task', 'outcome', 'performance', 'mutation', 'generation']);
export const screenAlerts = makeSimpleRepo('screen_alerts', ['alert_type', 'description', 'screenshot_hash', 'severity']);
export const webMcpInvocations = makeSimpleRepo('web_mcp_invocations', ['server', 'tool', 'params', 'result', 'success']);
export const mcpGovernanceAudit = makeSimpleRepo('mcp_governance_audit', ['server', 'action', 'policy_violated', 'decision']);
export const visualWorkflows = makeSimpleRepo('visual_workflows', ['name', 'description', 'nodes', 'edges', 'status']);
export const federatedUpdates = makeSimpleRepo('federated_updates', ['model', 'update_data', 'round', 'source']);
