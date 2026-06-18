import { getLogger } from '@titan/logging';
import type { LlmProvider, AgentStep } from '../types.js';
import type { ErrorAnalysis } from './types.js';

const log = getLogger().child({ component: 'error-analyzer' });

const ANALYZE_PROMPT = `You are a debugging expert. A tool call or reasoning step has failed. Analyze the error and suggest a fix.

Respond ONLY with JSON:
{
  "errorType": "tool_failure|reasoning_error|context_missing|timeout|unknown",
  "rootCause": "Brief explanation of why it failed",
  "suggestedFix": "What to do differently",
  "retryable": true/false,
  "adjustedParams": { "key": "new_value" } or null
}`;

export class ErrorAnalyzer {
  constructor(private llm: LlmProvider) {}

  async analyze(step: AgentStep, prompt: string): Promise<ErrorAnalysis> {
    const quickResult = this.quickAnalyze(step);
    if (quickResult) return quickResult;

    try {
      const stepDescription = this.describeStep(step);

      const completion = await this.llm.complete([
        { role: 'system', content: ANALYZE_PROMPT },
        {
          role: 'user',
          content: `Original task: ${prompt}\n\nFailed step:\n${stepDescription}`,
        },
      ], { temperature: 0.1 });

      return this.parseAnalysis(completion.content);
    } catch (err) {
      log.warn({ stepId: step.id, err: err instanceof Error ? err.message : 'Unknown' }, 'LLM error analysis failed');
      return {
        errorType: 'unknown',
        rootCause: 'Could not determine root cause',
        suggestedFix: 'Retry with different approach',
        retryable: true,
      };
    }
  }

  private quickAnalyze(step: AgentStep): ErrorAnalysis | null {
    const error = step.observation?.error ?? '';

    if (error.includes('rate limit') || error.includes('429') || error.includes('too many requests')) {
      return {
        errorType: 'tool_failure',
        rootCause: 'Rate limit exceeded',
        suggestedFix: 'Wait and retry',
        retryable: true,
      };
    }

    if (error.includes('timeout') || error.includes('ETIMEDOUT') || error.includes('ECONNABORTED')) {
      return {
        errorType: 'timeout',
        rootCause: 'Operation timed out',
        suggestedFix: 'Retry with a simpler query or increase timeout',
        retryable: true,
      };
    }

    if (error.includes('not found') || error.includes('404') || error.includes('ENOENT')) {
      return {
        errorType: 'tool_failure',
        rootCause: 'Resource not found',
        suggestedFix: 'Verify the path/URL and try again',
        retryable: false,
      };
    }

    if (error.includes('permission') || error.includes('403') || error.includes('EACCES')) {
      return {
        errorType: 'tool_failure',
        rootCause: 'Permission denied',
        suggestedFix: 'Check credentials or use a different approach',
        retryable: false,
      };
    }

    if (error.includes('forbidden by rules')) {
      return {
        errorType: 'tool_failure',
        rootCause: 'Tool is forbidden by agent rules',
        suggestedFix: 'Use an alternative tool',
        retryable: false,
      };
    }

    return null;
  }

  private describeStep(step: AgentStep): string {
    const parts: string[] = [];
    if (step.thought) parts.push(`Thought: ${step.thought}`);
    if (step.action) {
      parts.push(`Tool: ${step.action.name}`);
      parts.push(`Params: ${JSON.stringify(step.action.params).slice(0, 500)}`);
    }
    if (step.observation) {
      parts.push(`Success: ${step.observation.success}`);
      if (step.observation.error) parts.push(`Error: ${step.observation.error}`);
      if (step.observation.data) {
        const data = typeof step.observation.data === 'string' ? step.observation.data : JSON.stringify(step.observation.data);
        parts.push(`Data: ${data.slice(0, 500)}`);
      }
    }
    return parts.join('\n');
  }

  private parseAnalysis(content: string): ErrorAnalysis {
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) {
      return {
        errorType: 'unknown',
        rootCause: 'Could not parse analysis',
        suggestedFix: 'Retry with different approach',
        retryable: true,
      };
    }

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const validTypes = ['tool_failure', 'reasoning_error', 'context_missing', 'timeout', 'unknown'];

      return {
        errorType: (validTypes.includes(String(parsed.errorType)) ? String(parsed.errorType) : 'unknown') as ErrorAnalysis['errorType'],
        rootCause: String(parsed.rootCause ?? 'Unknown'),
        suggestedFix: String(parsed.suggestedFix ?? 'Retry'),
        retryable: parsed.retryable !== false,
        adjustedParams: parsed.adjustedParams && typeof parsed.adjustedParams === 'object'
          ? (parsed.adjustedParams as Record<string, unknown>)
          : undefined,
      };
    } catch {
      return {
        errorType: 'unknown',
        rootCause: 'Could not parse analysis',
        suggestedFix: 'Retry with different approach',
        retryable: true,
      };
    }
  }
}
