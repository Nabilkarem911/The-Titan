import { getLogger } from '@titan/logging';
import { createProviderFromEnv, getGlobalWiring, wireCapabilities } from '@titan/agent-engine';
import { agentRuns } from '@titan/database';

const log = getLogger().child({ component: 'background-scheduler' });

const DREAM_INTERVAL_MS = 30 * 60 * 1000;
const STRATEGY_TUNER_INTERVAL_MS = 60 * 60 * 1000;
const BENCHMARK_HOUR = 3;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

// Phase 5 intervals
const HYPER_AGENT_INTERVAL_MS = 6 * 60 * 60 * 1000; // every 6 hours
const META_LEARNING_INTERVAL_MS = 2 * 60 * 60 * 1000; // every 2 hours
const HEURISTIC_CONSOLIDATION_INTERVAL_MS = 60 * 60 * 1000; // every hour
const GITHUB_MINER_HOUR = 2; // daily at 2 AM
const SELF_EVOLVING_HOUR = 4; // daily at 4 AM
// Benchmarking weekly on Fridays — reuse BENCHMARK_HOUR for weekly scheduling

let lastActivityTs = Date.now();
let intervals: ReturnType<typeof setInterval>[] = [];
let dreamTimeout: ReturnType<typeof setTimeout> | null = null;
let curiosityTimeout: ReturnType<typeof setTimeout> | null = null;
let githubMinerTimeout: ReturnType<typeof setTimeout> | null = null;
let selfEvolvingTimeout: ReturnType<typeof setTimeout> | null = null;
let weeklyBenchmarkTimeout: ReturnType<typeof setTimeout> | null = null;

function touchActivity(): void {
  lastActivityTs = Date.now();
}

function isIdle(): boolean {
  return Date.now() - lastActivityTs > IDLE_THRESHOLD_MS;
}

async function runDreamCycle(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.dreamMode) return;

  try {
    const recentRuns = await agentRuns.listRecent(20);
    const experiences = recentRuns
      .filter((r) => r.prompt)
      .map((r) => `Task: ${r.prompt} → Status: ${r.status}`)
      .slice(-10);

    if (experiences.length === 0) {
      log.info('no recent experiences for dream cycle');
      return;
    }

    const cycle = await wiring.dreamMode.dream(experiences);
    log.info(
      { cycleId: cycle.id, insights: cycle.insights?.length ?? 0, durationMs: cycle.durationMs },
      'dream cycle completed',
    );
  } catch (err) {
    log.warn({ err }, 'dream cycle failed');
  }
}

async function runCuriosityCycle(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.curiosityEngine) return;

  try {
    const task = await wiring.curiosityEngine.exploreNext();
    if (task) {
      log.info({ topic: task.topic, questions: task.questions.length }, 'curiosity exploration completed');
    }
  } catch (err) {
    log.warn({ err }, 'curiosity cycle failed');
  }
}

async function runCrossUserLearning(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.crossUserLearner) return;

  try {
    const recentRuns = await agentRuns.listRecent(50);
    for (const run of recentRuns) {
      if (!run.userId || !run.prompt) continue;
      const category = run.status === 'completed' ? 'task' : 'error_avoidance';
      const pattern = run.prompt.slice(0, 200);
      wiring.crossUserLearner.recordPattern(run.userId, pattern, category, run.status === 'completed');
    }
    const stats = wiring.crossUserLearner.stats();
    log.info({ totalPatterns: stats.totalPatterns, totalUsers: stats.totalUsers }, 'cross-user learning completed');
  } catch (err) {
    log.warn({ err }, 'cross-user learning failed');
  }
}

async function runMetacognitiveConsolidation(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.metacognitiveConsolidation) return;

  try {
    const result = await wiring.metacognitiveConsolidation.consolidate();
    log.info(
      { consolidationId: result.id, lessons: result.microLessonsGenerated },
      'metacognitive consolidation completed',
    );
  } catch (err) {
    log.warn({ err }, 'metacognitive consolidation failed');
  }
}

