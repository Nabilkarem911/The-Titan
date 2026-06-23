import { describe, it, expect, beforeEach } from 'vitest';
import { ScreenMonitor } from './screen-monitor.js';

describe('ScreenMonitor', () => {
  let monitor: ScreenMonitor;

  beforeEach(() => {
    monitor = new ScreenMonitor({ intervalMs: 5000, watchFor: ['error dialog', 'build failed'] });
  });

  it('should initialize with config', () => {
    expect(monitor.isMonitoring()).toBe(false);
    expect(monitor.getConfig().intervalMs).toBe(5000);
  });

  it('should enforce minimum interval of 5s', () => {
    const m = new ScreenMonitor({ intervalMs: 1000 });
    expect(m.getConfig().intervalMs).toBe(5000);
  });

  it('should process capture and generate alert on match', async () => {
    const alert = await monitor.processCapture({
      hash: 'abc123',
      analysis: 'error dialog detected',
      confidence: 0.9,
      type: 'error',
      message: 'error dialog appeared',
    });
    expect(alert).not.toBeNull();
    expect(alert.type).toBe('error');
  });

  it('should skip duplicate screenshots', async () => {
    const capture = { hash: 'same', analysis: 'error', confidence: 0.9, type: 'error', message: 'error dialog' };
    await monitor.processCapture(capture);
    const alert2 = await monitor.processCapture(capture);
    expect(alert2).toBeNull();
  });

  it('should not generate alert for non-matching patterns with low confidence', async () => {
    const alert = await monitor.processCapture({
      hash: 'xyz',
      analysis: 'normal screen',
      confidence: 0.3,
      type: 'info',
      message: 'all good',
    });
    expect(alert).toBeNull();
  });

  it('should get alerts', async () => {
    await monitor.processCapture({ hash: 'h1', analysis: 'build failed', confidence: 0.85, type: 'error', message: 'build failed' });
    expect(monitor.getAlerts()).toHaveLength(1);
  });

  it('should get recent alerts', async () => {
    for (let i = 0; i < 5; i++) {
      await monitor.processCapture({ hash: `h${i}`, analysis: 'error', confidence: 0.9, type: 'error', message: 'error dialog' });
    }
    expect(monitor.getRecentAlerts(3)).toHaveLength(3);
  });

  it('should update config', () => {
    monitor.updateConfig({ alertThreshold: 0.8 });
    expect(monitor.getConfig().alertThreshold).toBe(0.8);
  });

  it('should get stats', async () => {
    await monitor.processCapture({ hash: 'h1', analysis: 'error', confidence: 0.9, type: 'error', message: 'error dialog' });
    const stats = monitor.getStats();
    expect(stats.totalAlerts).toBe(1);
    expect(stats.isMonitoring).toBe(false);
  });

  it('should reset', async () => {
    await monitor.processCapture({ hash: 'h1', analysis: 'error', confidence: 0.9, type: 'error', message: 'error dialog' });
    monitor.reset();
    expect(monitor.getAlerts()).toHaveLength(0);
  });
});
