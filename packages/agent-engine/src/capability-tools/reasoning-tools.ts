import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';
import { TestTimeRecursiveThinking } from '../reasoning/test-time-recursive-thinking.js';
import { SmartModelRouter } from '../reasoning/multi-model-router.js';

export function registerReasoningTools(wiring: WiredCapabilities, llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  registry.register({
    name: 'dream_from_experiences',
    description: 'Run dream mode consolidation on past experiences to extract insights, patterns, and stale facts',
    tags: ['reasoning', 'dream', 'memory'],
    schema: {
      experiences: { type: 'string', description: 'JSON array of experience objects with prompt, strategy, toolsUsed, success, timestamp' },
    },
    requiredParams: ['experiences'],
    handler: async (params: unknown) => {
      const p = params as { experiences: string };
      const experiences = JSON.parse(p.experiences) as Array<{ id: string; runId: string; prompt: string; strategy: string; toolsUsed: string[]; success: boolean; tokensUsed: number; durationMs: number; timestamp: string }>;
      return wiring.dreamMode.dreamFromExperiences(experiences as any);
    },
  });

  registry.register({
    name: 'dream_stats',
    description: 'Get dream mode statistics: total dreams, insights, running status',
    tags: ['reasoning', 'dream'],
    handler: async () => wiring.dreamMode.stats(),
  });

  registry.register({
    name: 'dream_insights',
    description: 'Get dream insights filtered by type (pattern, preference, stale_fact, skill_gap, optimization)',
    tags: ['reasoning', 'dream', 'insights'],
    schema: {
      type: { type: 'string', description: 'Filter by insight type: pattern | preference | stale_fact | skill_gap | optimization (optional)' },
    },
    handler: async (params: unknown) => {
      const p = params as { type?: string };
      return wiring.dreamMode.getInsights(p.type as any);
    },
  });

  registry.register({
    name: 'hypothesis_generate',
    description: 'Generate testable hypotheses for a problem. Returns hypotheses with rationale, test actions, and confidence.',
    tags: ['reasoning', 'hypothesis', 'science'],
    schema: {
      problem: { type: 'string', description: 'The problem to generate hypotheses for' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    requiredParams: ['problem'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; context?: string };
      return wiring.hypothesisTester.generateHypotheses(p.problem, p.context);
    },
  });

  registry.register({
    name: 'hypothesis_evaluate',
    description: 'Evaluate test results for a hypothesis — confirms or refutes the hypothesis',
    tags: ['reasoning', 'hypothesis', 'science'],
    schema: { hypothesisId: { type: 'string', description: 'The hypothesis ID to evaluate' }, testResults: { type: 'string', description: 'Results from running the test action' } },
    requiredParams: ['hypothesisId', 'testResults'],
    handler: async (params: unknown) => {
      const p = params as { hypothesisId: string; testResults: string };
      return wiring.hypothesisTester.evaluateResult({ id: p.hypothesisId, problem: '', hypothesis: '', testAction: '', confidence: 0 } as unknown as Parameters<typeof wiring.hypothesisTester.evaluateResult>[0], p.testResults);
    },
  });

  registry.register({
    name: 'self_heal_debug',
    description: 'Debug and auto-repair a bug using self-healing debugger. Provide error details and get diagnosis + fix.',
    tags: ['reasoning', 'debug', 'self-healing'],
    schema: {
      errorMessage: { type: 'string', description: 'The error message' },
      errorType: { type: 'string', description: 'Error type (e.g. TypeError, ReferenceError)' },
      filePath: { type: 'string', description: 'File where the error occurred (optional)' },
      stackTrace: { type: 'string', description: 'Stack trace (optional)' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    requiredParams: ['errorMessage', 'errorType'],
    handler: async (params: unknown) => {
      const p = params as { errorMessage: string; errorType: string; filePath?: string; stackTrace?: string; context?: string };
      return wiring.selfHealingDebugger.debug({
        id: `bug-${Date.now()}`,
        errorMessage: p.errorMessage,
        errorType: p.errorType,
        filePath: p.filePath ?? '',
        stackTrace: p.stackTrace,
        context: p.context,
        reportedAt: new Date(),
      });
    },
  });

  registry.register({
    name: 'evolutionary_solve',
    description: 'Solve a problem using evolutionary algorithm — generates population, evolves through generations with mutation and selection',
    tags: ['reasoning', 'evolution', 'solver'],
    schema: {
      problem: { type: 'string', description: 'The problem to solve' },
      populationSize: { type: 'number', description: 'Population size (default 4)' },
      generations: { type: 'number', description: 'Number of generations (default 3)' },
    },
    requiredParams: ['problem'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; populationSize?: number; generations?: number };
      return wiring.evolutionarySolver.evolve(p.problem, { populationSize: p.populationSize, generations: p.generations });
    },
  });

  registry.register({
    name: 'neuro_symbolic_reason',
    description: 'Hybrid neuro-symbolic reasoning — combines neural prediction with symbolic rules for transparent reasoning',
    tags: ['reasoning', 'neuro-symbolic', 'logic'],
    schema: {
      query: { type: 'string', description: 'The reasoning query' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const p = params as { query: string };
      return wiring.neuroSymbolic.reason(p.query);
    },
  });

  registry.register({
    name: 'discover_tools',
    description: 'Dynamically discover missing tools or capabilities needed for a task',
    tags: ['reasoning', 'discovery', 'tools'],
    schema: {
      taskDescription: { type: 'string', description: 'Description of the task' },
      missingCapabilities: { type: 'string', description: 'Comma-separated missing capabilities (optional)' },
    },
    requiredParams: ['taskDescription'],
    handler: async (params: unknown) => {
      const p = params as { taskDescription: string; missingCapabilities?: string };
      return wiring.toolDiscovery.discover(p.taskDescription, p.missingCapabilities?.split(',').map(s => s.trim()));
    },
  });

  registry.register({
    name: 'synthesize_skill',
    description: 'Autonomously synthesize a new skill from a task description',
    tags: ['reasoning', 'skill', 'synthesis'],
    schema: {
      taskDescription: { type: 'string', description: 'Description of the task requiring a new skill' },
    },
    requiredParams: ['taskDescription'],
    handler: async (params: unknown) => {
      const p = params as { taskDescription: string };
      return wiring.skillSynthesis.synthesize(p.taskDescription);
    },
  });

  registry.register({
    name: 'hyper_agent_cycle',
    description: 'Run a hyper-agent cycle: introspection → improvement → evaluation loop',
    tags: ['reasoning', 'hyper-agent', 'self-improvement'],
    handler: async () => wiring.hyperAgent.runCycle(),
  });

  registry.register({
    name: 'apex_evolve',
    description: 'Run an apex evolution cycle — harness patching, principle distillation, and topology evolution',
    tags: ['reasoning', 'evolution', 'apex'],
    schema: {
      runs: { type: 'string', description: 'JSON array of recent agent runs' },
      successRate: { type: 'number', description: 'Recent success rate 0-1' },
      avgLatency: { type: 'number', description: 'Average latency in ms' },
      avgTokens: { type: 'number', description: 'Average tokens used' },
    },
    handler: async (params: unknown) => {
      const p = params as { runs?: string; successRate?: number; avgLatency?: number; avgTokens?: number };
      const runs = p.runs ? JSON.parse(p.runs) : [];
      return wiring.apexEvolution.runEvolutionCycle(runs, {
        successRate: p.successRate ?? 0.5,
        avgLatency: p.avgLatency ?? 1000,
        avgTokens: p.avgTokens ?? 1000,
      });
    },
  });

  registry.register({
    name: 'benchmark_run',
    description: 'Run a benchmark suite to evaluate agent performance on standardized tasks',
    tags: ['reasoning', 'benchmark', 'evaluation'],
    schema: {
      suiteName: { type: 'string', description: 'Name of the benchmark suite (e.g. "reasoning", "code", "math")' },
    },
    requiredParams: ['suiteName'],
    handler: async (params: unknown) => {
      const p = params as { suiteName: string };
      return wiring.benchmarkingSuite.runSuite(p.suiteName);
    },
  });

  registry.register({
    name: 'execution_state_stats',
    description: 'Get execution state memory statistics: checkpoints, active runs, completed runs',
    tags: ['reasoning', 'execution', 'memory'],
    handler: async () => wiring.executionStateMemory.stats(),
  });

  registry.register({
    name: 'self_rewrite_diagnose',
    description: 'Diagnose agent performance issues and propose self-rewrite improvements',
    tags: ['reasoning', 'self-rewrite', 'improvement'],
    schema: {
      successRate: { type: 'number', description: 'Recent success rate 0-1' },
      avgDuration: { type: 'number', description: 'Average duration in ms' },
      avgTokens: { type: 'number', description: 'Average tokens used' },
      errorPatterns: { type: 'string', description: 'Comma-separated error patterns' },
    },
    handler: async (params: unknown) => {
      const p = params as { successRate?: number; avgDuration?: number; avgTokens?: number; errorPatterns?: string };
      return wiring.selfRewriter.diagnose({
        successRate: p.successRate ?? 0.5,
        avgDuration: p.avgDuration ?? 1000,
        avgTokens: p.avgTokens ?? 1000,
        errorPatterns: p.errorPatterns?.split(',').map(s => s.trim()) ?? [],
      });
    },
  });

  registry.register({
    name: 'self_rewrite_propose',
    description: 'Propose a self-improvement to the agent logic — generates a code patch proposal',
    tags: ['reasoning', 'self-rewrite', 'improvement'],
    schema: { module: { type: 'string', description: 'The module to improve' }, analysis: { type: 'string', description: 'Analysis of what needs improvement' } },
    requiredParams: ['module', 'analysis'],
    handler: async (params: unknown) => {
      const p = params as { module: string; analysis: string };
      return wiring.selfRewriter.proposeImprovement({ successRate: 0.5, avgDuration: 0, avgTokens: 0, errorPatterns: [p.analysis] });
    },
  });

  registry.register({
    name: 'self_rewrite_apply',
    description: 'Apply a proposed self-improvement — tests in sandbox, auto-rolls back if worse',
    tags: ['reasoning', 'self-rewrite', 'apply'],
    schema: {
      proposalId: { type: 'string', description: 'The proposal ID to apply' },
      targetModule: { type: 'string', description: 'Target module name' },
      proposedChange: { type: 'string', description: 'Description of the change' },
      proposedCode: { type: 'string', description: 'The new code to apply' },
      expectedImprovement: { type: 'string', description: 'Expected improvement description' },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
      riskLevel: { type: 'string', description: 'Risk level: low, medium, or high' },
      currentPerformance: { type: 'number', description: 'Current performance score 0-1' },
    },
    requiredParams: ['proposalId', 'targetModule', 'proposedCode'],
    handler: async (params: unknown) => {
      const p = params as {
        proposalId: string;
        targetModule: string;
        proposedChange?: string;
        proposedCode: string;
        expectedImprovement?: string;
        confidence?: number;
        riskLevel?: 'low' | 'medium' | 'high';
        currentPerformance?: number;
      };
      return wiring.selfRewriter.evaluateAndApply({
        id: p.proposalId,
        targetModule: p.targetModule,
        currentPerformance: p.currentPerformance ?? 0.5,
        proposedChange: p.proposedChange ?? '',
        proposedCode: p.proposedCode,
        expectedImprovement: p.expectedImprovement ?? '',
        confidence: p.confidence ?? 0.5,
        riskLevel: p.riskLevel ?? 'medium',
      });
    },
  });

  registry.register({
    name: 'causal_replay',
    description: 'Analyze a failed run to determine which step caused the failure using causal attribution',
    tags: ['reasoning', 'causal', 'debug'],
    schema: { run: { type: 'object', description: 'The run object with id, status, and steps' } },
    requiredParams: ['run'],
    handler: async (params: unknown) => {
      const p = params as { run: Record<string, unknown> };
      return wiring.causalReplay.analyzeRun(p.run as unknown as Parameters<typeof wiring.causalReplay.analyzeRun>[0]);
    },
  });

  registry.register({
    name: 'trt_solve',
    description: 'Solve a hard problem using test-time recursive thinking — multi-strategy iterative improvement',
    tags: ['reasoning', 'trt', 'recursive'],
    schema: { problem: { type: 'string', description: 'The problem to solve' }, maxRounds: { type: 'number', description: 'Maximum recursion rounds (default: 4)' } },
    requiredParams: ['problem'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; maxRounds?: number };
      const trt = new TestTimeRecursiveThinking(llm);
      return trt.solve(p.problem, { maxRounds: p.maxRounds });
    },
  });

  registry.register({
    name: 'esm_checkpoint',
    description: 'Save a checkpoint for a long-running task — enables resume after crash',
    tags: ['reasoning', 'esm', 'checkpoint'],
    schema: { runId: { type: 'string' }, stepIndex: { type: 'number' }, stepCount: { type: 'number' }, state: { type: 'object' } },
    requiredParams: ['runId', 'stepIndex', 'stepCount', 'state'],
    handler: async (params: unknown) => {
      const p = params as { runId: string; stepIndex: number; stepCount: number; state: { messages: { role: string; content: string }[]; toolResults: { tool: string; result: unknown }[]; plan: string[]; variables: Record<string, unknown>; intermediateResults: unknown[] } };
      return wiring.executionStateMemory.checkpoint(p.runId, p.stepIndex, p.stepCount, p.state);
    },
  });

  registry.register({
    name: 'esm_resume',
    description: 'Resume a task from a saved checkpoint after a crash or interruption',
    tags: ['reasoning', 'esm', 'resume'],
    schema: { checkpointId: { type: 'string', description: 'The checkpoint ID to resume from' } },
    requiredParams: ['checkpointId'],
    handler: async (params: unknown) => {
      const p = params as { checkpointId: string };
      return wiring.executionStateMemory.resume(p.checkpointId);
    },
  });

  registry.register({
    name: 'router_route',
    description: 'Route input to the best model based on complexity, cost, and capability matching',
    tags: ['reasoning', 'router', 'model'],
    schema: { input: { type: 'string', description: 'The input text to route' }, taskType: { type: 'string', description: 'Task type hint (e.g. simple-qa, architecture)' } },
    requiredParams: ['input'],
    handler: async (params: unknown) => {
      const p = params as { input: string; taskType?: string };
      const router = new SmartModelRouter();
      return router.route(p.input, { taskType: p.taskType });
    },
  });
}
