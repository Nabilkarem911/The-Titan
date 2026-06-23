import { describe, it, expect, beforeEach } from 'vitest';
import { EdgePrivacy } from './edge-privacy.js';

describe('EdgePrivacy', () => {
  let ep: EdgePrivacy;

  beforeEach(() => {
    ep = new EdgePrivacy('http://localhost:11434');
  });

  it('should initialize with Ollama URL', () => {
    expect(ep.isPrivacyMode()).toBe(false);
    expect(ep.isOfflineCapable()).toBe(false);
  });

  it('should detect models (will fail without Ollama running)', async () => {
    const models = await ep.detectModels();
    // In test env, Ollama is not running — should return empty
    expect(Array.isArray(models)).toBe(true);
  });

  it('should route to cloud when no local models', () => {
    const result = ep.routeRequest(0.5, false);
    expect(result.useLocal).toBe(false);
    expect(result.model).toBe('cloud');
  });

  it('should route to local for sensitive data when models available', () => {
    // Manually add a model to simulate availability
    (ep as any).availableModels = [{ id: '1', name: 'llama3', size: '4GB', quantization: 'q4', contextWindow: 4096 }];
    const result = ep.routeRequest(0.8, true);
    expect(result.useLocal).toBe(true);
    expect(result.reason).toContain('Sensitive');
  });

  it('should route simple tasks to local', () => {
    (ep as any).availableModels = [{ id: '1', name: 'llama3', size: '4GB', quantization: 'q4', contextWindow: 4096 }];
    const result = ep.routeRequest(0.2, false);
    expect(result.useLocal).toBe(true);
  });

  it('should route complex tasks to cloud', () => {
    (ep as any).availableModels = [{ id: '1', name: 'llama3', size: '4GB', quantization: 'q4', contextWindow: 4096 }];
    const result = ep.routeRequest(0.9, false);
    expect(result.useLocal).toBe(false);
  });

  it('should set privacy mode', () => {
    ep.setPrivacyMode(true);
    expect(ep.isPrivacyMode()).toBe(true);
  });

  it('should route to local in privacy mode with sensitive data', () => {
    ep.setPrivacyMode(true);
    (ep as any).availableModels = [{ id: '1', name: 'llama3', size: '4GB', quantization: 'q4', contextWindow: 4096 }];
    const result = ep.routeRequest(0.9, true);
    expect(result.useLocal).toBe(true);
    expect(result.privacyMode).toBe(true);
  });

  it('should share federated update', () => {
    const update = ep.shareFederatedUpdate('instance-A', 'model-diff-data', (d) => `encrypted:${d}`);
    expect(update.encrypted).toBe(true);
    expect(update.fromInstance).toBe('instance-A');
  });

  it('should apply federated update', () => {
    const update = ep.shareFederatedUpdate('instance-A', 'diff', (d) => `enc:${d}`);
    const applied = ep.applyFederatedUpdate(update.id, (d) => d.replace('enc:', ''));
    expect(applied).toBe(true);
    expect(ep.getFederatedUpdates()[0].applied).toBe(true);
  });

  it('should fail to apply nonexistent update', () => {
    expect(ep.applyFederatedUpdate('nonexistent', (d) => d)).toBe(false);
  });

  it('should get stats', () => {
    ep.shareFederatedUpdate('a', 'd', (x) => x);
    const stats = ep.getStats();
    expect(stats.federatedUpdates).toBe(1);
  });

  it('should reset', () => {
    ep.shareFederatedUpdate('a', 'd', (x) => x);
    ep.reset();
    expect(ep.getFederatedUpdates()).toHaveLength(0);
  });
});
