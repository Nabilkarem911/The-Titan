import { describe, it, expect, beforeEach } from 'vitest';
import { CapabilityRegistry, getGlobalCapabilityRegistry, resetGlobalCapabilityRegistry } from './capability-registry.js';

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry;

  beforeEach(() => {
    resetGlobalCapabilityRegistry();
    registry = new CapabilityRegistry();
  });

  it('should initialize with all default capabilities', () => {
    const all = registry.getAll();
    expect(all.length).toBeGreaterThan(80);
  });

  it('should have all capabilities enabled by default', () => {
    const enabled = registry.getEnabled();
    expect(enabled.length).toBe(registry.getAll().length);
  });

  it('should get capability by id', () => {
    const cap = registry.get('self-forge');
    expect(cap).not.toBeNull();
    expect(cap.name).toBe('Self-Forge');
  });

  it('should return null for nonexistent capability', () => {
    expect(registry.get('nonexistent')).toBeNull();
  });

  it('should disable a capability', () => {
    expect(registry.disable('self-forge')).toBe(true);
    expect(registry.get('self-forge').enabled).toBe(false);
  });

  it('should enable a disabled capability', () => {
    registry.disable('self-forge');
    expect(registry.enable('self-forge')).toBe(true);
    expect(registry.get('self-forge').enabled).toBe(true);
  });

  it('should return false when disabling nonexistent capability', () => {
    expect(registry.disable('nonexistent')).toBe(false);
  });

  it('should get capabilities by category', () => {
    const reasoning = registry.getByCategory('reasoning');
    expect(reasoning.length).toBeGreaterThan(5);
    expect(reasoning.every((c) => c.category === 'reasoning')).toBe(true);
  });

  it('should get capabilities by source', () => {
    const cosmic = registry.getBySource('cosmic');
    expect(cosmic.length).toBeGreaterThan(5);
    expect(cosmic.every((c) => c.source === 'cosmic')).toBe(true);
  });

  it('should generate self-description in English', () => {
    const desc = registry.generateSelfDescription('en');
    expect(desc).toContain('Titan');
    expect(desc).toContain('capabilities');
  });

  it('should generate self-description in Arabic', () => {
    const desc = registry.generateSelfDescription('ar');
    expect(desc).toContain('تايتن');
    expect(desc).toContain('قدرة');
  });

  it('should generate system prompt section', () => {
    const section = registry.generateSystemPromptSection();
    expect(section).toContain('Titan Capabilities');
    expect(section).toContain('Self-Forge');
    expect(section).toContain('REASONING');
  });

  it('should check if has capability', () => {
    expect(registry.hasCapability('Self-Forge')).toBe(true);
    expect(registry.hasCapability('nonexistent')).toBe(false);
  });

  it('should register a new capability', () => {
    registry.register({
      name: 'Test Capability',
      category: 'reasoning',
      source: 'core',
      description: 'A test capability',
      enabled: true,
    });
    expect(registry.hasCapability('Test Capability')).toBe(true);
  });

  it('should get snapshot', () => {
    const snapshot = registry.getSnapshot();
    expect(snapshot.total).toBeGreaterThan(80);
    expect(snapshot.enabled).toBeGreaterThan(80);
    expect(Object.keys(snapshot.byCategory).length).toBeGreaterThan(10);
    expect(Object.keys(snapshot.bySource).length).toBeGreaterThan(3);
  });

  it('should get stats', () => {
    const stats = registry.getStats();
    expect(stats.total).toBeGreaterThan(80);
    expect(stats.enabled).toBeGreaterThan(80);
    expect(stats.disabled).toBe(0);
    expect(stats.categories).toBeGreaterThan(10);
  });

  it('should reset', () => {
    registry.register({
      name: 'Temp Capability',
      category: 'tools',
      source: 'core',
      description: 'temp',
      enabled: true,
    });
    registry.reset();
    expect(registry.get('temp-capability')).toBeNull();
  });

  it('should get global singleton', () => {
    const g1 = getGlobalCapabilityRegistry();
    const g2 = getGlobalCapabilityRegistry();
    expect(g1).toBe(g2);
  });
});
