import { getLogger } from '@titan/logging';
import { createProviderFromEnv, getGlobalWiring, wireCapabilities } from '@titan/agent-engine';
import { agentRuns } from '@titan/database';

const log = getLogger().child({ component: 'background-scheduler' });

const DREAM_INTERVAL_MS = 30 * 60 * 1000;
const STRATEGY_TUNER_INTERVAL_MS = 60 * 60 * 1000;
const BENCHMARK_HOUR = 3;
const IDLE_THRESHOLD_MS = 5 * 60 * 1000;

let lastActivityTs = Date.now();
let intervals: ReturnType<typeof setInterval>[] = [];
let dreamTimeout: ReturnType<typeof setTimeout> | null = null;
let curiosityTimeout: ReturnType<typeof setTimeout> | null = null;

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

export function startBackgroundScheduler(): void {
  const llm = createProviderFromEnv();
  if (!llm) {
    log.warn('no LLM provider configured — background scheduler disabled');
    return;
  }

  wireCapabilities(llm);

  scheduleDreamCycle();
  scheduleCuriosityEngine();
  scheduleCrossUserLearning();
  scheduleMetacognitiveConsolidation();
  scheduleStrategyTuner();
  scheduleBenchmarkSuite();

  log.info('background scheduler started — 6 background tasks active');
}

export function stopBackgroundScheduler(): void {
  for (const iv of intervals) clearInterval(iv);
  intervals = [];
  if (dreamTimeout) clearTimeout(dreamTimeout);
  if (curiosityTimeout) clearTimeout(curiosityTimeout);
  dreamTimeout = null;
  curiosityTimeout = null;
  log.info('background scheduler stopped');
}

export { touchActivity };
