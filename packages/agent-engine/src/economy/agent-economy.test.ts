import { describe, it, expect, beforeEach } from 'vitest';
import { AgentEconomy } from './agent-economy.js';
import { MockEchoProvider } from '../mockLlmProvider.js';

describe('AgentEconomy', () => {
  let economy: AgentEconomy;

  beforeEach(() => {
    economy = new AgentEconomy(new MockEchoProvider());
    economy.enable();
  });

  it('should be disabled by default', () => {
    const e = new AgentEconomy(new MockEchoProvider());
    expect(e.isEnabled()).toBe(false);
  });

  it('should enable and disable', () => {
    expect(economy.isEnabled()).toBe(true);
    economy.disable();
    expect(economy.isEnabled()).toBe(false);
  });

  it('should register agents with starting balance', () => {
    const account = economy.registerAgent('agent-1');
    expect(account.balance).toBe(1000);
    expect(account.reputation).toBe(50);
  });

  it('should not double-register agents', () => {
    economy.registerAgent('agent-1');
    const account = economy.registerAgent('agent-1');
    expect(account.balance).toBe(1000);
  });

  it('should get account', () => {
    economy.registerAgent('agent-1');
    expect(economy.getAccount('agent-1')).toBeDefined();
    expect(economy.getAccount('nonexistent')).toBeUndefined();
  });

  it('should list skills', () => {
    economy.registerAgent('seller-1');
    const listing = economy.listSkill('seller-1', 'write-tests', 'Write unit tests', 50, 'testing');
    expect(listing.id).toBeDefined();
    expect(listing.pricePerUse).toBe(50);
    expect(economy.getListing(listing.id)).toBeDefined();
  });

  it('should throw when listing skill while disabled', () => {
    economy.disable();
    economy.registerAgent('seller-1');
    expect(() => economy.listSkill('seller-1', 'test', 'test', 50, 'test')).toThrow('disabled');
  });

  it('should get listings by category', () => {
    economy.registerAgent('seller-1');
    economy.listSkill('seller-1', 'skill-1', 'desc', 50, 'testing');
    economy.listSkill('seller-1', 'skill-2', 'desc', 30, 'coding');
    economy.listSkill('seller-1', 'skill-3', 'desc', 40, 'testing');
    expect(economy.getListingsByCategory('testing')).toHaveLength(2);
  });

  it('should make offers', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    expect(offer.status).toBe('pending');
    expect(offer.amount).toBe(100);
  });

  it('should reject offers with insufficient balance', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    expect(() => economy.makeOffer('buyer-1', 'seller-1', 2000)).toThrow('Insufficient balance');
  });

  it('should accept offers and create escrow', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    const escrow = economy.acceptOffer(offer.id);
    expect(escrow.status).toBe('held');
    expect(economy.getAccount('buyer-1')!.balance).toBe(900);
  });

  it('should release escrow and credit seller', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    const escrow = economy.acceptOffer(offer.id);
    economy.releaseEscrow(escrow.id);
    expect(economy.getAccount('seller-1')!.balance).toBe(1100);
    expect(economy.getAccount('seller-1')!.totalEarned).toBe(100);
    expect(economy.getAccount('buyer-1')!.totalSpent).toBe(100);
  });

  it('should refund escrow and return funds to buyer', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    const escrow = economy.acceptOffer(offer.id);
    economy.refundEscrow(escrow.id);
    expect(economy.getAccount('buyer-1')!.balance).toBe(1000);
  });

  it('should reject offers', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    economy.rejectOffer(offer.id);
    expect(offer.status).toBe('rejected');
  });

  it('should counter offers', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    const counter = economy.counterOffer(offer.id, 150);
    expect(counter.amount).toBe(150);
    expect(offer.status).toBe('countered');
  });

  it('should enforce max negotiation rounds', () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    let offer = economy.makeOffer('buyer-1', 'seller-1', 100);
    offer = economy.counterOffer(offer.id, 150);
    offer = economy.counterOffer(offer.id, 120);
    offer = economy.counterOffer(offer.id, 130);
    expect(() => economy.counterOffer(offer.id, 125)).toThrow('Max negotiation rounds');
  });

  it('should update reputation', () => {
    economy.registerAgent('agent-1');
    economy.updateReputation('agent-1', true, 5000);
    economy.updateReputation('agent-1', true, 3000);
    economy.updateReputation('agent-1', false, 10000);
    const rep = economy.getReputation('agent-1')!;
    expect(rep.totalTasks).toBe(3);
    expect(rep.successfulTasks).toBe(2);
    expect(rep.taskCompletionRate).toBeCloseTo(2 / 3, 1);
  });

  it('should get top reputation', () => {
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    economy.updateReputation('agent-1', true, 1000);
    economy.updateReputation('agent-2', true, 500);
    const top = economy.getTopReputation(10);
    expect(top.length).toBe(2);
    expect(top[0].reputationScore).toBeGreaterThanOrEqual(top[1].reputationScore);
  });

  it('should transfer credits directly', () => {
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    const result = economy.transferCredits('agent-1', 'agent-2', 200);
    expect(result).toBe(true);
    expect(economy.getAccount('agent-1')!.balance).toBe(800);
    expect(economy.getAccount('agent-2')!.balance).toBe(1200);
  });

  it('should fail transfer with insufficient balance', () => {
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    const result = economy.transferCredits('agent-1', 'agent-2', 2000);
    expect(result).toBe(false);
  });

  it('should maintain audit log', () => {
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    economy.transferCredits('agent-1', 'agent-2', 100);
    const log = economy.getAuditLog();
    expect(log.length).toBeGreaterThan(0);
    expect(log[0].immutable).toBe(true);
  });

  it('should filter audit log by agent', () => {
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    economy.registerAgent('agent-3');
    economy.transferCredits('agent-1', 'agent-2', 100);
    economy.transferCredits('agent-2', 'agent-3', 50);
    const agent2Log = economy.getAuditLogForAgent('agent-2');
    expect(agent2Log.length).toBe(2);
  });

  it('should get economy stats', () => {
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    economy.listSkill('agent-1', 'test', 'desc', 50, 'testing');
    economy.makeOffer('agent-1', 'agent-2', 100);
    const stats = economy.getStats();
    expect(stats.agents).toBe(2);
    expect(stats.listings).toBe(1);
    expect(stats.activeOffers).toBe(1);
  });

  it('should reset all state', () => {
    economy.registerAgent('agent-1');
    economy.listSkill('agent-1', 'test', 'desc', 50, 'test');
    economy.reset();
    expect(economy.getStats().agents).toBe(0);
    expect(economy.getStats().listings).toBe(0);
  });

  it('should throw on offers when disabled', () => {
    economy.disable();
    economy.registerAgent('agent-1');
    economy.registerAgent('agent-2');
    expect(() => economy.makeOffer('agent-1', 'agent-2', 100)).toThrow('disabled');
  });

  it('should negotiate price with LLM', async () => {
    economy.registerAgent('buyer-1');
    economy.registerAgent('seller-1');
    const result = await economy.negotiatePrice('buyer-1', 'seller-1', 100);
    expect(result.status).toBeDefined();
    expect(result.rounds).toBeGreaterThan(0);
  });
});
