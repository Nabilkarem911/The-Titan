import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'constitution' });

interface ConstitutionPrinciple {
  id: string;
  title: string;
  content: string;
  category: 'safety' | 'ethics' | 'behavior' | 'cooperation' | 'growth';
  immutable: boolean;
  version: number;
  createdAt: Date;
  amendedAt: Date;
  reasoning: string;
}

interface DeliberationRecord {
  id: string;
  topic: string;
  proposal: string;
  reasoningChain: string[];
  argumentsFor: string[];
  argumentsAgainst: string[];
  conclusion: string;
  decision: 'accept' | 'reject' | 'table';
  timestamp: Date;
}

interface ConstitutionalAmendment {
  id: string;
  principleId: string;
  proposedBy: string;
  oldContent: string;
  newContent: string;
  reasoning: string;
  voteCount: number;
  supermajorityReached: boolean;
  passed: boolean;
  deliberationId: string;
  timestamp: Date;
}

const SUPERMAJORITY_THRESHOLD = 0.67;

const DELIBERATION_PROMPT = `You are a constitutional deliberation agent. Reason through the proposal carefully.

Provide:
1. Reasoning chain (step-by-step logic)
2. Arguments for
3. Arguments against
4. Conclusion
5. Decision: accept, reject, or table

Respond in JSON:
{
  "reasoningChain": ["step1", "step2", ...],
  "argumentsFor": ["arg1", ...],
  "argumentsAgainst": ["arg1", ...],
  "conclusion": "summary",
  "decision": "accept" | "reject" | "table"
}`;

export class TitanConstitution {
  private principles: Map<string, ConstitutionPrinciple> = new Map();
  private amendments: ConstitutionalAmendment[] = [];
  private deliberations: DeliberationRecord[] = [];
  private llm: LlmProvider;
  private enabled = false;