async function runStrategyTuner(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.strategyTuner) return;

  try {
    const performance = wiring.strategyTuner.getPerformance();
    log.info({ strategies: performance.length }, 'strategy tuner reviewed performance');
  } catch (err) {
    log.warn({ err }, 'strategy tuner failed');
  }
}

async function runBenchmarkSuite(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.benchmarkingSuite) return;

  try {
    const result = await wiring.benchmarkingSuite.runSuite('standard');
    log.info(
      { suiteId: result.id, tasks: result.results.length, avgScore: result.avgScore },
      'benchmark suite completed',
    );
  } catch (err) {
    log.warn({ err }, 'benchmark suite failed');
  }
}

// ── Phase 5: New background tasks ──

async function runHyperAgentCycle(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.hyperAgent) return;

  try {
    const cycle = await wiring.hyperAgent.runCycle();
    log.info(
      { cycleId: cycle.id, weaknesses: cycle.introspection.weaknesses.length, proposals: cycle.improvements.length },
      'hyper-agent cycle completed',
    );
  } catch (err) {
    log.warn({ err }, 'hyper-agent cycle failed');
  }
}

async function runMetaLearningOptimization(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.metaLearningOptimizer) return;

  try {
    const recentRuns = await agentRuns.listRecent(50);
    const completed = recentRuns.filter(r => r.status === 'completed');
    const failed = recentRuns.filter(r => r.status === 'failed');
    const successRate = recentRuns.length > 0 ? completed.length / recentRuns.length : 0;
    const avgDuration = recentRuns.length > 0
      ? recentRuns.reduce((s, r) => s + (r.updatedAt.getTime() - r.createdAt.getTime()), 0) / recentRuns.length
      : 0;
    const avgTokens = recentRuns.length > 0
      ? recentRuns.reduce((s, r) => s + (r.tokensUsed ?? 0), 0) / recentRuns.length
      : 0;

    const result = await wiring.metaLearningOptimizer.optimize({
      successRate,
      avgDuration,
      avgTokens,
      errorPatterns: failed.map(r => r.prompt?.slice(0, 100) ?? '').slice(0, 10),
    });
    log.info(
      { optimizationId: result.id, improvement: result.improvement, configAfter: result.configAfter },
      'meta-learning optimization completed',
    );
  } catch (err) {
    log.warn({ err }, 'meta-learning optimization failed');
  }
}

async function runHeuristicConsolidation(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.heuristicExtractor) return;

  try {
    const recentRuns = await agentRuns.listRecent(20);
    for (const run of recentRuns) {
      if (!run.prompt) continue;
      const outcome = run.status === 'completed' ? 'success' : 'failure';
      const trajectory = `Task: ${run.prompt.slice(0, 200)} → Status: ${run.status}`;
      await wiring.heuristicExtractor.extract(run.id, outcome, trajectory);
    }
    log.info({ runsProcessed: recentRuns.length }, 'heuristic consolidation completed');
  } catch (err) {
    log.warn({ err }, 'heuristic consolidation failed');
  }
}

async function runGitHubMiner(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.githubMiner) return;

  try {
    const queries = ['typescript agent framework', 'LLM tool calling', 'autonomous agent patterns'];
    const query = queries[Math.floor(Math.random() * queries.length)];
    const repos = await wiring.githubMiner.searchRepositories(query, 'typescript');
    let totalPatterns = 0;
    for (const repo of repos.slice(0, 3)) {
      const patterns = await wiring.githubMiner.cloneAndExtract(repo);
      totalPatterns += patterns.length;
    }
    log.info({ query, reposFound: repos.length, patternsExtracted: totalPatterns }, 'github miner completed');
  } catch (err) {
    log.warn({ err }, 'github miner failed');
  }
}

