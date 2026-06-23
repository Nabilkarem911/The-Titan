import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import { normativeCommitments as ncRepo, normativeConflicts as ncfRepo } from '@titan/database';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'normative-agency' });

export interface Commitment {
  id: string;
  description: string;
  priority: number;
  createdAt: Date;
  status: 'active' | 'fulfilled' | 'violated' | 'revised';
  conflictsWith?: string[];
}

export interface NormConflict {
  id: string;
  commitmentA: string;
  commitmentB: string;
  resolution: string;
  resolvedAt: Date;
}

export interface NormRevision {
  id: string;
  commitmentId: string;
  originalDescription: string;
  revisedDescription: string;
  reason: string;
  timestamp: Date;
}

const DELIBERATION_PROMPT = `You are a normative reasoning engine. Detect conflicts between commitments and propose resolutions.

Respond in JSON:
{
  "hasConflict": true|false,
  "resolution": "how to resolve",
  "revisedCommitment": "if revision needed, the new description"
}`;

export class NormativeAgency {
  private llm: LlmProvider;
  private commitments: Map<string, Commitment> = new Map();
  private conflicts: NormConflict[] = [];
  private revisions: NormRevision[] = [];

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  formCommitment(description: string, priority: number = 5): Commitment {
    const commitment: Commitment = {
      id: randomUUID(),
      description,
      priority: Math.max(1, Math.min(10, priority)),
      createdAt: new Date(),
      status: 'active',
    };

    this.commitments.set(commitment.id, commitment);
    ncRepo.insert(commitment.id, { norm: commitment.description, commitment: commitment.description, status: commitment.status }).catch(() => {});
    incCounter('normative_commitments', 'Normative commitments formed', 1);
    log.info({ id: commitment.id, description: description.slice(0, 80) }, 'commitment formed');
    return commitment;
  }

  getCommitment(id: string): Commitment | null {
    return this.commitments.get(id) ?? null;
  }

  getActiveCommitments(): Commitment[] {
    return [...this.commitments.values()].filter((c) => c.status === 'active');
  }

  async detectConflicts(): Promise<NormConflict[]> {
    const active = this.getActiveCommitments();
    if (active.length < 2) return [];

    const newConflicts: NormConflict[] = [];

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: DELIBERATION_PROMPT },
        { role: 'user', content: `Active commitments:\n${active.map((c) => `- [${c.id}] ${c.description} (priority: ${c.priority})`).join('\n')}` },
      ], { temperature: 0.2, maxTokens: 500 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.hasConflict && parsed.resolution) {
          const conflict: NormConflict = {
            id: randomUUID(),
            commitmentA: active[0].id,
            commitmentB: active[1]?.id ?? active[0].id,
            resolution: parsed.resolution,
            resolvedAt: new Date(),
          };
          newConflicts.push(conflict);
          this.conflicts.push(conflict);
    ncfRepo.insert(conflict.id, { norm1: conflict.commitmentA, norm2: conflict.commitmentB, resolution: conflict.resolution }).catch(() => {});
          incCounter('normative_conflicts', 'Normative conflicts detected', 1);
        }
      }
    } catch (err) {
      log.error({ err }, 'conflict detection failed');
    }

    return newConflicts;
  }

  async reviseUnderError(commitmentId: string, errorDescription: string): Promise<NormRevision | null> {
    const commitment = this.commitments.get(commitmentId);
    if (!commitment) return null;

    try {
      const completion = await this.llm.complete([
        { role: 'system', content: DELIBERATION_PROMPT },
        { role: 'user', content: `Commitment: "${commitment.description}"\nError encountered: "${errorDescription}"\nRevise the commitment to handle this error.` },
      ], { temperature: 0.3, maxTokens: 300 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let revisedDescription = commitment.description;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        revisedDescription = parsed.revisedCommitment ?? commitment.description;
      }

      const revision: NormRevision = {
        id: randomUUID(),
        commitmentId,
        originalDescription: commitment.description,
        revisedDescription,
        reason: errorDescription,
        timestamp: new Date(),
      };

      commitment.description = revisedDescription;
      commitment.status = 'revised';
      this.revisions.push(revision);

      incCounter('normative_revisions', 'Normative revisions', 1);
      log.info({ commitmentId, revisedDescription: revisedDescription.slice(0, 80) }, 'commitment revised under error');
      return revision;
    } catch (err) {
      log.error({ err }, 'revision failed');
      return null;
    }
  }

  fulfillCommitment(id: string): boolean {
    const commitment = this.commitments.get(id);
    if (!commitment) return false;
    commitment.status = 'fulfilled';
    incCounter('normative_fulfilled', 'Commitments fulfilled', 1);
    return true;
  }

  violateCommitment(id: string): boolean {
    const commitment = this.commitments.get(id);
    if (!commitment) return false;
    commitment.status = 'violated';
    incCounter('normative_violated', 'Commitments violated', 1);
    return true;
  }

  getConflicts(): NormConflict[] {
    return [...this.conflicts];
  }

  getRevisions(): NormRevision[] {
    return [...this.revisions];
  }

  getStats(): { total: number; active: number; fulfilled: number; violated: number; revised: number; conflicts: number; revisions: number } {
    const all = [...this.commitments.values()];
    return {
      total: all.length,
      active: all.filter((c) => c.status === 'active').length,
      fulfilled: all.filter((c) => c.status === 'fulfilled').length,
      violated: all.filter((c) => c.status === 'violated').length,
      revised: all.filter((c) => c.status === 'revised').length,
      conflicts: this.conflicts.length,
      revisions: this.revisions.length,
    };
  }

  reset(): void {
    this.commitments.clear();
    this.conflicts = [];
    this.revisions = [];
  }
}