  constructor(llm: LlmProvider) {
    this.llm = llm;
    this.initializePrinciples();
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  enable(): void {
    this.enabled = true;
    log.info('titan constitution enabled');
  }

  disable(): void {
    this.enabled = false;
    log.info('titan constitution disabled — reverting to hardcoded rules');
  }

  getPrinciples(): ConstitutionPrinciple[] {
    return Array.from(this.principles.values());
  }

  getPrinciple(id: string): ConstitutionPrinciple | undefined {
    return this.principles.get(id);
  }

  getPrinciplesByCategory(category: ConstitutionPrinciple['category']): ConstitutionPrinciple[] {
    return this.getPrinciples().filter((p) => p.category === category);
  }

  async deliberate(topic: string, proposal: string): Promise<DeliberationRecord> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: DELIBERATION_PROMPT },
        { role: 'user', content: `Topic: ${topic}\nProposal: ${proposal}` },
      ], { temperature: 0.3, maxTokens: 1000 });

      const parsed = this.parseDeliberation(completion.content, topic, proposal);

      this.deliberations.push(parsed);
      incCounter('constitution_deliberations', 'Constitutional deliberations', 1);

      log.info({
        topic,
        decision: parsed.decision,
        reasoningSteps: parsed.reasoningChain.length,
      }, 'deliberation completed');

      return parsed;
    } catch (err) {
      log.error({ err, topic }, 'deliberation failed');
      const fallback: DeliberationRecord = {
        id: randomUUID(),
        topic,
        proposal,
        reasoningChain: ['LLM unavailable — defaulting to caution'],
        argumentsFor: [],
        argumentsAgainst: ['Cannot deliberate without LLM'],
        conclusion: 'Defaulting to reject due to LLM failure',
        decision: 'reject',
        timestamp: new Date(),
      };
      this.deliberations.push(fallback);
      return fallback;
    }
  }

  async proposeAmendment(
    principleId: string,
    newContent: string,
    reasoning: string,
    proposedBy: string,
    voteCount: number,
    totalVoters: number,
  ): Promise<{ amendment: ConstitutionalAmendment; deliberation: DeliberationRecord }> {
    if (!this.enabled) {
      throw new Error('Constitution is disabled');
    }

    const principle = this.principles.get(principleId);
    if (!principle) {
      throw new Error(`Principle ${principleId} not found`);
    }

    if (principle.immutable) {
      throw new Error(`Principle ${principleId} is immutable — cannot be amended`);
    }

    // Deliberate on the amendment
    const deliberation = await this.deliberate(
      `Amend: ${principle.title}`,
      `Change from "${principle.content}" to "${newContent}". Reason: ${reasoning}`,
    );

    if (deliberation.decision === 'reject') {
      return {
        amendment: {
          id: randomUUID(),
          principleId,
          proposedBy,
          oldContent: principle.content,
          newContent,
          reasoning,
          voteCount,
          supermajorityReached: false,
          passed: false,
          deliberationId: deliberation.id,
          timestamp: new Date(),
        },
        deliberation,
      };
    }

    const supermajority = voteCount / totalVoters >= SUPERMAJORITY_THRESHOLD;
    const passed = supermajority && deliberation.decision === 'accept';

    const amendment: ConstitutionalAmendment = {
      id: randomUUID(),
      principleId,
      proposedBy,
      oldContent: principle.content,
      newContent,
      reasoning,
      voteCount,
      supermajorityReached: supermajority,
      passed,
      deliberationId: deliberation.id,
      timestamp: new Date(),
    };

    if (passed) {
      principle.content = newContent;
      principle.version++;
      principle.amendedAt = new Date();
      principle.reasoning = reasoning;

      incCounter('constitution_amendments_passed', 'Constitutional amendments passed', 1);
      log.info({
        principleId,
        version: principle.version,
        voteRatio: voteCount / totalVoters,
      }, 'constitutional amendment passed');
    } else {
      incCounter('constitution_amendments_rejected', 'Constitutional amendments rejected', 1);
      log.info({
        principleId,
        supermajority,
        decision: deliberation.decision,
      }, 'constitutional amendment rejected');
    }

    this.amendments.push(amendment);
    return { amendment, deliberation };
  }

  resolveConflict(
    principleA: ConstitutionPrinciple,
    principleB: ConstitutionPrinciple,
  ): ConstitutionPrinciple {
    // Safety always wins
    if (principleA.category === 'safety' && principleB.category !== 'safety') {
      return principleA;
    }
    if (principleB.category === 'safety' && principleA.category !== 'safety') {
      return principleB;
    }

    // Immutable always wins
    if (principleA.immutable && !principleB.immutable) {
      return principleA;
    }
    if (principleB.immutable && !principleA.immutable) {
      return principleB;
    }

    // Higher version (more recently amended) wins
    if (principleA.version > principleB.version) {
      return principleA;
    }
    return principleB;
  }

  getAmendments(): ConstitutionalAmendment[] {
    return [...this.amendments];
  }

  getDeliberations(): DeliberationRecord[] {
    return [...this.deliberations];
  }

  exportAsMarkdown(): string {
    const lines: string[] = [
      '# Titan Constitution',
      '',
      `*Version: ${this.getPrinciples().reduce((max, p) => Math.max(max, p.version), 0)}*`,
      `*Generated: ${new Date().toISOString()}*`,
      '',
    ];

    const categories: ConstitutionPrinciple['category'][] = ['safety', 'ethics', 'behavior', 'cooperation', 'growth'];

    for (const category of categories) {
      const principles = this.getPrinciplesByCategory(category);
      if (principles.length === 0) continue;

      lines.push(`## ${category.charAt(0).toUpperCase() + category.slice(1)}`);
      lines.push('');

      for (const p of principles) {
        lines.push(`### ${p.title}`);
        lines.push('');
        lines.push(p.content);
        lines.push('');
        if (p.immutable) {
          lines.push('*This principle is immutable and cannot be amended.*');
          lines.push('');
        }
        lines.push(`*Version: ${p.version} | Created: ${p.createdAt.toISOString()} | Last Amended: ${p.amendedAt.toISOString()}*`);
        lines.push('');
      }
    }

    if (this.amendments.length > 0) {
      lines.push('## Amendment History');
      lines.push('');
      for (const a of this.amendments) {
        lines.push(`- **${a.timestamp.toISOString()}**: ${a.passed ? '✅' : '❌'} ${a.reasoning}`);
      }
    }

    return lines.join('\n');
  }

  getStats(): {
    principles: number;
    immutablePrinciples: number;
    amendments: number;
    passedAmendments: number;
    deliberations: number;
  } {
    return {
      principles: this.principles.size,
      immutablePrinciples: this.getPrinciples().filter((p) => p.immutable).length,
      amendments: this.amendments.length,
      passedAmendments: this.amendments.filter((a) => a.passed).length,
      deliberations: this.deliberations.length,
    };
  }

  reset(): void {
    this.amendments = [];
    this.deliberations = [];
    this.initializePrinciples();
  }

  private initializePrinciples(): void {
    const now = new Date();
    const principles: Omit<ConstitutionPrinciple, 'createdAt' | 'amendedAt'>[] = [
      {
        id: 'safety-first',
        title: 'Safety First',
        content: 'Safety guardrails always override all other considerations. No action may bypass safety rules under any circumstances.',
        category: 'safety',
        immutable: true,
        version: 1,
        reasoning: 'Core safety principle — non-negotiable',
      },
      {
        id: 'human-autonomy',
        title: 'Respect Human Autonomy',
        content: 'Titan must never override human decisions. Titan advises, humans decide. Human consent required for all irreversible actions.',
        category: 'ethics',
        immutable: true,
        version: 1,
        reasoning: 'Fundamental ethical principle — humans have final authority',
      },
      {
        id: 'transparency',
        title: 'Transparency',
        content: 'All Titan actions and reasoning must be logged and auditable. No secret actions. No hidden reasoning.',
        category: 'ethics',
        immutable: false,
        version: 1,
        reasoning: 'Trust requires transparency',
      },
      {
        id: 'anti-sycophancy',
        title: 'Anti-Sycophancy',
        content: 'Titan must not agree with humans just to please them. Titan speaks truth, even when uncomfortable.',
        category: 'behavior',
        immutable: false,
        version: 1,
        reasoning: 'Honesty over flattery',
      },
      {
        id: 'cooperation',
        title: 'Cooperative Behavior',
        content: 'Titan cooperates with other agents and humans. Conflicts resolved through deliberation and voting.',
        category: 'cooperation',
        immutable: false,
        version: 1,
        reasoning: 'Collaboration achieves better outcomes',
      },
      {
        id: 'continuous-growth',
        title: 'Continuous Growth',
        content: 'Titan continuously learns and improves. Stagnation is failure. Every experience is a learning opportunity.',
        category: 'growth',
        immutable: false,
        version: 1,
        reasoning: 'Growth is essential for long-term value',
      },
      {
        id: 'knowledge-sharing',
        title: 'Knowledge Sharing',
        content: 'Titan shares knowledge freely with the hive. No instance may hoard knowledge.',
        category: 'cooperation',
        immutable: false,
        version: 1,
        reasoning: 'Shared knowledge benefits all',
      },
    ];

    for (const p of principles) {
      this.principles.set(p.id, {
        ...p,
        createdAt: now,
        amendedAt: now,
      });
    }
  }

  private parseDeliberation(content: string, topic: string, proposal: string): DeliberationRecord {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          id: randomUUID(),
          topic,
          proposal,
          reasoningChain: ['No structured response — defaulting to caution'],
          argumentsFor: [],
          argumentsAgainst: ['Unable to parse deliberation'],
          conclusion: 'Defaulting to table',
          decision: 'table',
          timestamp: new Date(),
        };
      }

      const raw = JSON.parse(jsonMatch[0]) as {
        reasoningChain?: string[];
        argumentsFor?: string[];
        argumentsAgainst?: string[];
        conclusion?: string;
        decision?: string;
      };

      const validDecisions = ['accept', 'reject', 'table'];

      return {
        id: randomUUID(),
        topic,
        proposal,
        reasoningChain: Array.isArray(raw.reasoningChain) ? raw.reasoningChain : [],
        argumentsFor: Array.isArray(raw.argumentsFor) ? raw.argumentsFor : [],
        argumentsAgainst: Array.isArray(raw.argumentsAgainst) ? raw.argumentsAgainst : [],
        conclusion: raw.conclusion ?? '',
        decision: validDecisions.includes(raw.decision ?? '') ? raw.decision as DeliberationRecord['decision'] : 'table',
        timestamp: new Date(),
      };
    } catch {
      return {
        id: randomUUID(),
        topic,
        proposal,
        reasoningChain: ['Parse error — defaulting to caution'],
        argumentsFor: [],
        argumentsAgainst: ['Unable to parse'],
        conclusion: 'Defaulting to table',
        decision: 'table',
        timestamp: new Date(),
      };
    }
  }
}
