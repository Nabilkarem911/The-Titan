import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { AgentStep, LlmMessage, ToolResult } from '../types.js';
import type { ReasoningStrategy, StrategyContext, StrategyResult } from './types.js';

const log = getLogger().child({ component: 'strategy-cot' });

const COT_SYSTEM = `You are a methodical problem solver. Think through the problem step by step.

For each reasoning step:
1. State what you know so far
2. Identify what you need to figure out next
3. Reason through it carefully
4. State your conclusion for this step

After all reasoning, provide your final answer prefixed with "FINAL ANSWER:".

If you need to use a tool at any step, call it — but always explain your reasoning before and after.`;

export class ChainOfThoughtStrategy implements ReasoningStrategy {
  name = 'chain-of-thought' as const;

  async execute(ctx: StrategyContext): Promise<StrategyResult> {
    const { run, llm, tools, executeTool, onStep } = ctx;
    const steps: AgentStep[] = [];
    let tokensUsed = 0;
    let finalAnswer: string | undefined;

    const messages: LlmMessage[] = [
      { role: 'system', content: this.buildPrompt(ctx) },
      { role: 'user', content: run.prompt },
    ];

    for (let i = 0; i < run.maxSteps; i++) {
      const step: AgentStep = {
        id: randomUUID(),
        runId: run.id,
        index: i + 1,
        status: 'planning',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const completion = await llm.complete(messages, { tools, temperature: 0.2 });
      tokensUsed += completion.tokensUsed;
      step.tokensUsed = completion.tokensUsed;

      if (completion.toolCalls && completion.toolCalls.length > 0) {
        step.thought = completion.content || `Reasoning requires: ${completion.toolCalls.map((c) => c.name).join(', ')}`;
        step.action = completion.toolCalls[0];
        step.status = 'executing';

        messages.push({
          role: 'assistant',
          content: step.thought,
          toolCalls: completion.toolCalls,
        });

        let lastResult: ToolResult | undefined;
        for (const call of completion.toolCalls) {
          const result = await executeTool(call, run.id);
          lastResult = result;
          messages.push({
            role: 'tool',
            content: result.success
              ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)).slice(0, 4000)
              : `Error: ${result.error}`,
            toolResult: result,
          });
        }
        step.observation = lastResult;

        step.status = 'observing';
      } else {
        step.thought = completion.content;
        messages.push({ role: 'assistant', content: completion.content });

        const answerMatch = completion.content.match(/FINAL ANSWER:\s*([\s\S]+)/i);
        if (answerMatch) {
          finalAnswer = answerMatch[1].trim();
          step.status = 'completed';
          step.reflection = finalAnswer;
          steps.push(step);
          if (onStep) await onStep(step);
          break;
        }

        step.status = 'reflecting';
      }

      step.updatedAt = new Date();
      steps.push(step);
      if (onStep) await onStep(step);
    }

    if (!finalAnswer && steps.length > 0) {
      const lastStep = steps[steps.length - 1];
      finalAnswer = lastStep.reflection || lastStep.thought || 'Reasoning incomplete';
    }

    log.info({ runId: run.id, steps: steps.length, tokensUsed }, 'chain-of-thought complete');
    return { steps, finalAnswer, tokensUsed, strategyUsed: 'chain-of-thought' };
  }

  private buildPrompt(ctx: StrategyContext): string {
    const parts = [ctx.systemPrompt || COT_SYSTEM];
    if (ctx.memoryItems?.length) {
      parts.push(`\n--- Relevant context ---\n${ctx.memoryItems.join('\n')}`);
    }
    parts.push('\nThink step by step. Explain your reasoning at each step before acting.');
    return parts.join('\n');
  }
}
