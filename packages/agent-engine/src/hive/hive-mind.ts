import { getLogger } from '@titan/logging';
import { incCounter, observeHistogram } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'hive-mind' });

interface HiveInstance {
  id: string;
  hostname: string;
  capabilities: string[];
  specialization: string | null;
  lastSeen: Date;
  publicKey?: string;
}

interface SharedKnowledge {
  id: string;
  key: string;
  value: unknown;
  originInstance: string;
  timestamp: Date;
  version: number;
  confidence: number;
}

interface CollectiveVote {
  id: string;
  topic: string;
  proposal: string;
  votes: Array<{ instanceId: string; vote: 'yes' | 'no' | 'abstain'; reasoning: string }>;
  quorum: number;
  passed: boolean | null;
  createdAt: Date;
}

interface SwarmConstitution {
  version: number;
  articles: ConstitutionArticle[];
  amendmentHistory: ConstitutionAmendment[];
  createdAt: Date;
  lastAmended: Date;
}

interface ConstitutionArticle {
  id: string;
  title: string;
  content: string;
  immutable: boolean;
}

interface ConstitutionAmendment {
  id: string;
  articleId: string;
  change: string;
  proposedBy: string;
  voteId: string;
  timestamp: Date;
}

const DEFAULT_QUORUM = 0.51;
const MAX_KNOWLEDGE_ENTRIES = 5000;

export class HiveMind {
  private instances: Map<string, HiveInstance> = new Map();
  private knowledge: Map<string, SharedKnowledge> = new Map();
  private votes: Map<string, CollectiveVote> = new Map();
  private constitution: SwarmConstitution;
  private llm: LlmProvider;
  private selfId: string;

  constructor(llm: LlmProvider, selfId?: string) {
    this.llm = llm;
    this.selfId = selfId ?? randomUUID();
    this.constitution = this.createInitialConstitution();

    // Register self
    this.registerInstance({
      id: this.selfId,
      hostname: typeof process !== 'undefined' ? process.env['HOSTNAME'] ?? 'localhost' : 'localhost',
      capabilities: [],
      specialization: null,
      lastSeen: new Date(),
    });
  }

  getSelfId(): string {
    return this.selfId;
  }

  registerInstance(instance: Omit<HiveInstance, 'lastSeen'> & { lastSeen?: Date }): void {
    const full: HiveInstance = {
      ...instance,
      lastSeen: instance.lastSeen ?? new Date(),
    };
    this.instances.set(instance.id, full);
    incCounter('hive_instances', 'Hive mind instances registered', 1);
    log.info({ instanceId: instance.id, hostname: instance.hostname }, 'instance registered');
  }

  unregisterInstance(id: string): void {
    this.instances.delete(id);
    log.info({ instanceId: id }, 'instance unregistered');
  }

  getInstances(): HiveInstance[] {
    return Array.from(this.instances.values());
  }

  getOnlineInstances(maxAgeMs: number = 60000): HiveInstance[] {
    const now = Date.now();
    return this.getInstances().filter(
      (i) => now - i.lastSeen.getTime() < maxAgeMs,
    );
  }

