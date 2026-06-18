import { describe, it, expect } from 'vitest';
import { WorkingMemory } from './working-memory.js';
import { EpisodicMemory } from './episodic-memory.js';
import { SemanticMemory } from './semantic-memory.js';
import { ProceduralMemory } from './procedural-memory.js';
import { UserMemory } from './user-memory.js';
import type { MemoryEntry } from './types.js';

function makeEntry(id: string, content: string, importance = 0.5): MemoryEntry {
  return {
    id,
    content,
    type: 'working',
    importance,
    accessCount: 0,
    lastAccessed: new Date(),
    createdAt: new Date(),
  };
}

// ── Working Memory ──

describe('WorkingMemory', () => {
  it('stores and retrieves entries', async () => {
    const wm = new WorkingMemory();
    await wm.store(makeEntry('1', 'Current task: build API'));
    const results = await wm.retrieve('build API');
    expect(results.length).toBe(1);
    expect(results[0].content).toContain('build API');
  });

  it('manages goal and steps', () => {
    const wm = new WorkingMemory();
    wm.setGoal('Deploy to production');
    wm.addStep('Build Docker image');
    wm.addStep('Push to registry');
    expect(wm.getGoal()).toBe('Deploy to production');
    expect(wm.getSteps()).toEqual(['Build Docker image', 'Push to registry']);
  });

  it('tracks tool results', () => {
    const wm = new WorkingMemory();
    wm.addToolResult('brave_search', 'Found 10 results');
    wm.addToolResult('http_request', 'Status 200');
    expect(wm.getRecentToolResults().length).toBe(2);
  });

  it('generates context summary', () => {
    const wm = new WorkingMemory();
    wm.setGoal('Fix bug');
    wm.addStep('Read logs');
    wm.addToolResult('read_file', 'Error on line 42');
    const summary = wm.getContextSummary();
    expect(summary).toContain('Fix bug');
    expect(summary).toContain('Read logs');
  });

  it('evicts least important when full', async () => {
    const wm = new WorkingMemory();
    for (let i = 0; i < 25; i++) {
      await wm.store(makeEntry(`e${i}`, `Entry ${i}`, i / 25));
    }
    expect(wm.size()).toBeLessThanOrEqual(20);
  });

  it('clears all state', () => {
    const wm = new WorkingMemory();
    wm.setGoal('test');
    wm.addStep('step');
    wm.clear();
    expect(wm.getGoal()).toBeUndefined();
    expect(wm.size()).toBe(0);
  });
});

// ── Episodic Memory ──

describe('EpisodicMemory', () => {
  it('records and retrieves episodes', () => {
    const em = new EpisodicMemory();
    em.recordEpisode({
      sessionId: 's1',
      prompt: 'Search for TypeScript tutorials',
      outcome: 'Found 5 relevant articles',
      success: true,
      toolsUsed: ['brave_search'],
      stepsCount: 2,
      tokensUsed: 500,
      duration: 3000,
      timestamp: new Date(),
    });

    const similar = em.findSimilarEpisodes('TypeScript tutorials');
    expect(similar.length).toBe(1);
    expect(similar[0].success).toBe(true);
  });

  it('filters successful episodes by tool', () => {
    const em = new EpisodicMemory();
    em.recordEpisode({
      sessionId: 's1', prompt: 'Search', outcome: 'OK', success: true,
      toolsUsed: ['brave_search'], stepsCount: 1, tokensUsed: 100, duration: 1000, timestamp: new Date(),
    });
    em.recordEpisode({
      sessionId: 's2', prompt: 'Write file', outcome: 'OK', success: true,
      toolsUsed: ['write_file'], stepsCount: 1, tokensUsed: 100, duration: 1000, timestamp: new Date(),
    });

    const searchEpisodes = em.getSuccessfulEpisodes('brave_search');
    expect(searchEpisodes.length).toBe(1);
  });

  it('tracks failed episodes', () => {
    const em = new EpisodicMemory();
    em.recordEpisode({
      sessionId: 's1', prompt: 'Deploy', outcome: 'Timeout', success: false,
      toolsUsed: ['execute_bash'], stepsCount: 3, tokensUsed: 200, duration: 5000, timestamp: new Date(),
    });

    expect(em.getFailedEpisodes().length).toBe(1);
  });
});

// ── Semantic Memory ──

