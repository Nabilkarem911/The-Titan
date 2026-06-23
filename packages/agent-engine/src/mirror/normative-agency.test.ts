import { describe, it, expect, beforeEach } from 'vitest';
import { NormativeAgency } from './normative-agency.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('NormativeAgency', () => {
  let na: NormativeAgency;

  beforeEach(() => {
    na = new NormativeAgency(new MockEchoProvider());
  });

  it('should form a commitment', () => {
    const c = na.formCommitment('always test before deploy');
    expect(c.description).toBe('always test before deploy');
    expect(c.status).toBe('active');
    expect(na.getActiveCommitments()).toHaveLength(1);
  });

  it('should get commitment by id', () => {
    const c = na.formCommitment('test');
    expect(na.getCommitment(c.id)).not.toBeNull();
    expect(na.getCommitment('nonexistent')).toBeNull();
  });

  it('should fulfill a commitment', () => {
    const c = na.formCommitment('test');
    expect(na.fulfillCommitment(c.id)).toBe(true);
    expect(na.getCommitment(c.id).status).toBe('fulfilled');
  });

  it('should violate a commitment', () => {
    const c = na.formCommitment('test');
    expect(na.violateCommitment(c.id)).toBe(true);
    expect(na.getCommitment(c.id).status).toBe('violated');
  });

  it('should detect conflicts', async () => {
    na.formCommitment('always deploy immediately');
    na.formCommitment('never deploy without tests');
    const conflicts = await na.detectConflicts();
    expect(Array.isArray(conflicts)).toBe(true);
  });

  it('should return empty conflicts with < 2 commitments', async () => {
    na.formCommitment('only one');
    const conflicts = await na.detectConflicts();
    expect(conflicts).toHaveLength(0);
  });

  it('should revise under error', async () => {
    const c = na.formCommitment('always respond in 1 second');
    const revision = await na.reviseUnderError(c.id, 'response took 5 seconds');
    if (revision) {
      expect(revision.commitmentId).toBe(c.id);
      expect(revision.reason).toContain('5 seconds');
    }
  });

  it('should return null revision for nonexistent commitment', async () => {
    expect(await na.reviseUnderError('nonexistent', 'error')).toBeNull();
  });

  it('should get stats', () => {
    na.formCommitment('a');
    na.formCommitment('b');
    na.fulfillCommitment(na.getActiveCommitments()[0].id);
    const stats = na.getStats();
    expect(stats.total).toBe(2);
    expect(stats.fulfilled).toBe(1);
    expect(stats.active).toBe(1);
  });

  it('should reset', () => {
    na.formCommitment('test');
    na.reset();
    expect(na.getActiveCommitments()).toHaveLength(0);
  });
});
