import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { AgentStep } from '../types.js';
import type { ReasoningStrategy, StrategyContext, StrategyResult, DebateRound, DebatePerspective } from './types.js';

const log = getLogger().child({ component: 'strategy-debate' });

const MAX_ROUNDS = 3;

const PERSPECTIVE_PROMPT = `You are debating a question from the perspective of: {role}

Your position: Argue {direction} for the given question/task.
Be specific, cite evidence from tool results if available, and be honest about weaknesses in your position.

Respond with a structured argument (2-3 key points). End with a confidence score (0-100).`;

const JUDGE_PROMPT = `You are an impartial judge evaluating a debate between different perspectives on a question.

Review each perspective's arguments, then:
1. Identify the strongest arguments from each side
2. Note any factual errors or logical fallacies
3. Synthesize the best elements into a balanced final answer

Respond ONLY with JSON:
{
  "consensus": "The balanced final answer combining the best arguments",
  "winner": "role_name or 'synthesis'",
  "reasoning": "Why this conclusion is strongest"
}`;

const PERSPECTIVES: Array<{ role: string; direction: string }> = [
  { role: 'advocate', direction: 'in favor of the most straightforward solution' },
  { role: 'critic', direction: 'highlighting risks, edge cases, and potential problems' },
  { role: 'innovator', direction: 'for creative or unconventional approaches' },
];

export class DebateStrategy implements ReasoningStrategy {
  name = 'debate' as const;

  async execute(ctx: StrategyContext): Promise<StrategyResult> {
    const { run, llm, tools, executeTool, onStep } = ctx;
    const steps: AgentStep[] = [];
    let tokensUsed = 0;
    const rounds: DebateRound[] = [];

    // Optional: gather evidence first if tools available
    let evidence = '';
    if (tools.length > 0) {
      const gatherStep: AgentStep = {
        id: randomUUID(),
        runId: run.id,
        index: 1,
        status: 'planning',
        thought: 'Gathering evidence before debate...',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const gatherCompletion = await llm.complete([
        { role: 'system', content: ctx.systemPrompt || 'You are a research assistant.' },
        { role: 'user', content: `I need to gather information to answer: ${run.prompt}\n\nUse a tool if it would help gather relevant facts.` },
      ], { tools, temperature: 0.3 });

      tokensUsed += gatherCompletion.tokensUsed;
      gatherStep.tokensUsed = gatherCompletion.tokensUsed;

      if (gatherCompletion.toolCalls && gatherCompletion.toolCalls.length > 0) {
        const call = gatherCompletion.toolCalls[0];
        gatherStep.action = call;
        gatherStep.status = 'executing';

        const result = await executeTool(call, run.id);
        gatherStep.observation = result;

        if (result.success && result.data) {
          evidence = typeof result.data === 'string' ? result.data : JSON.stringify(result.data);
          evidence = evidence.slice(0, 3000);
        }

        gatherStep.status = 'completed';
      } else {
        gatherStep.thought = gatherCompletion.content;
        gatherStep.status = 'completed';
      }

      gatherStep.updatedAt = new Date();
      steps.push(gatherStep);
      if (onStep) await onStep(gatherStep);
    }

    // Debate rounds
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const debateRound: DebateRound = { roundNumber: round + 1, perspectives: [] };
      const previousArgs = rounds.length > 0
        ? rounds[rounds.length - 1].perspectives.map((p) => `[${p.role}] ${p.arguments.join('; ')}`).join('\n')
        : '';

      for (const perspective of PERSPECTIVES) {
        const debateStep: AgentStep = {
          id: randomUUID(),
          runId: run.id,
          index: steps.length + 1,
          status: 'planning',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        const prompt = PERSPECTIVE_PROMPT
          .replace('{role}', perspective.role)
          .replace('{direction}', perspective.direction);

        const userContent = [
          `Question: ${run.prompt}`,
          evidence ? `\nEvidence gathered:\n${evidence}` : '',
          previousArgs ? `\nPrevious round arguments:\n${previousArgs}` : '',
          round > 0 ? '\nAddress counter-arguments from the previous round.' : '',
        ].filter(Boolean).join('\n');

        const completion = await llm.complete([
          { role: 'system', content: prompt },
          { role: 'user', content: userContent },
        ], { temperature: 0.6 });

        tokensUsed += completion.tokensUsed;
        debateStep.tokensUsed = completion.tokensUsed;
        debateStep.thought = `[${perspective.role}] ${completion.content.slice(0, 500)}`;

        const confidenceMatch = completion.content.match(/confidence[:\s]*(\d+)/i);
        const perspectiveResult: DebatePerspective = {
          role: perspective.role,
          position: perspective.direction,
          arguments: [completion.content],
          confidence: confidenceMatch ? Number(confidenceMatch[1]) : 50,
        };

        debateRound.perspectives.push(perspectiveResult);
        debateStep.status = 'completed';
        debateStep.updatedAt = new Date();
        steps.push(debateStep);
        if (onStep) await onStep(debateStep);
      }

      rounds.push(debateRound);

      // Check for early consensus (all perspectives agree)
      const confidences = debateRound.perspectives.map((p) => p.confidence);
      if (confidences.every((c) => c > 80)) {
        log.info({ runId: run.id, round: round + 1 }, 'early consensus reached');
        break;
      }
    }

    // Final: Judge synthesizes
    const judgeStep: AgentStep = {
      id: randomUUID(),
      runId: run.id,
      index: steps.length + 1,
      status: 'planning',
      thought: 'Synthesizing debate results...',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const allArguments = rounds
      .map((r) =>
        r.perspectives
          .map((p) => `[${p.role}] (confidence: ${p.confidence}%) ${p.arguments.join('\n')}`)
          .join('\n\n'),
      )
      .join('\n\n--- Next Round ---\n\n');

    const judgeCompletion = await llm.complete([
      { role: 'system', content: JUDGE_PROMPT },
      { role: 'user', content: `Question: ${run.prompt}\n\n${evidence ? `Evidence:\n${evidence}\n\n` : ''}Debate:\n${allArguments}` },
    ], { temperature: 0.1 });

    tokensUsed += judgeCompletion.tokensUsed;
    judgeStep.tokensUsed = judgeCompletion.tokensUsed;

    const finalAnswer = this.parseJudgement(judgeCompletion.content);
    judgeStep.reflection = finalAnswer;
    judgeStep.status = 'completed';
    judgeStep.updatedAt = new Date();
    steps.push(judgeStep);
    if (onStep) await onStep(judgeStep);

    log.info({ runId: run.id, rounds: rounds.length, steps: steps.length, tokensUsed }, 'debate complete');

    return {
      steps,
      finalAnswer,
      tokensUsed,
      strategyUsed: 'debate',
      metadata: { rounds: rounds.length, perspectives: PERSPECTIVES.map((p) => p.role) },
    };
  }

  private parseJudgement(content: string): string {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) return content;

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      return String(parsed.consensus ?? content);
    } catch {
      return content;
    }
  }
}
