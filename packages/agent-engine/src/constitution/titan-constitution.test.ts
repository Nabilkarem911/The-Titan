import { describe, it, expect, beforeEach } from 'vitest';
import { TitanConstitution } from './titan-constitution.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('TitanConstitution', () => {
  let constitution: TitanConstitution;

  beforeEach(() => {
    constitution = new TitanConstitution(new MockEchoProvider());
    constitution.enable();
  });

  it('should be disabled by default', () => {
    const c = new TitanConstitution(new MockEchoProvider());
    expect(c.isEnabled()).toBe(false);
  });

  it('should enable and disable', () => {
    expect(constitution.isEnabled()).toBe(true);
    constitution.disable();
    expect(constitution.isEnabled()).toBe(false);
  });

  it('should initialize with core principles', () => {
    const principles = constitution.getPrinciples();
    expect(principles.length).toBeGreaterThanOrEqual(7);
    expect(constitution.getPrinciple('safety-first')).toBeDefined();
    expect(constitution.getPrinciple('human-autonomy')).toBeDefined();
  });

  it('should have immutable safety principles', () => {
    const safety = constitution.getPrinciple('safety-first');
    expect(safety!.immutable).toBe(true);
    expect(safety!.category).toBe('safety');
  });

  it('should have immutable human autonomy principle', () => {
    const autonomy = constitution.getPrinciple('human-autonomy');
    expect(autonomy!.immutable).toBe(true);
  });

  it('should have amendable non-safety principles', () => {
    const transparency = constitution.getPrinciple('transparency');
    expect(transparency!.immutable).toBe(false);
  });

  it('should get principles by category', () => {
    const safety = constitution.getPrinciplesByCategory('safety');
    expect(safety.length).toBe(1);
    const ethics = constitution.getPrinciplesByCategory('ethics');
    expect(ethics.length).toBeGreaterThanOrEqual(2);
  });

  it('should deliberate on proposals', async () => {
    const deliberation = await constitution.deliberate('test topic', 'test proposal');
    expect(deliberation.topic).toBe('test topic');
    expect(deliberation.proposal).toBe('test proposal');
    expect(['accept', 'reject', 'table']).toContain(deliberation.decision);
    expect(deliberation.reasoningChain).toBeDefined();
  });

  it('should record deliberations', async () => {
    await constitution.deliberate('topic 1', 'proposal 1');
    await constitution.deliberate('topic 2', 'proposal 2');
    expect(constitution.getDeliberations()).toHaveLength(2);
  });

  it('should reject amendments to immutable principles', async () => {
    await expect(
      constitution.proposeAmendment('safety-first', 'new content', 'reason', 'agent-1', 10, 10),
    ).rejects.toThrow('immutable');
  });

  it('should reject amendments when disabled', async () => {
    constitution.disable();
    await expect(
      constitution.proposeAmendment('transparency', 'new content', 'reason', 'agent-1', 10, 10),
    ).rejects.toThrow('disabled');
  });

  it('should reject amendments for unknown principles', async () => {
    await expect(
      constitution.proposeAmendment('nonexistent', 'content', 'reason', 'agent-1', 10, 10),
    ).rejects.toThrow('not found');
  });

  it('should record amendments', async () => {
    const result = await constitution.proposeAmendment(
      'transparency',
      'Updated transparency rules',
      'Improving clarity',
      'agent-1',
      7,
      10,
    );
    expect(result.amendment).toBeDefined();
    expect(result.deliberation).toBeDefined();
    expect(constitution.getAmendments()).toHaveLength(1);
  });

  it('should require supermajority (67%) for amendment', async () => {
    const result = await constitution.proposeAmendment(
      'cooperation',
      'Updated cooperation rules',
      'Improving cooperation',
      'agent-1',
      5,
      10, // 50% — not enough
    );
    expect(result.amendment.supermajorityReached).toBe(false);
    expect(result.amendment.passed).toBe(false);
  });

  it('should pass amendment with supermajority', async () => {
    const result = await constitution.proposeAmendment(
      'cooperation',
      'Updated cooperation rules',
      'Improving cooperation',
      'agent-1',
      8,
      10, // 80% — enough
    );
    // Note: MockEchoProvider returns text, not JSON, so deliberation may not be 'accept'
    // But the amendment should still be recorded
    expect(result.amendment).toBeDefined();
    expect(result.amendment.supermajorityReached).toBe(true);
  });

  it('should resolve conflicts with safety winning', () => {
    const safety = constitution.getPrinciple('safety-first')!;
    const behavior = constitution.getPrinciple('anti-sycophancy')!;
    const winner = constitution.resolveConflict(safety, behavior);
    expect(winner.id).toBe('safety-first');
  });

  it('should resolve conflicts with immutable winning', () => {
    const immutable = constitution.getPrinciple('human-autonomy')!;
    const mutable = constitution.getPrinciple('transparency')!;
    const winner = constitution.resolveConflict(immutable, mutable);
    expect(winner.id).toBe('human-autonomy');
  });

  it('should export as markdown', () => {
    const md = constitution.exportAsMarkdown();
    expect(md).toContain('# Titan Constitution');
    expect(md).toContain('Safety First');
    expect(md).toContain('Human Autonomy');
    expect(md).toContain('immutable');
  });

  it('should get stats', async () => {
    await constitution.deliberate('test', 'proposal');
    const stats = constitution.getStats();
    expect(stats.principles).toBeGreaterThanOrEqual(7);
    expect(stats.immutablePrinciples).toBeGreaterThanOrEqual(2);
    expect(stats.deliberations).toBe(1);
  });

  it('should reset', async () => {
    await constitution.deliberate('test', 'proposal');
    constitution.reset();
    expect(constitution.getDeliberations()).toHaveLength(0);
    expect(constitution.getAmendments()).toHaveLength(0);
    expect(constitution.getPrinciples().length).toBeGreaterThanOrEqual(7);
  });

  it('should handle LLM errors in deliberation', async () => {
    const failingLlm = {
      complete: async () => { throw new Error('LLM unavailable'); },
    };
    const c = new TitanConstitution(failingLlm as any);
    c.enable();
    const deliberation = await c.deliberate('test', 'proposal');
    expect(deliberation.decision).toBe('reject');
    expect(deliberation.reasoningChain).toContain('LLM unavailable — defaulting to caution');
  });
});
