import { getLogger } from '@titan/logging';
import type { LlmProvider } from '../types.js';
import type { SwarmSubTask } from './types.js';

const log = getLogger().child({ component: 'swarm-negotiator' });

export interface Conflict {
  subTaskA: SwarmSubTask;
  subTaskB: SwarmSubTask;
  description: string;
}

export interface Resolution {
  winner: 'a' | 'b' | 'merge';
  mergedResult?: string;
  reason: string;
}

const RESOLVE_PROMPT = `Two AI agents produced conflicting results for related tasks. Resolve the conflict.

Respond ONLY with JSON:
{
  "winner": "a|b|merge",
  "mergedResult": "combined result if merge, otherwise null",
  "reason": "brief explanation"
}

Choose "merge" when both have valid points. Choose "a" or "b" when one is clearly better.`;

export class Negotiator {
  constructor(private llm: LlmProvider) {}

  detectConflicts(subTasks: SwarmSubTask[]): Conflict[] {
    const conflicts: Conflict[] = [];
    const completed = subTasks.filter((s) => s.status === 'completed' && s.result);

    for (let i = 0; i < completed.length; i++) {
      for (let j = i + 1; j < completed.length; j++) {
        const a = completed[i];
        const b = completed[j];

        if (this.mightConflict(a, b)) {
          conflicts.push({
            subTaskA: a,
            subTaskB: b,
            description: `${a.agentRole} and ${b.agentRole} produced potentially conflicting results`,
          });
        }
      }
    }

    return conflicts;
  }

  async resolve(conflict: Conflict): Promise<Resolution> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: RESOLVE_PROMPT },
        {
          role: 'user',
          content: `Task A (${conflict.subTaskA.agentRole}): ${conflict.subTaskA.prompt}\nResult A: ${conflict.subTaskA.result?.slice(0, 1500)}\n\nTask B (${conflict.subTaskB.agentRole}): ${conflict.subTaskB.prompt}\nResult B: ${conflict.subTaskB.result?.slice(0, 1500)}`,
        },
      ], { temperature: 0.1 });

      const resolution = this.parseResolution(completion.content);
      log.info({
        taskA: conflict.subTaskA.id,
        taskB: conflict.subTaskB.id,
        winner: resolution.winner,
      }, 'conflict resolved');

      return resolution;
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'conflict resolution failed');
      return { winner: 'a', reason: 'Fallback — kept first result' };
    }
  }

  private mightConflict(a: SwarmSubTask, b: SwarmSubTask): boolean {
    if (!a.result || !b.result) return false;

    // Same role working on overlapping prompts
    if (a.agentRole === b.agentRole) return true;

    // Reviewer vs original author
    if (
      (a.agentRole === 'reviewer' && b.agentRole === 'coder') ||
      (a.agentRole === 'coder' && b.agentRole === 'reviewer')
    ) {
      return true;
    }

    // Check for contradictory keywords
    const negationPairs = [
      ['should', 'should not'],
      ['yes', 'no'],
      ['correct', 'incorrect'],
      ['true', 'false'],
      ['recommend', 'avoid'],
    ];

    const aLower = a.result.toLowerCase();
    const bLower = b.result.toLowerCase();

    for (const [pos, neg] of negationPairs) {
      if ((aLower.includes(pos) && bLower.includes(neg)) || (aLower.includes(neg) && bLower.includes(pos))) {
        return true;
      }
    }

    return false;
  }

  private parseResolution(content: string): Resolution {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return { winner: 'merge', reason: 'Could not parse' };

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const winner = ['a', 'b', 'merge'].includes(String(parsed.winner))
        ? (String(parsed.winner) as Resolution['winner'])
        : 'merge';

      return {
        winner,
        mergedResult: typeof parsed.mergedResult === 'string' ? parsed.mergedResult : undefined,
        reason: String(parsed.reason ?? ''),
      };
    } catch {
      return { winner: 'merge', reason: 'Parse error' };
    }
  }
}
