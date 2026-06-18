import { describe, it, expect, vi } from 'vitest';
import { EntityExtractor } from './entity-extractor.js';
import { GraphStore } from './graph-store.js';

// ── Entity Extractor ──

describe('EntityExtractor', () => {
  it('extracts tools from text', async () => {
    const extractor = new EntityExtractor();
    const result = await extractor.extract('Used brave_search to find info and http_request to call API');

    expect(result.entities.some((e) => e.name === 'brave_search')).toBe(true);
    expect(result.entities.some((e) => e.name === 'http_request')).toBe(true);
  });

  it('extracts services from text', async () => {
    const extractor = new EntityExtractor();
    const result = await extractor.extract('Connected to PostgreSQL and Redis for caching');

    expect(result.entities.some((e) => e.name === 'postgresql' || e.name === 'postgres')).toBe(true);
    expect(result.entities.some((e) => e.name === 'redis')).toBe(true);
  });

  it('deduplicates entities', async () => {
    const extractor = new EntityExtractor();
    const result = await extractor.extract('docker docker Docker DOCKER container');

    const dockerEntities = result.entities.filter((e) => e.name === 'docker');
    expect(dockerEntities.length).toBe(1);
  });

  it('uses LLM when available', async () => {
    const llm = {
      complete: vi.fn().mockResolvedValue({
        content: JSON.stringify({
          entities: [
            { name: 'titan', type: 'project' },
            { name: 'fastify', type: 'service' },
          ],
          relations: [
            { source: 'titan', target: 'fastify', type: 'uses' },
          ],
        }),
      }),
    };

    const extractor = new EntityExtractor(llm);
    const result = await extractor.extract('Titan uses Fastify for HTTP and PostgreSQL for storage');

    expect(result.entities.some((e) => e.name === 'titan')).toBe(true);
    expect(result.relations.length).toBeGreaterThan(0);
  });
});

// ── Graph Store ──

describe('GraphStore', () => {
  it('adds and retrieves entities', () => {
    const store = new GraphStore();
    store.addEntity('PostgreSQL', 'service');
    const entity = store.getEntity('postgresql');
    expect(entity).toBeDefined();
    expect(entity!.type).toBe('service');
  });

  it('normalizes entity names to lowercase', () => {
    const store = new GraphStore();
    store.addEntity('Docker', 'service');
    expect(store.getEntity('docker')).toBeDefined();
    expect(store.getEntity('Docker')).toBeDefined();
  });

  it('increments mention count on duplicate add', () => {
    const store = new GraphStore();
    store.addEntity('Redis', 'service');
    store.addEntity('Redis', 'service');
    store.addEntity('redis', 'service');

    const entity = store.getEntity('redis');
    expect(entity!.mentionCount).toBe(3);
  });

  it('adds relations between entities', () => {
    const store = new GraphStore();
    store.addEntity('Titan', 'project');
    store.addEntity('PostgreSQL', 'service');
    const rel = store.addRelation('Titan', 'PostgreSQL', 'uses');

    expect(rel).not.toBeNull();
    expect(rel!.type).toBe('uses');
  });

  it('returns null for relation with missing entity', () => {
    const store = new GraphStore();
    store.addEntity('Titan', 'project');
    const rel = store.addRelation('Titan', 'Nonexistent', 'uses');
    expect(rel).toBeNull();
  });

  it('increments weight on duplicate relation', () => {
    const store = new GraphStore();
    store.addEntity('Titan', 'project');
    store.addEntity('Redis', 'service');
    store.addRelation('Titan', 'Redis', 'uses');
    store.addRelation('Titan', 'Redis', 'uses');

    const relations = store.getRelations('titan');
    expect(relations[0].weight).toBe(2);
  });

  it('finds related entities', () => {
    const store = new GraphStore();
    store.addEntity('Titan', 'project');
    store.addEntity('PostgreSQL', 'service');
    store.addEntity('Redis', 'service');
    store.addRelation('Titan', 'PostgreSQL', 'uses');
    store.addRelation('Titan', 'Redis', 'uses');

    const related = store.getRelatedEntities('titan');
    expect(related.length).toBe(2);
  });

  it('filters related entities by relation type', () => {
    const store = new GraphStore();
    store.addEntity('Titan', 'project');
    store.addEntity('PostgreSQL', 'service');
    store.addEntity('User', 'person');
    store.addRelation('Titan', 'PostgreSQL', 'uses');
    store.addRelation('Titan', 'User', 'created_by');

    const uses = store.getRelatedEntities('titan', 'uses');
    expect(uses.length).toBe(1);
    expect(uses[0].name).toBe('postgresql');
  });

  it('queries subgraph', () => {
    const store = new GraphStore();
    store.addEntity('Titan', 'project');
    store.addEntity('PostgreSQL', 'service');
    store.addEntity('Redis', 'service');
    store.addRelation('Titan', 'PostgreSQL', 'uses');

    const result = store.query(['titan']);
    expect(result.entities.length).toBe(2); // titan + postgresql
    expect(result.relations.length).toBe(1);
  });

  it('searches entities by name', () => {
    const store = new GraphStore();
    store.addEntity('PostgreSQL', 'service');
    store.addEntity('PostHog', 'service');
    store.addEntity('Redis', 'service');

    const results = store.searchEntities('post');
    expect(results.length).toBe(2);
  });

  it('removes entity and connected relations', () => {
    const store = new GraphStore();
    store.addEntity('A', 'service');
    store.addEntity('B', 'service');
    store.addRelation('A', 'B', 'uses');
    store.removeEntity('A');

    expect(store.getEntity('a')).toBeUndefined();
    expect(store.getRelations('b').length).toBe(0);
  });

  it('reports stats', () => {
    const store = new GraphStore();
    store.addEntity('A', 'service');
    store.addEntity('B', 'service');
    store.addRelation('A', 'B', 'uses');

    const stats = store.stats();
    expect(stats.entities).toBe(2);
    expect(stats.relations).toBe(1);
  });
});
