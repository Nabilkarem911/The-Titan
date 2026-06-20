-- =============================================================================
-- 0027 - Add updated_at triggers for agent_runs and agent_steps
-- =============================================================================

-- Trigger for agent_runs
DROP TRIGGER IF EXISTS agent_runs_set_updated_at ON agent_runs;
CREATE TRIGGER agent_runs_set_updated_at
  BEFORE UPDATE ON agent_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_set_updated_at();

-- Trigger for agent_steps
DROP TRIGGER IF EXISTS agent_steps_set_updated_at ON agent_steps;
CREATE TRIGGER agent_steps_set_updated_at
  BEFORE UPDATE ON agent_steps
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_set_updated_at();
