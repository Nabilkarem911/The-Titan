import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { plugins, pluginVersions } from './pluginRepository.js';
import { getPool, closePool } from './client.js';

// Skip all tests if PostgreSQL is not available
const dbAvailable = await (async () => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!dbAvailable)('Plugin Repository', () => {
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
  });

  beforeEach(async () => {
    const pool = getPool();
    await pool.query(`DELETE FROM plugins WHERE name LIKE '%-test-%' OR name LIKE 'test-%' OR name LIKE 'status-%' OR name LIKE 'delete-%' OR name LIKE 'version-%'`);
  });

  afterAll(async () => {
    await closePool();
  });

  it('creates and finds a plugin', async () => {
    const p = await plugins.create({
      name: 'test-plugin',
      description: 'A test plugin',
      author: 'tester',
      source: 'local',
      tags: ['test'],
      capabilities: ['read'],
    });
    expect(p.name).toBe('test-plugin');
    expect(p.status).toBe('disabled');

    const found = await plugins.findById(p.id);
    expect(found).not.toBeNull();
    expect(found?.name).toBe('test-plugin');
  });

  it('finds plugin by name', async () => {
    await plugins.create({ name: 'test-plugin', author: 'tester' });
    const found = await plugins.findByName('test-plugin');
    expect(found).not.toBeNull();
    expect(found?.author).toBe('tester');
  });

  it('lists plugins', async () => {
    await plugins.create({ name: 'list-test-plugin' });
    const result = await plugins.list({ limit: 10 });
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('updates plugin status', async () => {
    const p = await plugins.create({ name: 'status-test' });
    const updated = await plugins.updateStatus(p.id, 'enabled');
    expect(updated?.status).toBe('enabled');
  });

  it('deletes a plugin', async () => {
    const p = await plugins.create({ name: 'delete-test' });
    const removed = await plugins.deleteById(p.id);
    expect(removed).toBe(true);
    const found = await plugins.findById(p.id);
    expect(found).toBeNull();
  });

  it('creates and finds plugin versions', async () => {
    const p = await plugins.create({ name: 'version-test' });
    const v = await pluginVersions.create({
      pluginId: p.id,
      version: '1.0.0',
      manifest: { tools: ['echo'] },
      checksum: 'abc123',
    });
    expect(v.pluginId).toBe(p.id);
    expect(v.version).toBe('1.0.0');

    const versions = await pluginVersions.findByPlugin(p.id);
    expect(versions.length).toBe(1);
    expect(versions[0].manifest).toEqual({ tools: ['echo'] });
  });
});