describe('SemanticMemory', () => {
  it('stores and keyword-searches entries', async () => {
    const sm = new SemanticMemory();
    await sm.store(makeEntry('1', 'PostgreSQL is a relational database with ACID compliance'));
    await sm.store(makeEntry('2', 'Redis is an in-memory key-value store'));

    const results = await sm.retrieve('database relational');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain('PostgreSQL');
  });

  it('evicts least accessed when full', async () => {
    const sm = new SemanticMemory();
    for (let i = 0; i < 10; i++) {
      await sm.store(makeEntry(`e${i}`, `Concept ${i}`));
    }
    expect(sm.size()).toBe(10);
  });
});

// ── Procedural Memory ──

describe('ProceduralMemory', () => {
  it('learns and finds applicable procedures', () => {
    const pm = new ProceduralMemory();
    pm.learnProcedure({
      name: 'deploy-docker',
      description: 'Deploy application with Docker',
      steps: ['Build image', 'Push to registry', 'Update service'],
      applicableTo: ['deploy', 'docker', 'production'],
    });

    const applicable = pm.findApplicable('deploy to production');
    expect(applicable.length).toBe(1);
    expect(applicable[0].name).toBe('deploy-docker');
  });

  it('increments usage on re-learn', () => {
    const pm = new ProceduralMemory();
    pm.learnProcedure({
      name: 'test-run',
      description: 'Run tests',
      steps: ['Install deps', 'Run vitest'],
      applicableTo: ['test'],
    });
    pm.learnProcedure({
      name: 'test-run',
      description: 'Run tests',
      steps: ['Install deps', 'Run vitest'],
      applicableTo: ['test'],
    });

    const best = pm.getBestProcedures();
    expect(best[0].timesUsed).toBe(2);
  });

  it('tracks failure rate', () => {
    const pm = new ProceduralMemory();
    pm.learnProcedure({
      name: 'flaky-proc',
      description: 'Flaky procedure',
      steps: ['Try something'],
      applicableTo: ['test'],
    });
    pm.recordFailure('flaky-proc');

    const procs = pm.getBestProcedures();
    expect(procs[0].successRate).toBeLessThan(1);
  });
});

// ── User Memory ──

describe('UserMemory', () => {
  it('stores and retrieves preferences', () => {
    const um = new UserMemory();
    um.setPreference({ key: 'language', value: 'arabic', category: 'language', confidence: 0.9, updatedAt: new Date() });

    const pref = um.getPreference('language');
    expect(pref?.value).toBe('arabic');
  });

  it('groups preferences by category', () => {
    const um = new UserMemory();
    um.setPreference({ key: 'tone', value: 'casual', category: 'tone', confidence: 0.8, updatedAt: new Date() });
    um.setPreference({ key: 'language', value: 'arabic', category: 'language', confidence: 0.9, updatedAt: new Date() });

    const tonePrefs = um.getPreferencesByCategory('tone');
    expect(tonePrefs.length).toBe(1);
    expect(tonePrefs[0].value).toBe('casual');
  });

  it('infers preferences from Arabic message', () => {
    const um = new UserMemory();
    const inferred = um.inferPreferencesFromMessage('رد عليا بالعربي وباختصار');
    expect(inferred.some((p) => p.key === 'language' && p.value === 'arabic-egyptian')).toBe(true);
    expect(inferred.some((p) => p.key === 'response_length' && p.value === 'short')).toBe(true);
  });

  it('builds context string', () => {
    const um = new UserMemory();
    um.setPreference({ key: 'tone', value: 'casual', category: 'tone', confidence: 0.8, updatedAt: new Date() });
    um.setPreference({ key: 'lang', value: 'arabic', category: 'language', confidence: 0.9, updatedAt: new Date() });

    const ctx = um.buildContextString();
    expect(ctx).toContain('[tone]');
    expect(ctx).toContain('[language]');
  });

  it('boosts confidence on repeated set', () => {
    const um = new UserMemory();
    um.setPreference({ key: 'tone', value: 'casual', category: 'tone', confidence: 0.5, updatedAt: new Date() });
    um.setPreference({ key: 'tone', value: 'casual', category: 'tone', confidence: 0.5, updatedAt: new Date() });

    const pref = um.getPreference('tone');
    expect(pref!.confidence).toBeGreaterThan(0.5);
  });
});
