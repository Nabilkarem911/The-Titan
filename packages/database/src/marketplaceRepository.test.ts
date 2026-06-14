import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { getPool, closePool } from './client.js';
import { plugins, pluginRatings, pluginSearch } from './pluginRepository.js';

describe('Plugin Marketplace Repository', () => {
  beforeAll(async () => {
    const pool = getPool();
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plugins (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        author TEXT,
        source TEXT NOT NULL DEFAULT 'local',
        status TEXT NOT NULL DEFAULT 'disabled',
        tags TEXT[],
        capabilities TEXT[],
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plugin_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
        version TEXT NOT NULL,
        manifest JSONB NOT NULL DEFAULT '{}',
        entrypoint TEXT,
        checksum TEXT NOT NULL,
        signature TEXT,
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (plugin_id, version)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plugin_ratings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
        user_id UUID,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        review TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (plugin_id, user_id)
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS plugin_installs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
        workspace_id UUID,
        version TEXT,
        installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query(`DELETE FROM plugin_ratings WHERE plugin_id IN (SELECT id FROM plugins WHERE name LIKE 'mkt-%')`);
    await pool.query(`DELETE FROM plugin_installs WHERE plugin_id IN (SELECT id FROM plugins WHERE name LIKE 'mkt-%')`);
    await pool.query(`DELETE FROM plugin_versions WHERE plugin_id IN (SELECT id FROM plugins WHERE name LIKE 'mkt-%')`);
    await pool.query(`DELETE FROM plugins WHERE name LIKE 'mkt-%'`);
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates and finds ratings', async () => {
    const p = await plugins.create({ name: 'mkt-rate-plugin', source: 'marketplace' });
    const r = await pluginRatings.create({ pluginId: p.id, rating: 5, review: 'Excellent' });
    expect(r.rating).toBe(5);
    expect(r.review).toBe('Excellent');

    const all = await pluginRatings.findByPlugin(p.id);
    expect(all).toHaveLength(1);
  });

  it('calculates average rating', async () => {
    const p = await plugins.create({ name: 'mkt-avg-plugin', source: 'marketplace' });
    await pluginRatings.create({ pluginId: p.id, rating: 4 });
    await pluginRatings.create({ pluginId: p.id, rating: 5 });

    const avg = await pluginRatings.averageRating(p.id);
    expect(avg).toBeCloseTo(4.5);
  });

  it('upserts rating for same user', async () => {
    const p = await plugins.create({ name: 'mkt-upsert-plugin', source: 'marketplace' });
    await pluginRatings.create({ pluginId: p.id, userId: '550e8400-e29b-41d4-a716-446655440001', rating: 3 });
    const updated = await pluginRatings.create({ pluginId: p.id, userId: '550e8400-e29b-41d4-a716-446655440001', rating: 5 });

    expect(updated.rating).toBe(5);
    const all = await pluginRatings.findByPlugin(p.id);
    expect(all).toHaveLength(1);
  });

  it('searches plugins by name', async () => {
    await plugins.create({ name: 'mkt-search-alpha', description: 'Alpha plugin', source: 'marketplace' });
    await plugins.create({ name: 'mkt-search-beta', description: 'Beta plugin', source: 'marketplace' });

    const result = await pluginSearch.search({ query: 'alpha' });
    const names = result.items.map((i) => i.name);
    expect(names).toContain('mkt-search-alpha');
  });

  it('searches plugins by tag', async () => {
    await plugins.create({ name: 'mkt-tagged-plugin', tags: ['ai', 'search'], source: 'marketplace' });
    await plugins.create({ name: 'mkt-other-plugin', tags: ['db'], source: 'marketplace' });

    const result = await pluginSearch.search({ tag: 'ai' });
    const names = result.items.map((i) => i.name);
    expect(names).toContain('mkt-tagged-plugin');
  });

  it('searches plugins by capability', async () => {
    await plugins.create({ name: 'mkt-cap-plugin', capabilities: ['read', 'write'], source: 'marketplace' });
    await plugins.create({ name: 'mkt-no-cap', source: 'marketplace' });

    const result = await pluginSearch.search({ capability: 'write' });
    const names = result.items.map((i) => i.name);
    expect(names).toContain('mkt-cap-plugin');
  });

  it('searches plugins by source', async () => {
    await plugins.create({ name: 'mkt-market-plugin', source: 'marketplace' });
    await plugins.create({ name: 'mkt-local-plugin', source: 'local' });

    const result = await pluginSearch.search({ source: 'marketplace' });
    const names = result.items.map((i) => i.name);
    expect(names).toContain('mkt-market-plugin');
  });
});
