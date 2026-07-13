import type { LlmProvider } from '../types.js';
import type { WiredCapabilities } from '../capability-wiring.js';
import { registerCoreTools } from './core-tools.js';
import { registerReasoningTools } from './reasoning-tools.js';
import { registerMetacognitionTools } from './metacognition-tools.js';
import { registerLearningTools } from './learning-tools.js';
import { registerMirrorTools } from './mirror-tools.js';
import { registerCosmicTools } from './cosmic-tools.js';
import { registerIntegrationTools } from './integration-tools.js';

export function registerAllCapabilityTools(wiring: WiredCapabilities, llm: LlmProvider): void {
  registerCoreTools(wiring, llm);
  registerReasoningTools(wiring, llm);
  registerMetacognitionTools(wiring, llm);
  registerLearningTools(wiring, llm);
  registerMirrorTools(wiring, llm);
  registerCosmicTools(wiring, llm);
  registerIntegrationTools(wiring, llm);
}