async function runSelfEvolvingCode(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.selfEvolvingCode) return;

  try {
    const recentRuns = await agentRuns.listRecent(30);
    const completed = recentRuns.filter(r => r.status === 'completed');
    const successRate = recentRuns.length > 0 ? completed.length / recentRuns.length : 0;
    const avgDuration = recentRuns.length > 0
      ? recentRuns.reduce((s, r) => s + (r.updatedAt.getTime() - r.createdAt.getTime()), 0) / recentRuns.length
      : 0;
    const avgTokens = recentRuns.length > 0
      ? recentRuns.reduce((s, r) => s + (r.tokensUsed ?? 0), 0) / recentRuns.length
      : 0;

    const fitness = await wiring.selfEvolvingCode.evaluateFitness(successRate, avgDuration, avgTokens, 0.5);
    log.info(
      { overall: fitness.overall, testPassRate: fitness.testPassRate, speed: fitness.executionSpeedMs },
      'self-evolving code fitness evaluated',
    );
  } catch (err) {
    log.warn({ err }, 'self-evolving code cycle failed');
  }
}

async function runWeeklyBenchmark(): Promise<void> {
  const wiring = getGlobalWiring();
  if (!wiring?.benchmarkingSuite) return;

  try {
    const result = await wiring.benchmarkingSuite.runSuite('comprehensive');
    log.info(
      { suiteId: result.id, tasks: result.results.length, avgScore: result.avgScore, type: 'weekly' },
      'weekly benchmark suite completed',
    );
  } catch (err) {
    log.warn({ err }, 'weekly benchmark suite failed');
  }
}

function scheduleDreamCycle(): void {
  intervals.push(
    setInterval(() => {
      runDreamCycle().catch(() => {});
    }, DREAM_INTERVAL_MS),
  );
  log.info({ intervalMs: DREAM_INTERVAL_MS }, 'dream cycle scheduled');
}

function scheduleCuriosityEngine(): void {
  function scheduleNext() {
    curiosityTimeout = setTimeout(
      async () => {
        if (isIdle()) {
          await runCuriosityCycle().catch(() => {});
        }
        scheduleNext();
      },
      60 * 1000,
    );
  }
  scheduleNext();
  log.info('curiosity engine scheduled (idle-triggered)');
}

function scheduleCrossUserLearning(): void {
  intervals.push(
    setInterval(() => {
      runCrossUserLearning().catch(() => {});
    }, 10 * 60 * 1000),
  );
  log.info('cross-user learning scheduled (every 10 min)');
}

function scheduleMetacognitiveConsolidation(): void {
  intervals.push(
    setInterval(() => {
      runMetacognitiveConsolidation().catch(() => {});
    }, 15 * 60 * 1000),
  );
  log.info('metacognitive consolidation scheduled (every 15 min)');
}

function scheduleStrategyTuner(): void {
  intervals.push(
    setInterval(() => {
      runStrategyTuner().catch(() => {});
    }, STRATEGY_TUNER_INTERVAL_MS),
  );
  log.info({ intervalMs: STRATEGY_TUNER_INTERVAL_MS }, 'strategy tuner scheduled');
}

function scheduleBenchmarkSuite(): void {
  function scheduleNextBenchmark() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(BENCHMARK_HOUR, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const msUntilNext = next.getTime() - now.getTime();

    dreamTimeout = setTimeout(async () => {
      await runBenchmarkSuite().catch(() => {});
      scheduleNextBenchmark();
    }, msUntilNext);

    log.info({ nextRun: next.toISOString() }, 'benchmark suite scheduled');
  }
  scheduleNextBenchmark();
}

// ── Phase 5: New task schedulers ──

function scheduleHyperAgent(): void {
  intervals.push(
    setInterval(() => {
      runHyperAgentCycle().catch(() => {});
    }, HYPER_AGENT_INTERVAL_MS),
  );
  log.info({ intervalMs: HYPER_AGENT_INTERVAL_MS }, 'hyper-agent scheduled (every 6 hours)');
}

function scheduleMetaLearningOptimizer(): void {
  intervals.push(
    setInterval(() => {
      runMetaLearningOptimization().catch(() => {});
    }, META_LEARNING_INTERVAL_MS),
  );
  log.info({ intervalMs: META_LEARNING_INTERVAL_MS }, 'meta-learning optimizer scheduled (every 2 hours)');
}

