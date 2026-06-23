import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { selfImprovementProposals as proposalsRepo } from '@titan/database';
import type { LlmProvider, AgentRun } from '../types.js';

const log = getLogger().child({ component: 'self-improver' });

export interface ImprovementProposal {
  id: string;
  category: 'prompt' | 'strategy' | 'tool_usage' | 'planning' | 'reflection';
  description: string;
  suggestedChange: string;
  expectedBenefit: string;
  confidence: number;
  createdAt: Date;
}

export interface ImprovementArchive {
  proposals: ImprovementProposal[];
  applied: ImprovementProposal[];
  rejected: ImprovementProposal[];
}

const IMPROVER_PROMPT = `You are a meta-agent that analyzes agent runs and proposes improvements.

Analyze the run data and identify:
1. Was the prompt effective? Could a better prompt have gotten a better result?
2. Was the strategy appropriate? Should a different strategy have been used?
3. Were tools used efficiently? Were there unnecessary tool calls?
4. Was the plan good? Could better decomposition have helped?
5. Was self-critique effective? Did it catch real issues?

Propose concrete improvements in JSON:
{
  "proposals": [
    {
      "category": "prompt" | "strategy" | "tool_usage" | "planning" | "reflection",
      "description": "What was suboptimal",
      "suggestedChange": "Specific change to make",
      "expectedBenefit": "What this will improve",
      "confidence": 0-100
    }
  ]
}`;

export class SelfImprover {
  private archive: ImprovementArchive = { proposals: [], applied: [], rejected: [] };
  private maxArchiveSize: number;

  constructor(private llm: LlmProvider, maxArchiveSize = 100) {
    this.maxArchiveSize = maxArchiveSize;
  }

  async analyzeRun(run: AgentRun): Promise<ImprovementProposal[]> {
    if (run.steps.length === 0) return [];

    try {
      const runSummary = {
        prompt: run.prompt.slice(0, 500),
        status: run.status,
        steps: run.steps.length,
        tokensUsed: run.tokensUsed,
        finalAnswer: run.finalAnswer?.slice(0, 500),
        toolCalls: run.steps.filter((s) => s.action).map((s) => ({
          tool: s.action?.name,
          success: s.observation?.success,
        })),
        reflections: run.steps.filter((s) => s.reflection).map((s) => s.reflection?.slice(0, 200)),
      };

      const response = await this.llm.complete([
        { role: 'system', content: IMPROVER_PROMPT },
        { role: 'user', content: JSON.stringify(runSummary) },
      ], {
        temperature: 0.3,
        maxTokens: 1500,
      });

      const proposals = this.parseProposals(response.content, run.id);
      this.archive.proposals.push(...proposals);

      if (this.archive.proposals.length > this.maxArchiveSize) {
        this.archive.proposals = this.archive.proposals.slice(-this.maxArchiveSize);
      }

      for (const p of proposals) {
        proposalsRepo.insert({
          id: p.id, runId: run.id, category: p.category, description: p.description,
          suggestedChange: p.suggestedChange, expectedBenefit: p.expectedBenefit,
          confidence: p.confidence, status: 'pending', createdAt: p.createdAt,
        }).catch((err) => log.warn({ err, id: p.id }, 'failed to persist proposal'));
      }

      incCounter('meta_agent_proposals', 'Improvement proposals generated', proposals.length);
      log.info({ runId: run.id, count: proposals.length }, 'improvement proposals generated');

      return proposals;
    } catch (err) {
      log.warn({ err, runId: run.id }, 'self-improver analysis failed');
      return [];
    }
  }

  getArchive(): ImprovementArchive {
    return this.archive;
  }

  getRecentProposals(count = 10): ImprovementProposal[] {
    return this.archive.proposals.slice(-count);
  }

  markApplied(proposalId: string): void {
    const idx = this.archive.proposals.findIndex((p) => p.id === proposalId);
    if (idx >= 0) {
      const [proposal] = this.archive.proposals.splice(idx, 1);
      this.archive.applied.push(proposal);
      proposalsRepo.updateStatus(proposalId, 'applied').catch(() => {});
      log.info({ proposalId }, 'improvement proposal marked as applied');
    }
  }

  markRejected(proposalId: string): void {
    const idx = this.archive.proposals.findIndex((p) => p.id === proposalId);
    if (idx >= 0) {
      const [proposal] = this.archive.proposals.splice(idx, 1);
      this.archive.rejected.push(proposal);
      proposalsRepo.updateStatus(proposalId, 'rejected').catch(() => {});
      log.info({ proposalId }, 'improvement proposal marked as rejected');
    }
  }

  private parseProposals(content: string, runId: string): ImprovementProposal[] {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const raw = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(raw.proposals)) return [];

      return raw.proposals.map((p: Record<string, unknown>) => ({
        id: `${runId}-${Math.random().toString(36).slice(2, 8)}`,
        category: (p.category as string) ?? 'prompt',
        description: (p.description as string) ?? '',
        suggestedChange: (p.suggestedChange as string) ?? '',
        expectedBenefit: (p.expectedBenefit as string) ?? '',
        confidence: Math.max(0, Math.min(100, Number(p.confidence ?? 50))),
        createdAt: new Date(),
      }));
    } catch {
      return [];
    }
  }
}
