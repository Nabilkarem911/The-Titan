import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { AgentStep, LlmMessage, LlmToolDefinition, ToolCall, ToolResult } from '../types.js';
import type { ReasoningStrategy, StrategyContext, StrategyResult } from './types.js';

const log = getLogger().child({ component: 'strategy-hypothesis' });

const HYPOTHESIS_SYSTEM = `You are a systematic debugger. When investigating a problem, follow this cycle:

1. HYPOTHESIS: State a specific, testable hypothesis about what's causing the issue.
2. TEST: Use a tool (or reasoning) to verify or refute the hypothesis.
3. OBSERVE: Analyze the result — does it confirm or refute the hypothesis?
4. CONCLUDE: If confirmed → propose a fix. If refuted → form a new hypothesis.

Always state your hypothesis explicitly before testing. Be methodical, not random.

IMPORTANT — User's code vs your code:
- If the user says "my codebase", "my API", "my code", "problem in my code" → that's the USER's code, NOT yours.
- Do NOT use execute_bash or desktop_execute to investigate the user's code — you cannot access their machine.
- Do NOT search /app — that's Titan's own code, not the user's.
- Ask the user to share the code or the exact error message.
- Only use read_file_content if the user explicitly attached a file or gave you a path to THEIR file.

After resolving the issue, provide your final answer prefixed with "FINAL ANSWER:".`;

const FORBIDDEN_TOOLS = new Set([
  'execute_bash',
  'desktop_execute',
  'desktop_screenshot',
  'desktop_clipboard',
  'write_file',
  'patch_file',
  'docker_manage',
  'database_query',
]);

const ALLOWED_TOOLS = new Set([
  'hypothesis_generate',
  'web_intelligence',
  'read_file_content',
  'read_file_ast',
  'brave_search',
  'brave_answers',
  'http_request',
  'firecrawl_scrape',
]);

function filterToolsForDebugging(tools: LlmToolDefinition[]): LlmToolDefinition[] {
  const filtered = tools.filter(t => !FORBIDDEN_TOOLS.has(t.name));
  // If allowed tools exist, prefer them; otherwise keep all non-forbidden
  const hasAllowed = filtered.some(t => ALLOWED_TOOLS.has(t.name));
  if (hasAllowed) {
    // Keep allowed tools + any tool that starts with 'read_' or 'get_' or 'list_'
    return filtered.filter(t =>
      ALLOWED_TOOLS.has(t.name) ||
      t.name.startsWith('read_') ||
      t.name.startsWith('get_') ||
      t.name.startsWith('list_') ||
      t.name.startsWith('recall'),
    );
  }
  return filtered;
}

function isUserCodeQuestion(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  const userCodeMarkers = [
    'my code', 'my codebase', 'my api', 'my app', 'my project',
    'my function', 'my component', 'my server', 'my endpoint',
    'كودي', 'الـ api بتاعتي', 'مشروعي', 'برنامجي', 'الـ function بتاعتي',
    'عندي codebase', 'عندي مشكلة في كود',
  ];
  return userCodeMarkers.some(m => lower.includes(m));
}

export class HypothesisTestingStrategy implements ReasoningStrategy {
  name = 'hypothesis-testing' as const;

  async execute(ctx: StrategyContext): Promise<StrategyResult> {
    const { run, llm, executeTool, onStep } = ctx;
    const steps: AgentStep[] = [];
    let tokensUsed = 0;
    let finalAnswer: string | undefined;

    // Filter tools — restrict dangerous/exec tools for user-code debugging
    const isUserCode = isUserCodeQuestion(run.prompt);
    let tools = isUserCode ? filterToolsForDebugging(ctx.tools) : ctx.tools;

    if (isUserCode) {
      log.info({ runId: run.id, toolCount: tools.length, originalCount: ctx.tools.length }, 'hypothesis-testing: filtered tools for user-code question');
    }

    const messages: LlmMessage[] = [
      { role: 'system', content: this.buildPrompt(ctx, isUserCode) },
      { role: 'user', content: run.prompt },
    ];

    for (let i = 0; i < run.maxSteps; i++) {
      // Apply context optimization before each LLM call
      if (ctx.contextOptimizer) {
        const compacted = ctx.contextOptimizer.compactHistory(messages, steps);
        if (compacted.compacted > 0) {
          messages.length = 0;
          messages.push(...compacted.messages);
        }
        const filtered = ctx.contextOptimizer.optimizeTools(tools, steps, run.prompt);
        tools = isUserCode ? filterToolsForDebugging(filtered.tools) : filtered.tools;
      }

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
        // Safety: block forbidden tools even if LLM tries to call them
        const safeCalls = completion.toolCalls.filter(c => !FORBIDDEN_TOOLS.has(c.name));
        if (safeCalls.length === 0) {
          step.thought = completion.content || 'Attempted to use a forbidden tool for user-code debugging.';
          step.status = 'failed';
          step.observation = {
            success: false,
            error: 'Cannot use execution tools (execute_bash, desktop_execute, etc.) to investigate user code. Ask the user to share the code or error message.',
          };
          messages.push({ role: 'assistant', content: step.thought });
          messages.push({ role: 'tool', content: 'Cannot use execution tools (execute_bash, desktop_execute, etc.) to investigate user code. Ask the user to share the code or error message.' });
          step.updatedAt = new Date();
          steps.push(step);
          if (onStep) await onStep(step);
          continue;
        }

        step.thought = completion.content || `Testing hypothesis: ${safeCalls.map((c) => c.name).join(', ')}`;
        step.action = safeCalls[0];
        step.status = 'executing';

        messages.push({
          role: 'assistant',
          content: step.thought,
          toolCalls: safeCalls,
        });

        step.observation = await this.executeToolCalls(safeCalls, executeTool, run.id, messages);
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

  private buildPrompt(ctx: StrategyContext, isUserCode: boolean): string {
    const parts = [ctx.systemPrompt || HYPOTHESIS_SYSTEM];
    if (ctx.memoryItems?.length) {
      parts.push(`\n--- Relevant context ---\n${ctx.memoryItems.join('\n')}`);
    }
    if (isUserCode) {
      parts.push(`
⚠️ CRITICAL — This is a question about the USER's code, not Titan's code.
- Do NOT use execute_bash, desktop_execute, or any execution tool.
- Do NOT search /app — that is Titan's own codebase, not the user's.
- You CANNOT access the user's machine or codebase directly.
- Ask the user to share: the relevant code snippet, the exact error message, or the file path.
- Only use read_file_content if the user explicitly provided a file path.
- Use hypothesis_generate to reason about possible causes.
- Use web_intelligence or brave_search to look up known issues with the error.`);
    } else {
      parts.push('\nInvestigate systematically: state a hypothesis, test it, observe, conclude. Repeat until resolved.');
    }
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
          ? (typeof result.data === 'string' ? result.data : JSON.stringify(result.data)).slice(0, 2000)
          : `Error: ${result.error}`,
        toolResult: result,
      });
    }
    return lastResult;
  }
}

