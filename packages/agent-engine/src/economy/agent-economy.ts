import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';
import { economyAccounts, economyListings, economyOffers, economyEscrows, economyAuditLog } from '@titan/database';

const log = getLogger().child({ component: 'agent-economy' });

interface ComputeCreditAccount {
  agentId: string;
  balance: number;
  totalEarned: number;
  totalSpent: number;
  reputation: number;
  createdAt: Date;
}

interface SkillListing {
  id: string;
  sellerId: string;
  skillName: string;
  description: string;
  pricePerUse: number;
  category: string;
  successRate: number;
  totalSales: number;
  createdAt: Date;
}

interface TradeOffer {
  id: string;
  fromAgentId: string;
  toAgentId: string;
  skillListingId?: string;
  amount: number;
  currency: 'ComputeCredits';
  status: 'pending' | 'accepted' | 'rejected' | 'countered' | 'expired';
  counterAmount?: number;
  rounds: number;
  maxRounds: number;
  createdAt: Date;
  expiresAt: Date;
}

interface EscrowContract {
  id: string;
  tradeOfferId: string;
  buyerId: string;
  sellerId: string;
  amount: number;
  status: 'held' | 'released' | 'refunded' | 'disputed';
  timeoutMs: number;
  createdAt: Date;
  resolvedAt: Date | null;
}

interface ReputationRecord {
  agentId: string;
  testPassRate: number;
  taskCompletionRate: number;
  avgTaskTime: number;
  totalTasks: number;
  successfulTasks: number;
  reputationScore: number;
}

interface AuditEntry {
  id: string;
  type: 'trade' | 'escrow' | 'reputation' | 'credit_transfer';
  agentId: string;
  counterpartyId: string;
  amount: number;
  description: string;
  timestamp: Date;
  immutable: boolean;
}

const DEFAULT_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24h
const MAX_NEGOTIATION_ROUNDS = 3;
const STARTING_BALANCE = 1000;
const MAX_REPUTATION = 100;

