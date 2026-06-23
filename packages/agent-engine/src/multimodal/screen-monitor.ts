import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'screen-monitor' });

export interface ScreenAlert {
  id: string;
  timestamp: Date;
  type: 'error' | 'warning' | 'info' | 'change';
  message: string;
  confidence: number;
  screenshotHash?: string;
}

export interface WatchConfig {
  intervalMs: number;
  watchFor: string[];
  alertThreshold: number;
  enabled: boolean;
}

const MIN_INTERVAL_MS = 5000;
const MAX_ALERTS_PER_MIN = 10;

export class ScreenMonitor {
  private config: WatchConfig;
  private alerts: ScreenAlert[] = [];
  private monitoring = false;
  private intervalHandle: ReturnType<typeof setInterval> | null = null;
  private lastScreenshotHash: string | null = null;
  private alertTimestamps: Date[] = [];

  constructor(config?: Partial<WatchConfig>) {
    this.config = {
      intervalMs: Math.max(MIN_INTERVAL_MS, config?.intervalMs ?? 5000),
      watchFor: config?.watchFor ?? ['error dialog', 'build failed', 'test crashed'],
      alertThreshold: config?.alertThreshold ?? 0.7,
      enabled: config?.enabled ?? false,
    };
  }

  start(captureFn: () => Promise<{ hash: string; analysis: string; confidence: number; type: string; message: string }>): void {
    if (this.monitoring) {
      log.warn('screen monitor already running');
      return;
    }

    this.monitoring = true;
    this.config.enabled = true;

    this.intervalHandle = setInterval(async () => {
      try {
        const capture = await captureFn();
        await this.processCapture(capture);
      } catch (err) {
        log.error({ err }, 'screen capture failed');
      }
    }, this.config.intervalMs);

    log.info({ intervalMs: this.config.intervalMs }, 'screen monitoring started');
  }

  stop(): void {
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
    this.monitoring = false;
    this.config.enabled = false;
    log.info('screen monitoring stopped');
  }

  isMonitoring(): boolean {
    return this.monitoring;
  }

  async processCapture(capture: {
    hash: string;
    analysis: string;
    confidence: number;
    type: string;
    message: string;
  }): Promise<ScreenAlert | null> {
    // Skip if same screenshot
    if (capture.hash === this.lastScreenshotHash) {
      return null;
    }
    this.lastScreenshotHash = capture.hash;

    // Check rate limit
    const now = new Date();
    this.alertTimestamps = this.alertTimestamps.filter((t) => now.getTime() - t.getTime() < 60000);
    if (this.alertTimestamps.length >= MAX_ALERTS_PER_MIN) {
      log.warn('alert rate limit reached — skipping');
      return null;
    }

    // Check if any watch pattern matches
    const matches = this.config.watchFor.some((pattern) =>
      capture.message.toLowerCase().includes(pattern.toLowerCase()) ||
      capture.analysis.toLowerCase().includes(pattern.toLowerCase()),
    );

    if (!matches && capture.confidence < this.config.alertThreshold) {
      return null;
    }

    const alert: ScreenAlert = {
      id: randomUUID(),
      timestamp: now,
      type: capture.type as ScreenAlert['type'],
      message: capture.message,
      confidence: capture.confidence,
      screenshotHash: capture.hash,
    };

    this.alerts.push(alert);
    this.alertTimestamps.push(now);

    if (this.alerts.length > 1000) {
      this.alerts.shift();
    }

    incCounter('screen_alerts', 'Screen monitor alerts', 1);
    log.info({ type: alert.type, message: alert.message, confidence: alert.confidence }, 'screen alert generated');

    return alert;
  }

  getAlerts(): ScreenAlert[] {
    return [...this.alerts];
  }

  getRecentAlerts(count: number = 10): ScreenAlert[] {
    return this.alerts.slice(-count);
  }

  getConfig(): WatchConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<WatchConfig>): void {
    if (updates.intervalMs) {
      updates.intervalMs = Math.max(MIN_INTERVAL_MS, updates.intervalMs);
    }
    this.config = { ...this.config, ...updates };
  }

  getStats(): { totalAlerts: number; isMonitoring: boolean; intervalMs: number; watchPatterns: number } {
    return {
      totalAlerts: this.alerts.length,
      isMonitoring: this.monitoring,
      intervalMs: this.config.intervalMs,
      watchPatterns: this.config.watchFor.length,
    };
  }

  reset(): void {
    this.stop();
    this.alerts = [];
    this.lastScreenshotHash = null;
    this.alertTimestamps = [];
  }
}
