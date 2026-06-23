import { describe, it, expect, beforeEach } from 'vitest';
import { AutonomousGardener, CreativeSeed } from './autonomous-gardener.js';

describe('AutonomousGardener', () => {
  let gardener: AutonomousGardener;

  beforeEach(() => {
    gardener = new AutonomousGardener();
  });

  it('should initialize with default taste', () => {
    const taste = gardener.getTasteProfile();
    expect(taste.aestheticScore).toBe(0.5);
    expect(taste.evolutionCount).toBe(0);
  });

  it('should plant seeds', () => {
    const seed: CreativeSeed = {
      id: 's1',
      type: 'image',
      content: 'abstract art',
      style: 'minimalist',
      emergenceScore: 0.8,
      plantedAt: new Date(),
    };
    gardener.plant(seed);
    expect(gardener.getSeeds()).toHaveLength(1);
    expect(gardener.getTasteProfile().evolutionCount).toBe(1);
  });

  it('should update taste preferences on planting', () => {
    gardener.plant({ id: 's1', type: 'image', content: 'art', style: 'minimalist', emergenceScore: 0.9, plantedAt: new Date() });
    const taste = gardener.getTasteProfile();
    expect(taste.preferences['minimalist']).toBeGreaterThan(0.5);
  });

  it('should harvest viable seeds', () => {
    gardener.plant({ id: 's1', type: 'image', content: 'art', style: 'modern', emergenceScore: 0.8, plantedAt: new Date() });
    gardener.plant({ id: 's2', type: 'music', content: 'beat', style: 'lofi', emergenceScore: 0.2, plantedAt: new Date() });
    const harvest = gardener.harvest();
    expect(harvest.seeds).toHaveLength(1);
    expect(harvest.bestEmergence).toBe(0.8);
  });

  it('should remove harvested seeds', () => {
    gardener.plant({ id: 's1', type: 'image', content: 'art', style: 'modern', emergenceScore: 0.8, plantedAt: new Date() });
    gardener.harvest();
    expect(gardener.getSeeds()).toHaveLength(0);
  });

  it('should cap seeds at 100', () => {
    for (let i = 0; i < 110; i++) {
      gardener.plant({ id: `s${i}`, type: 'text', content: 'x', style: 'test', emergenceScore: 0.5, plantedAt: new Date() });
    }
    expect(gardener.getSeeds().length).toBeLessThanOrEqual(100);
  });

  it('should get stats', () => {
    gardener.plant({ id: 's1', type: 'image', content: 'art', style: 'modern', emergenceScore: 0.8, plantedAt: new Date() });
    gardener.plant({ id: 's2', type: 'image', content: 'art2', style: 'classic', emergenceScore: 0.6, plantedAt: new Date() });
    const stats = gardener.getStats();
    expect(stats.totalSeeds).toBe(2);
    expect(stats.topStyles).toContain('modern');
  });

  it('should reset', () => {
    gardener.plant({ id: 's1', type: 'image', content: 'art', style: 'modern', emergenceScore: 0.8, plantedAt: new Date() });
    gardener.reset();
    expect(gardener.getSeeds()).toHaveLength(0);
    expect(gardener.getTasteProfile().evolutionCount).toBe(0);
  });

  it('should start and stop', () => {
    gardener.start(() => ({ id: 's', type: 'text', content: 'x', style: 'test', emergenceScore: 0.5, plantedAt: new Date() }));
    expect(gardener.isRunning()).toBe(true);
    gardener.stop();
    expect(gardener.isRunning()).toBe(false);
  });
});
