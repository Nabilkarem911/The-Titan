import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { AgentStep } from '../types.js';
import type { ReasoningStrategy, StrategyContext, StrategyResult, ThoughtBranch } from './types.js';

const log = getLogger().child({ component: 'strategy-tot' });

const MAX_BRANCHES = 3;
const MAX_DEPTH = 3;

const BRANCH_PROMPT = `You are exploring different approaches to solve a problem. Generate exactly {count} distinct approaches.

For each approach, provide:
1. A brief description of the approach
2. An initial reasoning step

Respond ONLY with JSON:
{
  "approaches": [
    { "description": "Approach 1: ...", "reasoning": "First, I would..." },
    { "description": "Approach 2: ...", "reasoning": "Instead, I could..." }
  ]
}`;

const EVALUATE_PROMPT = `You are evaluating different solution approaches. Score each one from 0-100 based on:
- Feasibility: Can this approach actually work?
- Efficiency: Is this the simplest path to the answer?
- Correctness: Is the reasoning sound?

Respond ONLY with JSON:
{
  "evaluations": [
    { "branchId": "...", "score": 0-100, "reasoning": "..." }
  ]
}`;

const CONTINUE_PROMPT = `Continue developing this approach to solve the problem.

Current approach: {approach}
Progress so far: {progress}

Provide the next reasoning step. If you have enough information for a final answer, prefix it with "FINAL ANSWER:".`;

export class TreeOfThoughtStrategy implements ReasoningStrategy {
  name = 'tree-of-thought' as const;

  async execute(ctx: StrategyContext): Promise<StrategyResult> {
    const { run, llm, tools, executeTool, onStep } = ctx;
    const steps: AgentStep[] = [];
    let tokensUsed = 0;

    // Step 1: Generate initial branches
    const branchStep: AgentStep = {
      id: randomUUID(),
      runId: run.id,
      index: 1,
      status: 'planning',
      thought: 'Generating multiple solution approaches...',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const branchPrompt = BRANCH_PROMPT.replace('{count}', String(MAX_BRANCHES));
    const branchCompletion = await llm.complete([
      { role: 'system', content: branchPrompt },
      { role: 'user', content: `Problem: ${run.prompt}` },
    ], { temperature: 0.8 });

    tokensUsed += branchCompletion.tokensUsed;
    branchStep.tokensUsed = branchCompletion.tokensUsed;

    const branches = this.parseBranches(branchCompletion.content);
    branchStep.reflection = `Generated ${branches.length} approaches:\n${branches.map((b, i) => `${i + 1}. ${b.thought}`).join('\n')}`;
    branchStep.status = 'completed';
    branchStep.updatedAt = new Date();
    steps.push(branchStep);
    if (onStep) await onStep(branchStep);

    // Step 2: Develop each branch
    for (let depth = 0; depth < MAX_DEPTH; depth++) {
      const activeBranches = branches.filter((b) => !b.isTerminal);
      if (activeBranches.length === 0) break;

      for (const branch of activeBranches) {
        const devStep: AgentStep = {
          id: randomUUID(),
          runId: run.id,
          index: steps.length + 1,
          status: 'planning',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const prompt = CONTINUE_PROMPT
          .replace('{approach}', branch.thought)
          .replace('{progress}', branch.children.map((c) => c.thought).join('\n') || 'No progress yet');

        const completion = await llm.complete([
          { role: 'system', content: ctx.systemPrompt || 'Solve the problem step by step.' },
          { role: 'user', content: `Problem: ${run.prompt}\n\n${prompt}` },
        ], { tools, temperature: 0.3 });

        tokensUsed += completion.tokensUsed;
        devStep.tokensUsed = completion.tokensUsed;

        if (completion.toolCalls && completion.toolCalls.length > 0) {
          const call = completion.toolCalls[0];
          devStep.thought = completion.content || `Branch explores: ${call.name}`;
          devStep.action = call;
          devStep.status = 'executing';

          const result = await executeTool(call, run.id);
          devStep.observation = result;

          const childThought = result.success
            ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)).slice(0, 500)
            : `Error: ${result.error}`;

          branch.children.push({
            id: randomUUID(),
            parentId: branch.id,
            thought: childThought,
            score: 0,
            depth: depth + 1,
            children: [],
            isTerminal: false,
          });

          devStep.status = 'observing';
        } else {
          devStep.thought = completion.content;

          const answerMatch = completion.content.match(/FINAL ANSWER:\s*([\s\S]+)/i);
          if (answerMatch) {
            branch.answer = answerMatch[1].trim();
            branch.isTerminal = true;
            devStep.reflection = branch.answer;
            devStep.status = 'completed';
          } else {
            branch.children.push({
              id: randomUUID(),
              parentId: branch.id,
              thought: completion.content.slice(0, 500),
              score: 0,
              depth: depth + 1,
              children: [],
              isTerminal: false,
            });
            devStep.status = 'reflecting';
          }
        }

        devStep.updatedAt = new Date();
        steps.push(devStep);
        if (onStep) await onStep(devStep);
      }

      // Prune: evaluate and keep best branches
      if (depth < MAX_DEPTH - 1 && branches.filter((b) => !b.isTerminal).length > 1) {
        const evalResult = await this.evaluateBranches(ctx, branches.filter((b) => !b.isTerminal));
        tokensUsed += evalResult.tokensUsed;

        for (const branch of branches) {
          const evaluation = evalResult.scores.get(branch.id);
          if (evaluation !== undefined) branch.score = evaluation;
        }

        // Mark low-scoring branches as terminal (pruned)
        const sorted = [...branches].filter((b) => !b.isTerminal).sort((a, b) => b.score - a.score);
        for (let i = Math.ceil(sorted.length / 2); i < sorted.length; i++) {
          sorted[i].isTerminal = true;
        }
      }
    }

    // Step 3: Select best answer
    const answeredBranches = branches.filter((b) => b.answer);
    let finalAnswer: string;

    if (answeredBranches.length > 0) {
      const best = answeredBranches.sort((a, b) => b.score - a.score)[0];
      finalAnswer = best.answer!;
    } else {
      const best = branches.sort((a, b) => b.score - a.score)[0];
      const lastChild = best.children[best.children.length - 1];
      finalAnswer = lastChild?.thought || best.thought;
    }

    log.info({
      runId: run.id,
      branches: branches.length,
      answered: answeredBranches.length,
      steps: steps.length,
      tokensUsed,
    }, 'tree-of-thought complete');

    return {
      steps,
      finalAnswer,
      tokensUsed,
      strategyUsed: 'tree-of-thought',
      metadata: {
        branchCount: branches.length,
        answeredBranches: answeredBranches.length,
        maxDepthReached: Math.max(...branches.flatMap((b) => b.children.map((c) => c.depth)), 0),
      },
    };
  }

