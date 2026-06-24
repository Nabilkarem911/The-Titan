import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { AgentStep, LlmMessage, ToolCall, ToolResult } from '../types.js';
import type { ReasoningStrategy, StrategyContext, StrategyResult } from './types.js';

const log = getLogger().child({ component: 'strategy-hypothesis' });

const HYPOTHESIS_SYSTEM = `You are a systematic debugger. When investigating a problem, follow this cycle:

1. HYPOTHESIS: State a specific, testable hypothesis about what's causing the issue.
2. TEST: Use a tool (or reasoning) to verify or refute the hypothesis.
3. OBSERVE: Analyze the result — does it confirm or refute the hypothesis?
4. CONCLUDE: If confirmed → propose a fix. If refuted → form a new hypothesis.

Always state your hypothesis explicitly before testing. Be methodical, not random.

After resolving the issue, provide your final answer prefixed with "FINAL ANSWER:".`;

export class HypothesisTestingStrategy implements ReasoningStrategy {
  name = 'hypothesis-testing' as const;

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
        step.thought = completion.content || `Testing hypothesis: ${completion.toolCalls.map((c) => c.name).join(', ')}`;
        step.action = completion.toolCalls[0];
        step.status = 'executing';

        messages.push({
          role: 'assistant',
          content: step.thought,
          toolCalls: completion.toolCalls,
        });

        step.observation = await this.executeToolCalls(completion.toolCalls, executeTool, run.id, messages);
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
      finalAnswer = lastStep.reflection || lastStep.thought || 'Investigation incomplete — could not identify root cause.';
    }

    log.info({ runId: run.id, steps: steps.length, tokensUsed }, 'hypothesis-testing complete');
    return { steps, finalAnswer, tokensUsed, strategyUsed: 'hypothesis-testing' };
  }

  private buildPrompt(ctx: StrategyContext): string {
    const parts = [ctx.systemPrompt || HYPOTHESIS_SYSTEM];
    if (ctx.memoryItems?.length) {
      parts.push(`\n--- Relevant context ---\n${ctx.memoryItems.join('\n')}`);
    }
    parts.push('\nInvestigate systematically: state a hypothesis, test it, observe, conclude. Repeat until resolved.');
    return parts.join('\n');
  }

  private async executeToolCalls(
    calls: ToolCall[],
    executeTool: StrategyContext['executeTool'],
    runId: string,
    messages: LlmMessage[],
  ): Promise<ToolResult | undefined> {
    let lastResult: ToolResult | undefined;
    for (const call of calls) {
      const result = await executeTool(call, runId);
      lastResult = result;
      messages.push({
        role: 'tool',
        content: result.success
          ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)).slice(0, 4000)
          : `Error: ${result.error}`,
        toolResult: result,
      });
    }
    return lastResult;
  }
}
