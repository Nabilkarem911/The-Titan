import { PreferenceLearner, PersonaAdapter, UserProfileBuilder } from '@titan/memory';

let globalPreferenceLearner: PreferenceLearner | null = null;
let globalPersonaAdapter: PersonaAdapter | null = null;
let globalProfileBuilder: UserProfileBuilder | null = null;

export function getPreferenceLearner(): PreferenceLearner {
  if (!globalPreferenceLearner) globalPreferenceLearner = new PreferenceLearner();
  return globalPreferenceLearner;
}

export function getPersonaAdapter(): PersonaAdapter {
  if (!globalPersonaAdapter) globalPersonaAdapter = new PersonaAdapter();
  return globalPersonaAdapter;
}

export function getProfileBuilder(): UserProfileBuilder {
  if (!globalProfileBuilder) globalProfileBuilder = new UserProfileBuilder();
  return globalProfileBuilder;
}

export function getLearnedPreferences(userId: string): string {
  const learner = getPreferenceLearner();
  const builder = getProfileBuilder();
  const profileStr = builder.getContextString(userId);
  const prefStr = learner.toContextString(userId);
  return [profileStr, prefStr].filter(Boolean).join('\n');
}

export function recordUserInteraction(userId: string, messages: string[]): void {
  const learner = getPreferenceLearner();
  const builder = getProfileBuilder();
  learner.learn(userId, messages);
  for (const msg of messages) {
    builder.recordInteraction(userId, msg);
  }
}

export function getPersonaInstructionsForUser(userId: string): string {
  const builder = getProfileBuilder();
  const adapter = getPersonaAdapter();
  const profile = builder.getOrCreate(userId);
  const persona = adapter.adaptToUser(profile);
  return adapter.toPromptInstructions(persona);
}
