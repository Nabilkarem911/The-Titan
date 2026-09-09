import { PreferenceLearner, PersonaAdapter, UserProfileBuilder } from '@titan/memory';
import { userContext } from '@titan/database';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'preference-singleton' });

let globalPreferenceLearner: PreferenceLearner | null = null;
let globalPersonaAdapter: PersonaAdapter | null = null;
let globalProfileBuilder: UserProfileBuilder | null = null;

// Users whose identity has been hydrated from DB this process lifetime
const hydratedUsers = new Set<string>();
// Debounce: users with pending persistence writes
const pendingPersist = new Set<string>();

const CTX_KEY_PROFILE = '_identity_profile_json';
const CTX_KEY_PREFS = '_identity_preferences_json';

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

/**
 * Hydrate identity from DB once per process per user.
 * Survives core restarts — this is what makes Titan "remember" you.
 */
async function ensureHydrated(userId: string): Promise<void> {
  if (hydratedUsers.has(userId)) return;
  hydratedUsers.add(userId);
  try {
    const [profileJson, prefsJson] = await Promise.all([
      userContext.get(userId, CTX_KEY_PROFILE),
      userContext.get(userId, CTX_KEY_PREFS),
    ]);
    const builder = getProfileBuilder();
    const learner = getPreferenceLearner();
    if (profileJson) builder.hydrate(userId, profileJson);
    if (prefsJson) {
      try {
        learner.hydrate(userId, JSON.parse(prefsJson));
      } catch {
        // corrupted prefs — ignore
      }
    }
    log.debug({ userId }, 'identity hydrated from DB');
  } catch (err) {
    log.warn({ err, userId }, 'identity hydration failed; starting fresh');
  }
}

/** Fire-and-forget persistence of identity snapshot to DB. */
function persistIdentity(userId: string): void {
  if (pendingPersist.has(userId)) return;
  pendingPersist.add(userId);
  // Debounce 2s so bursts of interactions coalesce into one write
  setTimeout(() => {
    pendingPersist.delete(userId);
    void (async () => {
      try {
        const builder = getProfileBuilder();
        const learner = getPreferenceLearner();
        const profileJson = builder.serialize(userId);
        const prefsJson = JSON.stringify(learner.serialize(userId));
        if (profileJson) await userContext.set(userId, CTX_KEY_PROFILE, profileJson);
        if (prefsJson && prefsJson !== '[]') await userContext.set(userId, CTX_KEY_PREFS, prefsJson);
        log.debug({ userId }, 'identity persisted to DB');
      } catch (err) {
        log.warn({ err, userId }, 'identity persistence failed');
      }
    })();
  }, 2000);
}

export async function getLearnedPreferences(userId: string): Promise<string> {
  await ensureHydrated(userId);
  const learner = getPreferenceLearner();
  const builder = getProfileBuilder();
  const profileStr = builder.getContextString(userId);
  const prefStr = learner.toContextString(userId);
  return [profileStr, prefStr].filter(Boolean).join('\n');
}

export async function recordUserInteraction(userId: string, messages: string[]): Promise<void> {
  await ensureHydrated(userId);
  const learner = getPreferenceLearner();
  const builder = getProfileBuilder();
  learner.learn(userId, messages);
  for (const msg of messages) {
    builder.recordInteraction(userId, msg);
  }
  persistIdentity(userId);
}

export async function getPersonaInstructionsForUser(userId: string): Promise<string> {
  await ensureHydrated(userId);
  const builder = getProfileBuilder();
  const adapter = getPersonaAdapter();
  const profile = builder.getOrCreate(userId);
  const persona = adapter.adaptToUser(profile);
  return adapter.toPromptInstructions(persona);
}
