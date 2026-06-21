import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'autonomous-loop' });

export interface AutonomousConfig {
  intervalMs: number;
  maxConcurrentTasks: number;
  enabled: boolean;
  checks: AutonomousCheck[];
}

export interface AutonomousCheck {
  id: string;
  name: string;
  description: string;
  prompt: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  lastRun: Date | null;
  lastResult: 'ok' | 'warning' | 'error' | null;
  runCount: number;
}

export interface AutonomousResult {
  checkId: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  actions: string[];
  timestamp: Date;
}

const DEFAULT_CHECKS: AutonomousCheck[] = [
  {
    id: 'server-health',
    name: 'Server Health Check',
    description: 'Check server CPU, memory, disk, and uptime',
    prompt: 'Check the server health: run uptime, df -h, free -m, and report any issues',
    severity: 'high',
    enabled: true,
    lastRun: null,
    lastResult: null,
    runCount: 0,
  },
  {
    id: 'error-logs',
    name: 'Error Log Scanner',
    description: 'Scan recent logs for errors and exceptions',
    prompt: 'Check the last 100 lines of application logs for errors, exceptions, or warnings',
    severity: 'medium',
    enabled: true,
    lastRun: null,
    lastResult: null,
    runCount: 0,
  },
  {
    id: 'docker-containers',
    name: 'Docker Container Health',
    description: 'Check all Docker containers are running',
    prompt: 'Run docker ps and check if any containers are stopped or unhealthy',
    severity: 'high',
    enabled: true,
    lastRun: null,
    lastResult: null,
    runCount: 0,
  },
  {
    id: 'disk-usage',
    name: 'Disk Usage Monitor',
    description: 'Check disk usage and alert if above 80%',
    prompt: 'Check disk usage with df -h and alert if any partition is above 80% full',
    severity: 'critical',
    enabled: true,
    lastRun: null,
    lastResult: null,
    runCount: 0,
  },
];

export class AutonomousLoop {
  private config: AutonomousConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private results: AutonomousResult[] = [];
  private maxResults = 200;

  constructor(
    private llm: LlmProvider,
    private executeTool: (toolName: string, params: unknown) => Promise<{ success: boolean; data?: unknown; error?: string }>,
    config?: Partial<AutonomousConfig>,
  ) {
    this.config = {
      intervalMs: 3600_000, // 1 hour default
      maxConcurrentTasks: 3,
      enabled: false,
      checks: DEFAULT_CHECKS,
      ...config,
    };
  }

  start(): void {
    if (this.timer || !this.config.enabled) return;
    log.info({ intervalMs: this.config.intervalMs }, 'autonomous loop started');
    this.timer = setInterval(() => this.tick(), this.config.intervalMs);
    this.timer.unref?.();
    // Run immediately on start
    this.tick();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('autonomous loop stopped');
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) this.start();
    else this.stop();
  }

  getConfig(): AutonomousConfig {
    return this.config;
  }

  getChecks(): AutonomousCheck[] {
    return this.config.checks;
  }

  getResults(count = 50): AutonomousResult[] {
    return this.results.slice(-count);
  }

  addCheck(check: Omit<AutonomousCheck, 'lastRun' | 'lastResult' | 'runCount'>): void {
    this.config.checks.push({
      ...check,
      lastRun: null,
      lastResult: null,
      runCount: 0,
    });
  }

  removeCheck(id: string): boolean {
    const idx = this.config.checks.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.config.checks.splice(idx, 1);
      return true;
    }
    return false;
  }

  async tick(): Promise<void> {
    if (this.running) {
      log.debug('skipping tick — previous run still in progress');
      return;
    }

    this.running = true;
    const enabledChecks = this.config.checks.filter((c) => c.enabled);
    log.info({ checks: enabledChecks.length }, 'autonomous tick — running checks');

    for (const check of enabledChecks) {
      try {
        const result = await this.runCheck(check);
        check.lastRun = new Date();
        check.lastResult = result.status;
        check.runCount++;

        this.results.push(result);
        if (this.results.length > this.maxResults) {
          this.results = this.results.slice(-this.maxResults);
        }

        incCounter('autonomous_check_total', 'Autonomous checks run', 1, {
          status: result.status,
          check: check.id,
        });

        if (result.status === 'error') {
          log.warn({ checkId: check.id, message: result.message }, 'autonomous check returned error');
        }
      } catch (err) {
        log.error({ err, checkId: check.id }, 'autonomous check failed');
        check.lastRun = new Date();
        check.lastResult = 'error';
        check.runCount++;
      }
    }

    this.running = false;
  }

  private async runCheck(check: AutonomousCheck): Promise<AutonomousResult> {
    log.info({ checkId: check.id, name: check.name }, 'running autonomous check');

    // Use LLM to analyze the check prompt and determine actions
    const response = await this.llm.complete([
      {
        role: 'system',
        content: 'You are an autonomous monitoring agent. Analyze the check result and report status. Respond in JSON: {"status": "ok"|"warning"|"error", "message": "...", "actions": ["..."]}',
      },
      {
        role: 'user',
        content: check.prompt,
      },
    ], {
      temperature: 0.1,
      maxTokens: 500,
    });

    try {
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          checkId: check.id,
          status: parsed.status ?? 'ok',
          message: parsed.message ?? 'Check completed',
          actions: Array.isArray(parsed.actions) ? parsed.actions : [],
          timestamp: new Date(),
        };
      }
    } catch {
      // fall through to default
    }

    return {
      checkId: check.id,
      status: 'ok',
      message: response.content.slice(0, 200),
      actions: [],
      timestamp: new Date(),
    };
  }

  async triggerManual(checkId?: string): Promise<AutonomousResult[]> {
    const checks = checkId
      ? this.config.checks.filter((c) => c.id === checkId)
      : this.config.checks.filter((c) => c.enabled);

    const results: AutonomousResult[] = [];
    for (const check of checks) {
      try {
        const result = await this.runCheck(check);
        check.lastRun = new Date();
        check.lastResult = result.status;
        check.runCount++;
        results.push(result);
        this.results.push(result);
      } catch (err) {
        log.error({ err, checkId: check.id }, 'manual check failed');
      }
    }
    return results;
  }
}
