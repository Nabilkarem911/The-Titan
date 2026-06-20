import { ExperienceCollector, PromptOptimizer, FeedbackProcessor, StrategyTuner } from '@titan/agent-engine';

let globalExperienceCollector: ExperienceCollector | null = null;
let globalPromptOptimizer: PromptOptimizer | null = null;
let globalFeedbackProcessor: FeedbackProcessor | null = null;
let globalStrategyTuner: StrategyTuner | null = null;

export function getExperienceCollector(): ExperienceCollector {
  if (!globalExperienceCollector) globalExperienceCollector = new ExperienceCollector();
  return globalExperienceCollector;
}

export function getPromptOptimizer(): PromptOptimizer {
  if (!globalPromptOptimizer) globalPromptOptimizer = new PromptOptimizer();
  return globalPromptOptimizer;
}

export function getFeedbackProcessor(): FeedbackProcessor {
  if (!globalFeedbackProcessor) globalFeedbackProcessor = new FeedbackProcessor();
  return globalFeedbackProcessor;
}

export function getStrategyTuner(): StrategyTuner {
  if (!globalStrategyTuner) globalStrategyTuner = new StrategyTuner();
  return globalStrategyTuner;
}