export class AgentEconomy {
  private accounts: Map<string, ComputeCreditAccount> = new Map();
  private listings: Map<string, SkillListing> = new Map();
  private offers: Map<string, TradeOffer> = new Map();
  private escrows: Map<string, EscrowContract> = new Map();
  private reputation: Map<string, ReputationRecord> = new Map();
  private auditLog: AuditEntry[] = [];
  private llm: LlmProvider;
  private enabled = false;

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
    log.info('agent economy enabled');
  }

  disable(): void {
    this.enabled = false;
    log.info('agent economy disabled');
  }

  registerAgent(agentId: string): ComputeCreditAccount {
    const existing = this.accounts.get(agentId);
    if (existing) return existing;

    const account: ComputeCreditAccount = {
      agentId,
      balance: STARTING_BALANCE,
      totalEarned: 0,
      totalSpent: 0,
      reputation: 50,
      createdAt: new Date(),
    };
    this.accounts.set(agentId, account);
    economyAccounts.upsert(agentId, account.balance, account.reputation).catch((err) => log.error({ err }, 'DB write failed'));

    this.reputation.set(agentId, {
      agentId,
      testPassRate: 0,
      taskCompletionRate: 0,
      avgTaskTime: 0,
      totalTasks: 0,
      successfulTasks: 0,
      reputationScore: 50,
    });

    incCounter('economy_agents_registered', 'Agents registered in economy', 1);
    log.info({ agentId, balance: STARTING_BALANCE }, 'agent registered with starting balance');

    return account;
  }

  getAccount(agentId: string): ComputeCreditAccount | undefined {
    return this.accounts.get(agentId);
  }

  listSkill(
    sellerId: string,
    skillName: string,
    description: string,
    pricePerUse: number,
    category: string,
  ): SkillListing {
    if (!this.enabled) {
      throw new Error('Agent economy is disabled');
    }

    const listing: SkillListing = {
      id: randomUUID(),
      sellerId,
      skillName,
      description,
      pricePerUse,
      category,
      successRate: 0,
      totalSales: 0,
      createdAt: new Date(),
    };

    this.listings.set(listing.id, listing);
    economyListings.insert(listing.id, sellerId, skillName, pricePerUse).catch((err) => log.error({ err }, 'DB write failed'));
    incCounter('economy_skills_listed', 'Skills listed on marketplace', 1);
    log.info({ listingId: listing.id, sellerId, skillName, pricePerUse }, 'skill listed');

    return listing;
  }

  getListing(listingId: string): SkillListing | undefined {
    return this.listings.get(listingId);
  }

  getListings(): SkillListing[] {
    return Array.from(this.listings.values());
  }

  getListingsByCategory(category: string): SkillListing[] {
    return this.getListings().filter((l) => l.category === category);
  }

  makeOffer(
    fromAgentId: string,
    toAgentId: string,
    amount: number,
    skillListingId?: string,
  ): TradeOffer {
    if (!this.enabled) {
      throw new Error('Agent economy is disabled');
    }

    const fromAccount = this.accounts.get(fromAgentId);
    if (!fromAccount) {
      throw new Error(`Agent ${fromAgentId} not registered`);
    }
    if (fromAccount.balance < amount) {
      throw new Error(`Insufficient balance: ${fromAccount.balance} < ${amount}`);
    }

    const offer: TradeOffer = {
      id: randomUUID(),
      fromAgentId,
      toAgentId,
      skillListingId,
      amount,
      currency: 'ComputeCredits',
      status: 'pending',
      rounds: 0,
      maxRounds: MAX_NEGOTIATION_ROUNDS,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DEFAULT_TIMEOUT_MS),
    };

    this.offers.set(offer.id, offer);
    economyOffers.insert(offer.id, fromAgentId, toAgentId, skillListingId ?? '', amount, null, offer.expiresAt).catch((err) => log.error({ err }, 'DB write failed'));

    return offer;
  }

  acceptOffer(offerId: string): EscrowContract {
    if (!this.enabled) {
      throw new Error('Agent economy is disabled');
    }

    const offer = this.offers.get(offerId);
    if (!offer) throw new Error(`Offer ${offerId} not found`);
    if (offer.status !== 'pending') throw new Error(`Offer ${offerId} is not pending`);

    offer.status = 'accepted';

    const escrow: EscrowContract = {
      id: randomUUID(),
      tradeOfferId: offerId,
      buyerId: offer.fromAgentId,
      sellerId: offer.toAgentId,
      amount: offer.amount,
      status: 'held',
      timeoutMs: DEFAULT_TIMEOUT_MS,
      createdAt: new Date(),
      resolvedAt: null,
    };

    this.escrows.set(escrow.id, escrow);
    economyEscrows.insert(escrow.id, offerId, escrow.buyerId, escrow.sellerId, escrow.amount).catch((err) => log.error({ err }, 'DB write failed'));

    // Hold funds
    const buyerAccount = this.accounts.get(offer.fromAgentId)!;
    buyerAccount.balance -= offer.amount;

    this.addAuditEntry('escrow', offer.fromAgentId, offer.toAgentId, offer.amount, `Escrow created for offer ${offerId}`);

    incCounter('economy_escrows_created', 'Escrow contracts created', 1);
    log.info({ escrowId: escrow.id, offerId, amount: offer.amount }, 'offer accepted, escrow created');

    return escrow;
  }

  rejectOffer(offerId: string): void {
    const offer = this.offers.get(offerId);
    if (!offer) throw new Error(`Offer ${offerId} not found`);
    offer.status = 'rejected';
    log.info({ offerId }, 'offer rejected');
  }

  counterOffer(offerId: string, counterAmount: number): TradeOffer {
    const offer = this.offers.get(offerId);
    if (!offer) throw new Error(`Offer ${offerId} not found`);
    if (offer.rounds >= offer.maxRounds) {
      offer.status = 'expired';
      throw new Error(`Max negotiation rounds (${offer.maxRounds}) exceeded`);
    }

    offer.status = 'countered';
    offer.counterAmount = counterAmount;
    offer.rounds++;

    const counter: TradeOffer = {
      id: randomUUID(),
      fromAgentId: offer.toAgentId,
      toAgentId: offer.fromAgentId,
      skillListingId: offer.skillListingId,
      amount: counterAmount,
      currency: 'ComputeCredits',
      status: 'pending',
      rounds: offer.rounds,
      maxRounds: offer.maxRounds,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + DEFAULT_TIMEOUT_MS),
    };

    this.offers.set(counter.id, counter);
    economyOffers.insert(counter.id, counter.fromAgentId, counter.toAgentId, counter.skillListingId ?? '', counterAmount, offer.id, counter.expiresAt).catch((err) => log.error({ err }, 'DB write failed'));

    return counter;
  }

  releaseEscrow(escrowId: string): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) throw new Error(`Escrow ${escrowId} not found`);
    if (escrow.status !== 'held') throw new Error(`Escrow ${escrowId} is not held`);

    escrow.status = 'released';
    escrow.resolvedAt = new Date();

    const sellerAccount = this.accounts.get(escrow.sellerId);
    if (sellerAccount) {
      sellerAccount.balance += escrow.amount;
      sellerAccount.totalEarned += escrow.amount;
    }

    const buyerAccount = this.accounts.get(escrow.buyerId);
    if (buyerAccount) {
      buyerAccount.totalSpent += escrow.amount;
    }

    // Update listing stats
    if (escrow.tradeOfferId) {
      const offer = this.offers.get(escrow.tradeOfferId);
      if (offer?.skillListingId) {
        const listing = this.listings.get(offer.skillListingId);
        if (listing) {
          listing.totalSales++;
        }
      }
    }

    this.addAuditEntry('escrow', escrow.buyerId, escrow.sellerId, escrow.amount, `Escrow ${escrowId} released`);
    incCounter('economy_escrows_released', 'Escrow contracts released', 1);
  }

  refundEscrow(escrowId: string): void {
    const escrow = this.escrows.get(escrowId);
    if (!escrow) throw new Error(`Escrow ${escrowId} not found`);
    if (escrow.status !== 'held') throw new Error(`Escrow ${escrowId} is not held`);

    escrow.status = 'refunded';
    escrow.resolvedAt = new Date();

    const buyerAccount = this.accounts.get(escrow.buyerId);
    if (buyerAccount) {
      buyerAccount.balance += escrow.amount;
    }

    this.addAuditEntry('escrow', escrow.sellerId, escrow.buyerId, escrow.amount, `Escrow ${escrowId} refunded`);
    incCounter('economy_escrows_refunded', 'Escrow contracts refunded', 1);
  }

  async negotiatePrice(
    buyerId: string,
    sellerId: string,
    initialOffer: number,
    skillListingId?: string,
  ): Promise<{ finalPrice: number | null; rounds: number; status: string }> {
    if (!this.enabled) {
      throw new Error('Agent economy is disabled');
    }

    let currentOffer = initialOffer;
    let rounds = 0;
    let offer = this.makeOffer(buyerId, sellerId, currentOffer, skillListingId);

    while (rounds < MAX_NEGOTIATION_ROUNDS) {
      rounds++;

      try {
        const completion = await this.llm.complete([
          {
            role: 'system',
            content: 'You are a price negotiation agent. Evaluate the offer. Respond in JSON: {"action": "accept" | "reject" | "counter", "counterAmount": number | null}',
          },
          {
            role: 'user',
            content: `Offer: ${currentOffer} ComputeCredits. Round ${rounds}/${MAX_NEGOTIATION_ROUNDS}.`,
          },
        ], { temperature: 0.3, maxTokens: 200 });

        const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          this.rejectOffer(offer.id);
          return { finalPrice: null, rounds, status: 'rejected' };
        }

        const parsed = JSON.parse(jsonMatch[0]) as { action?: string; counterAmount?: number };

        if (parsed.action === 'accept') {
          this.acceptOffer(offer.id);
          return { finalPrice: currentOffer, rounds, status: 'accepted' };
        }

        if (parsed.action === 'reject') {
          this.rejectOffer(offer.id);
          return { finalPrice: null, rounds, status: 'rejected' };
        }

        if (parsed.action === 'counter' && parsed.counterAmount) {
          currentOffer = parsed.counterAmount;
          offer = this.counterOffer(offer.id, currentOffer);
        } else {
          this.rejectOffer(offer.id);
          return { finalPrice: null, rounds, status: 'rejected' };
        }
      } catch (err) {
        log.warn({ err, rounds }, 'negotiation round failed');
        this.rejectOffer(offer.id);
        return { finalPrice: null, rounds, status: 'error' };
      }
    }

    offer.status = 'expired';
    return { finalPrice: null, rounds, status: 'expired' };
  }

  updateReputation(agentId: string, taskCompleted: boolean, taskTimeMs: number): void {
    const rep = this.reputation.get(agentId);
    if (!rep) return;

    rep.totalTasks++;
    if (taskCompleted) rep.successfulTasks++;

    rep.taskCompletionRate = rep.successfulTasks / rep.totalTasks;
    rep.avgTaskTime = (rep.avgTaskTime * (rep.totalTasks - 1) + taskTimeMs) / rep.totalTasks;

    // Reputation score: weighted completion rate + speed bonus
    const completionScore = rep.taskCompletionRate * 70;
    const speedScore = Math.max(0, 30 - Math.min(30, rep.avgTaskTime / 1000));
    rep.reputationScore = Math.min(MAX_REPUTATION, completionScore + speedScore);

    // Update account reputation
    const account = this.accounts.get(agentId);
    if (account) {
      account.reputation = rep.reputationScore;
    }

    incCounter('economy_reputation_updates', 'Reputation updates', 1);
  }

  getReputation(agentId: string): ReputationRecord | undefined {
    return this.reputation.get(agentId);
  }

  getTopReputation(limit: number = 10): ReputationRecord[] {
    return Array.from(this.reputation.values())
      .sort((a, b) => b.reputationScore - a.reputationScore)
      .slice(0, limit);
  }

  transferCredits(fromId: string, toId: string, amount: number): boolean {
    const from = this.accounts.get(fromId);
    const to = this.accounts.get(toId);
    if (!from || !to) return false;
    if (from.balance < amount) return false;

    from.balance -= amount;
    from.totalSpent += amount;
    to.balance += amount;
    to.totalEarned += amount;

    this.addAuditEntry('credit_transfer', fromId, toId, amount, `Direct transfer`);
    incCounter('economy_transfers', 'Credit transfers', 1);
    return true;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }

  getAuditLogForAgent(agentId: string): AuditEntry[] {
    return this.auditLog.filter((e) => e.agentId === agentId || e.counterpartyId === agentId);
  }

  getStats(): {
    agents: number;
    listings: number;
    activeOffers: number;
    activeEscrows: number;
    totalVolume: number;
  } {
    const activeOffers = Array.from(this.offers.values()).filter((o) => o.status === 'pending').length;
    const activeEscrows = Array.from(this.escrows.values()).filter((e) => e.status === 'held').length;
    const totalVolume = this.auditLog
      .filter((e) => e.type === 'escrow' && e.description.includes('released'))
      .reduce((s, e) => s + e.amount, 0);

    return {
      agents: this.accounts.size,
      listings: this.listings.size,
      activeOffers,
      activeEscrows,
      totalVolume,
    };
  }

  reset(): void {
    this.accounts.clear();
    this.listings.clear();
    this.offers.clear();
    this.escrows.clear();
    this.reputation.clear();
    this.auditLog = [];
  }

  private addAuditEntry(
    type: AuditEntry['type'],
    agentId: string,
    counterpartyId: string,
    amount: number,
    description: string,
  ): void {
    this.auditLog.push({
      id: randomUUID(),
      type,
      agentId,
      counterpartyId,
      amount,
      description,
      timestamp: new Date(),
      immutable: true,
    });
    economyAuditLog.insert(type, agentId, amount, description).catch((err) => log.error({ err }, 'DB write failed'));
  }
}