  private parseBranches(content: string): ThoughtBranch[] {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return [this.defaultBranch(content)];
    }

    try {
      const parsed = JSON.parse(match[0]) as { approaches?: unknown[] };
      if (!Array.isArray(parsed.approaches) || parsed.approaches.length === 0) {
        return [this.defaultBranch(content)];
      }

      return parsed.approaches.slice(0, MAX_BRANCHES).map((raw) => {
        const item = raw as Record<string, unknown>;
        return {
          id: randomUUID(),
          thought: String(item.description ?? item.reasoning ?? ''),
          score: 50,
          depth: 0,
          children: [],
          isTerminal: false,
        };
      });
    } catch {
      return [this.defaultBranch(content)];
    }
  }

  private defaultBranch(content: string): ThoughtBranch {
    return {
      id: randomUUID(),
      thought: content.slice(0, 500),
      score: 50,
      depth: 0,
      children: [],
      isTerminal: false,
    };
  }

  private async evaluateBranches(
    ctx: StrategyContext,
    branches: ThoughtBranch[],
  ): Promise<{ scores: Map<string, number>; tokensUsed: number }> {
    const scores = new Map<string, number>();

    const branchDescriptions = branches
      .map((b) => {
        const progress = b.children.map((c) => c.thought).join(' → ');
        return `Branch ${b.id}: ${b.thought}\n  Progress: ${progress || 'None'}`;
      })
      .join('\n\n');

    try {
      const completion = await ctx.llm.complete([
        { role: 'system', content: EVALUATE_PROMPT },
        { role: 'user', content: `Problem: ${ctx.run.prompt}\n\nBranches:\n${branchDescriptions}` },
      ], { temperature: 0 });

      const match = completion.content.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]) as { evaluations?: unknown[] };
        if (Array.isArray(parsed.evaluations)) {
          for (const item of parsed.evaluations) {
            const raw = item as Record<string, unknown>;
            const branchId = String(raw.branchId ?? '');
            const score = Number(raw.score) || 50;
            if (branches.some((b) => b.id === branchId)) {
              scores.set(branchId, Math.max(0, Math.min(100, score)));
            }
          }
        }
      }

      return { scores, tokensUsed: completion.tokensUsed };
    } catch {
      for (const b of branches) scores.set(b.id, 50);
      return { scores, tokensUsed: 0 };
    }
  }
}
