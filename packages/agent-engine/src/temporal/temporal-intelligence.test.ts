import { describe, it, expect, beforeEach } from 'vitest';
import { TemporalIntelligence } from './temporal-intelligence.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('TemporalIntelligence', () => {
  let ti: TemporalIntelligence;

  beforeEach(() => {
    ti = new TemporalIntelligence(new MockEchoProvider());
  });

  it('should record events', () => {
    const event = ti.recordEvent('test event', 'testing');
    expect(event.id).toBeDefined();
    expect(ti.getEvents()).toHaveLength(1);
  });

  it('should record historical events', () => {
    const past = new Date('2024-01-01');
    ti.recordHistoricalEvent(past, 'past event', 'history');
    expect(ti.getEvents()[0].timestamp).toEqual(past);
  });

  it('should sort events chronologically', () => {
    ti.recordHistoricalEvent(new Date('2024-06-01'), 'b', 'x');
    ti.recordHistoricalEvent(new Date('2024-01-01'), 'a', 'x');
    const events = ti.getEvents();
    expect(events[0].description).toBe('a');
  });

  it('should get events by category', () => {
    ti.recordEvent('a', 'cat1');
    ti.recordEvent('b', 'cat2');
    ti.recordEvent('c', 'cat1');
    expect(ti.getEventsByCategory('cat1')).toHaveLength(2);
  });

  it('should get events in range', () => {
    ti.recordHistoricalEvent(new Date('2024-01-01'), 'a', 'x');
    ti.recordHistoricalEvent(new Date('2024-06-01'), 'b', 'x');
    ti.recordHistoricalEvent(new Date('2024-12-01'), 'c', 'x');
    const range = ti.getEventsInRange(new Date('2024-03-01'), new Date('2024-09-01'));
    expect(range).toHaveLength(1);
  });

  it('should analyze past', () => {
    ti.recordEvent('a', 'cat1');
    ti.recordEvent('b', 'cat2');
    const analysis = ti.analyzePast();
    expect(analysis.totalEvents).toBe(2);
    expect(analysis.categories).toHaveLength(2);
  });

  it('should return empty analysis when no events', () => {
    const analysis = ti.analyzePast();
    expect(analysis.totalEvents).toBe(0);
  });

  it('should predict future', async () => {
    ti.recordEvent('deployed app', 'deployment');
    ti.recordEvent('fixed bug', 'debugging');
    const result = await ti.predictFuture();
    expect(result.predictions).toBeDefined();
    expect(result.patterns).toBeDefined();
  });

  it('should return empty predictions with no events', async () => {
    const result = await ti.predictFuture();
    expect(result.predictions).toHaveLength(0);
  });

  it('should explore timeline branches', async () => {
    const branches = await ti.exploreTimelineBranches('server down', ['restart', 'scale up', 'debug']);
    expect(branches.length).toBeLessThanOrEqual(5);
  });

  it('should limit branches to 5', async () => {
    const actions = ['a', 'b', 'c', 'd', 'e', 'f', 'g'];
    const branches = await ti.exploreTimelineBranches('test', actions);
    expect(branches.length).toBeLessThanOrEqual(5);
  });

  it('should detect temporal reasoning', () => {
    const result1 = ti.temporalReason('This was true yesterday but not today');
    expect(result1.isTimeAware).toBe(true);
    const result2 = ti.temporalReason('The sky is blue');
    expect(result2.isTimeAware).toBe(false);
  });

  it('should schedule optimal time within working hours', () => {
    const result = ti.scheduleOptimalTime('task', { start: 9, end: 17 }, 'UTC');
    expect(result.suggestedTime).toBeDefined();
    expect(result.reasoning).toBeDefined();
  });

  it('should get stats', () => {
    ti.recordEvent('a', 'x');
    const stats = ti.getStats();
    expect(stats.events).toBe(1);
  });

  it('should reset', () => {
    ti.recordEvent('a', 'x');
    ti.reset();
    expect(ti.getEvents()).toHaveLength(0);
  });
});
