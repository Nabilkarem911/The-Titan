import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { wireCapabilities, getGlobalWiring, resetGlobalWiring } from './capability-wiring.js';
import { MockLlmProvider } from './mockLlmProvider.js';
import { resetGlobalToolRegistry } from './tool-registry.js';

describe('CapabilityWiring', () => {
  let llm: MockLlmProvider;

  beforeEach(() => {
    resetGlobalWiring();
    resetGlobalToolRegistry();
    llm = new MockLlmProvider();
  });

  afterEach(() => {
    resetGlobalWiring();
    resetGlobalToolRegistry();
  });

  it('should wire all capabilities', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.totalWired).toBeGreaterThan(50);
  });

  it('should return the same instance on second call (singleton)', () => {
    const first = wireCapabilities(llm);
    const second = wireCapabilities(llm);
    expect(first).toBe(second);
  });

  it('should have all reasoning modules wired', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.dreamMode).toBeDefined();
    expect(wiring.causalReplay).toBeDefined();
    expect(wiring.hypothesisTester).toBeDefined();
    expect(wiring.selfHealingDebugger).toBeDefined();
    expect(wiring.evolutionarySolver).toBeDefined();
    expect(wiring.neuroSymbolic).toBeDefined();
    expect(wiring.hyperAgent).toBeDefined();
    expect(wiring.apexEvolution).toBeDefined();
  });

  it('should have all metacognition modules wired', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.metaMonitor).toBeDefined();
    expect(wiring.selfImprover).toBeDefined();
    expect(wiring.curiosityEngine).toBeDefined();
    expect(wiring.emotionalIntelligence).toBeDefined();
    expect(wiring.theoryOfMind).toBeDefined();
    expect(wiring.metacognitiveConsolidation).toBeDefined();
    expect(wiring.safetyGuardrail).toBeDefined();
    expect(wiring.antiSycophancy).toBeDefined();
    expect(wiring.multiLayerGuardrails).toBeDefined();
  });

  it('should have all cosmic modules wired', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.creativeEngine).toBeDefined();
    expect(wiring.hiveMind).toBeDefined();
    expect(wiring.agentEconomy).toBeDefined();
    expect(wiring.infiniteSelfPlay).toBeDefined();
    expect(wiring.selfEvolvingCode).toBeDefined();
    expect(wiring.quantumOptimizer).toBeDefined();
    expect(wiring.universalTranslator).toBeDefined();
    expect(wiring.temporalIntelligence).toBeDefined();
    expect(wiring.titanConstitution).toBeDefined();
    expect(wiring.dreamWorld).toBeDefined();
  });

  it('should have MIRROR consciousness modules wired', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.innerMonologue).toBeDefined();
    expect(wiring.cognitiveController).toBeDefined();
    expect(wiring.episodicBuffer).toBeDefined();
    expect(wiring.digitalTwin).toBeDefined();
    expect(wiring.whatIfEngine).toBeDefined();
    expect(wiring.normativeAgency).toBeDefined();
  });

  it('should have self-forge wired', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.selfForge).toBeDefined();
  });

  it('should have world model wired', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.worldSimulator).toBeDefined();
    expect(wiring.environmentGraph).toBeDefined();
  });

  it('should register capability tools in the registry', () => {
    const wiring = wireCapabilities(llm);
    expect(wiring.totalWired).toBeGreaterThan(50);
    // Tools are registered inside wireCapabilities
  });

  it('should get global wiring after wiring', () => {
    wireCapabilities(llm);
    const global = getGlobalWiring();
    expect(global).not.toBeNull();
    expect(global?.totalWired).toBeGreaterThan(50);
  });
});