function scheduleHeuristicConsolidation(): void {
  intervals.push(
    setInterval(() => {
      runHeuristicConsolidation().catch(() => {});
    }, HEURISTIC_CONSOLIDATION_INTERVAL_MS),
  );
  log.info({ intervalMs: HEURISTIC_CONSOLIDATION_INTERVAL_MS }, 'heuristic consolidation scheduled (every hour)');
}

function scheduleGitHubMiner(): void {
  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(GITHUB_MINER_HOUR, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const msUntilNext = next.getTime() - now.getTime();

    githubMinerTimeout = setTimeout(async () => {
      await runGitHubMiner().catch(() => {});
      scheduleNext();
    }, msUntilNext);

    log.info({ nextRun: next.toISOString() }, 'github miner scheduled (daily at 2 AM)');
  }
  scheduleNext();
}

function scheduleSelfEvolvingCode(): void {
  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    next.setHours(SELF_EVOLVING_HOUR, 0, 0, 0);
    if (next <= now) {
      next.setDate(next.getDate() + 1);
    }
    const msUntilNext = next.getTime() - now.getTime();

    selfEvolvingTimeout = setTimeout(async () => {
      await runSelfEvolvingCode().catch(() => {});
      scheduleNext();
    }, msUntilNext);

    log.info({ nextRun: next.toISOString() }, 'self-evolving code scheduled (daily at 4 AM)');
  }
  scheduleNext();
}

function scheduleWeeklyBenchmark(): void {
  function scheduleNext() {
    const now = new Date();
    const next = new Date(now);
    // Find next Friday
    const dayOfWeek = now.getDay(); // 0=Sun, 5=Fri
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    next.setDate(now.getDate() + (daysUntilFriday === 0 && now.getHours() >= BENCHMARK_HOUR ? 7 : daysUntilFriday));
    next.setHours(BENCHMARK_HOUR, 0, 0, 0);
    const msUntilNext = next.getTime() - now.getTime();

    weeklyBenchmarkTimeout = setTimeout(async () => {
      await runWeeklyBenchmark().catch(() => {});
      scheduleNext();
    }, msUntilNext);

    log.info({ nextRun: next.toISOString() }, 'weekly benchmark scheduled (Fridays)');
  }
  scheduleNext();
}

export function startBackgroundScheduler(): void {
  const llm = createProviderFromEnv();
  if (!llm) {
    log.warn('no LLM provider configured — background scheduler disabled');
    return;
  }

  wireCapabilities(llm);

  // Phase 2 tasks
  scheduleDreamCycle();
  scheduleCuriosityEngine();
  scheduleCrossUserLearning();
  scheduleMetacognitiveConsolidation();
  scheduleStrategyTuner();
  scheduleBenchmarkSuite();

  // Phase 5 tasks
  scheduleHyperAgent();
  scheduleMetaLearningOptimizer();
  scheduleHeuristicConsolidation();
  scheduleGitHubMiner();
  scheduleSelfEvolvingCode();
  scheduleWeeklyBenchmark();

  log.info('background scheduler started — 12 background tasks active');
}

export function stopBackgroundScheduler(): void {
  for (const iv of intervals) clearInterval(iv);
  intervals = [];
  if (dreamTimeout) clearTimeout(dreamTimeout);
  if (curiosityTimeout) clearTimeout(curiosityTimeout);
  if (githubMinerTimeout) clearTimeout(githubMinerTimeout);
  if (selfEvolvingTimeout) clearTimeout(selfEvolvingTimeout);
  if (weeklyBenchmarkTimeout) clearTimeout(weeklyBenchmarkTimeout);
  dreamTimeout = null;
  curiosityTimeout = null;
  githubMinerTimeout = null;
  selfEvolvingTimeout = null;
  weeklyBenchmarkTimeout = null;
  log.info('background scheduler stopped');
}

export { touchActivity };
