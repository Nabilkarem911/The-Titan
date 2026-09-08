import type { LlmProvider, AgentStep, LlmToolDefinition } from '../types.js';
import type { RetryStrategy, ErrorAnalysis } from './types.js';
import { ErrorAnalyzer } from './error-analyzer.js';

const MAX_RETRIES_PER_STEP = 2;

export class RetryStrategist {
  private errorAnalyzer: ErrorAnalyzer;

  constructor(private llm: LlmProvider) {
    this.errorAnalyzer = new ErrorAnalyzer(llm);
  }

  async decide(
    failedStep: AgentStep,
    prompt: string,
    attemptsSoFar: number,
    availableTools?: LlmToolDefinition[],
  ): Promise<RetryStrategy> {
    if (attemptsSoFar >= MAX_RETRIES_PER_STEP) {
      return { shouldRetry: false, method: 'skip', maxAdditionalRetries: 0 };
    }

    const analysis = await this.errorAnalyzer.analyze(failedStep, prompt);

    if (!analysis.retryable) {
      return this.handleNonRetryable(analysis, failedStep, availableTools);
    }

    return this.buildStrategy(analysis, failedStep, attemptsSoFar, availableTools);
  }

  private handleNonRetryable(
    analysis: ErrorAnalysis,
    step: AgentStep,
    tools?: LlmToolDefinition[],
  ): RetryStrategy {
    if (analysis.errorType === 'tool_failure' && step.action && tools) {
      const alternative = this.findAlternativeTool(step.action.name, tools);
      if (alternative) {
        return {
          shouldRetry: true,
          method: 'alternative_tool',
          alternativeTool: alternative,
          maxAdditionalRetries: 1,
        };
      }
    }

    if (analysis.errorType === 'context_missing') {
      return {
        shouldRetry: true,
        method: 'rephrase',
        adjustedPrompt: analysis.suggestedFix,
        maxAdditionalRetries: 1,
      };
    }

    return { shouldRetry: false, method: 'skip', maxAdditionalRetries: 0 };
  }

  private buildStrategy(
    analysis: ErrorAnalysis,
    step: AgentStep,
    attempts: number,
    tools?: LlmToolDefinition[],
  ): RetryStrategy {
    switch (analysis.errorType) {
      case 'timeout':
        return {
          shouldRetry: true,
          method: 'same_tool',
          maxAdditionalRetries: 1,
        };

      case 'tool_failure': {
        if (attempts === 0 && analysis.adjustedParams) {
          return {
            shouldRetry: true,
            method: 'same_tool',
            maxAdditionalRetries: 1,
          };
        }
        const alt = step.action && tools ? this.findAlternativeTool(step.action.name, tools) : undefined;
        if (alt) {
          return {
            shouldRetry: true,
            method: 'alternative_tool',
            alternativeTool: alt,
            maxAdditionalRetries: 1,
          };
        }
        return {
          shouldRetry: true,
          method: 'rephrase',
          adjustedPrompt: analysis.suggestedFix,
          maxAdditionalRetries: 1,
        };
      }

      case 'reasoning_error':
        return {
          shouldRetry: true,
          method: 'decompose',
          adjustedPrompt: `Break this into smaller steps: ${analysis.suggestedFix}`,
          maxAdditionalRetries: 1,
        };

      case 'context_missing':
        return {
          shouldRetry: true,
          method: 'rephrase',
          adjustedPrompt: analysis.suggestedFix,
          maxAdditionalRetries: 1,
        };

      default:
        return {
          shouldRetry: attempts < 1,
          method: 'same_tool',
          maxAdditionalRetries: 1,
        };
    }
  }

  private findAlternativeTool(failedTool: string, tools: LlmToolDefinition[]): string | undefined {
    const TOOL_ALTERNATIVES: Record<string, string[]> = {
      brave_search: ['http_request', 'firecrawl_scrape'],
      firecrawl_scrape: ['http_request', 'brave_search'],
      http_request: ['firecrawl_scrape'],
      execute_bash: ['docker_manage'],
      write_file: ['patch_file'],
      patch_file: ['write_file'],
      database_query: ['http_request'],
    };

    const alternatives = TOOL_ALTERNATIVES[failedTool] ?? [];
    const available = new Set(tools.map((t) => t.name));

    return alternatives.find((alt) => available.has(alt));
  }
}