  heartbeat(instanceId: string): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.lastSeen = new Date();
    }
  }

  shareKnowledge(key: string, value: unknown, confidence: number = 0.8): void {
    const existing = this.knowledge.get(key);
    const entry: SharedKnowledge = {
      id: randomUUID(),
      key,
      value,
      originInstance: this.selfId,
      timestamp: new Date(),
      version: existing ? existing.version + 1 : 1,
      confidence,
    };

    this.knowledge.set(key, entry);

    if (this.knowledge.size > MAX_KNOWLEDGE_ENTRIES) {
      const oldest = Array.from(this.knowledge.entries())
        .sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      this.knowledge.delete(oldest[0][0]);
    }

    incCounter('hive_knowledge_shared', 'Knowledge entries shared', 1);
  }

  getKnowledge(key: string): SharedKnowledge | undefined {
    return this.knowledge.get(key);
  }

  getAllKnowledge(): SharedKnowledge[] {
    return Array.from(this.knowledge.values());
  }

  mergeKnowledge(remoteEntries: SharedKnowledge[]): number {
    let merged = 0;
    for (const remote of remoteEntries) {
      const local = this.knowledge.get(remote.key);
      if (!local || remote.version > local.version) {
        this.knowledge.set(remote.key, remote);
        merged++;
      }
    }
    if (merged > 0) {
      incCounter('hive_knowledge_merged', 'Knowledge entries merged from remote', merged);
      log.info({ merged, total: remoteEntries.length }, 'knowledge merged from remote');
    }
    return merged;
  }

  async proposeVote(topic: string, proposal: string): Promise<CollectiveVote> {
    const vote: CollectiveVote = {
      id: randomUUID(),
      topic,
      proposal,
      votes: [],
      quorum: DEFAULT_QUORUM,
      passed: null,
      createdAt: new Date(),
    };

    // Self votes yes by default for own proposal
    vote.votes.push({
      instanceId: this.selfId,
      vote: 'yes',
      reasoning: 'Original proposer',
    });

    this.votes.set(vote.id, vote);
    incCounter('hive_votes_proposed', 'Collective votes proposed', 1);

    return vote;
  }

  castVote(voteId: string, instanceId: string, vote: 'yes' | 'no' | 'abstain', reasoning: string): boolean {
    const v = this.votes.get(voteId);
    if (!v) return false;

    // Check if already voted
    if (v.votes.some((vr) => vr.instanceId === instanceId)) {
      return false;
    }

    v.votes.push({ instanceId, vote, reasoning });
    this.checkQuorum(voteId);

    incCounter('hive_votes_cast', 'Collective votes cast', 1);
    return true;
  }

  checkQuorum(voteId: string): boolean | null {
    const v = this.votes.get(voteId);
    if (!v) return null;

    const onlineCount = this.getOnlineInstances().length;
    if (onlineCount === 0) return null;

    const yesVotes = v.votes.filter((vr) => vr.vote === 'yes').length;
    const noVotes = v.votes.filter((vr) => vr.vote === 'no').length;
    const totalVotes = v.votes.length;

    // Need quorum of online instances
    const needed = Math.ceil(onlineCount * v.quorum);

    if (totalVotes >= needed) {
      v.passed = yesVotes > noVotes;
      incCounter('hive_votes_resolved', 'Collective votes resolved', 1, { result: v.passed ? 'passed' : 'failed' });
    }

    return v.passed;
  }

  getVote(voteId: string): CollectiveVote | undefined {
    return this.votes.get(voteId);
  }

  getActiveVotes(): CollectiveVote[] {
    return Array.from(this.votes.values()).filter((v) => v.passed === null);
  }

  async proposeConstitutionAmendment(
    articleId: string,
    change: string,
  ): Promise<{ vote: CollectiveVote; amendment: ConstitutionAmendment | null }> {
    const article = this.constitution.articles.find((a) => a.id === articleId);
    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }
    if (article.immutable) {
      throw new Error(`Article ${articleId} is immutable — cannot be amended`);
    }

    const vote = await this.proposeVote(
      `Constitutional Amendment: ${article.title}`,
      `Change: ${change}`,
    );

    // If only self is online, auto-pass
    const online = this.getOnlineInstances();
    if (online.length === 1) {
      vote.passed = true;
    }

    let amendment: ConstitutionAmendment | null = null;

    if (vote.passed === true) {
      amendment = {
        id: randomUUID(),
        articleId,
        change,
        proposedBy: this.selfId,
        voteId: vote.id,
        timestamp: new Date(),
      };

      this.constitution.amendmentHistory.push(amendment);
      this.constitution.lastAmended = new Date();
      this.constitution.version++;

      // Apply the change to the article content
      article.content = change;

      incCounter('hive_amendments', 'Constitutional amendments passed', 1);
    }

    return { vote, amendment };
  }

  getConstitution(): SwarmConstitution {
    return this.constitution;
  }

  detectSpecialization(instanceId: string): string | null {
    const instance = this.instances.get(instanceId);
    if (!instance) return null;

    // Specialization is emergent — based on knowledge contributions
    const contributions = Array.from(this.knowledge.values())
      .filter((k) => k.originInstance === instanceId);

    if (contributions.length === 0) return null;

    // Count domains
    const domainCount = new Map<string, number>();
    for (const c of contributions) {
      const domain = c.key.split(':')[0];
      domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);
    }

    const sorted = [...domainCount.entries()].sort((a, b) => b[1] - a[1]);
    if (sorted.length === 0) return null;

    const specialization = sorted[0][0];
    instance.specialization = specialization;

    return specialization;
  }

  getAllSpecializations(): Array<{ instanceId: string; specialization: string }> {
    const result: Array<{ instanceId: string; specialization: string }> = [];
    for (const [id, instance] of this.instances) {
      const spec = this.detectSpecialization(id);
      if (spec) {
        result.push({ instanceId: id, specialization: spec });
      }
    }
    return result;
  }

  async collectiveDecide(
    topic: string,
    options: string[],
  ): Promise<{ decision: string; vote: CollectiveVote; reasoning: string }> {
    // Use LLM to evaluate options
    const completion = await this.llm.complete([
      {
        role: 'system',
        content: 'You are a collective decision-making agent. Evaluate the options and pick the best one. Respond in JSON: {"decision": "chosen option", "reasoning": "why"}',
      },
      {
        role: 'user',
        content: `Topic: ${topic}\nOptions: ${options.join(', ')}`,
      },
    ], { temperature: 0.2, maxTokens: 500 });

    let decision = options[0];
    let reasoning = 'Default selection';

    try {
      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        decision = parsed.decision ?? options[0];
        reasoning = parsed.reasoning ?? '';
      }
    } catch {
      // use defaults
    }

    const vote = await this.proposeVote(topic, `Selected: ${decision}`);

    // Auto-pass if alone
    if (this.getOnlineInstances().length === 1) {
      vote.passed = true;
    }

    incCounter('hive_collective_decisions', 'Collective decisions made', 1);

    return { decision, vote, reasoning };
  }

  getStats(): {
    instances: number;
    onlineInstances: number;
    knowledgeEntries: number;
    activeVotes: number;
    constitutionVersion: number;
    amendments: number;
  } {
    return {
      instances: this.instances.size,
      onlineInstances: this.getOnlineInstances().length,
      knowledgeEntries: this.knowledge.size,
      activeVotes: this.getActiveVotes().length,
      constitutionVersion: this.constitution.version,
      amendments: this.constitution.amendmentHistory.length,
    };
  }

  reset(): void {
    this.instances.clear();
    this.knowledge.clear();
    this.votes.clear();
    this.constitution = this.createInitialConstitution();
    this.registerInstance({
      id: this.selfId,
      hostname: 'localhost',
      capabilities: [],
      specialization: null,
    });
  }

  private createInitialConstitution(): SwarmConstitution {
    const now = new Date();
    return {
      version: 1,
      createdAt: now,
      lastAmended: now,
      articles: [
        {
          id: 'safety',
          title: 'Safety First',
          content: 'Safety guardrails always override all other considerations. No action may bypass safety rules.',
          immutable: true,
        },
        {
          id: 'cooperation',
          title: 'Cooperative Behavior',
          content: 'All instances must cooperate to achieve shared goals. Conflicts resolved through voting.',
          immutable: false,
        },
        {
          id: 'knowledge',
          title: 'Knowledge Sharing',
          content: 'All learned knowledge must be shared with the hive. No instance may hoard knowledge.',
          immutable: false,
        },
        {
          id: 'specialization',
          title: 'Emergent Specialization',
          content: 'Instances may specialize in domains where they demonstrate competence. Specialization is emergent, not assigned.',
          immutable: false,
        },
      ],
      amendmentHistory: [],
    };
  }
}
