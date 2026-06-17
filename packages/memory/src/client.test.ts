import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MemoryClient, getGlobalMemoryClient } from './client.js';
import type { MemoryMessage, MemoryItem } from './index.js';

// Mock @titan/logging to avoid real logger setup
vi.mock('@titan/logging', () => ({
  getLogger: () => ({
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

// Mock pgvectorProvider to avoid pg dependency in tests
vi.mock('./pgvectorProvider.js', () => ({
  PgVectorMemoryProvider: class {
    async initialize() {}
    async healthCheck() {
      return { status: 'ok' };
    }
  },
}));

// Mock embeddings to avoid external API calls
vi.mock('./embeddings.js', () => ({
  getEmbeddingProvider: vi.fn(() => null),
}));

function makeMessage(overrides: Partial<MemoryMessage> = {}): MemoryMessage {
  return {
    id: 'msg-1',
    sessionId: 'session-1',
    role: 'user',
    content: 'Hello, world!',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

function makeItem(overrides: Partial<MemoryItem> = {}): MemoryItem {
  return {
    id: 'item-1',
    content: 'Test content',
    timestamp: new Date('2025-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('MemoryClient', () => {
  let client: MemoryClient;

  beforeEach(() => {
    // Ensure mock provider by default
    delete process.env['MEMORY_PROVIDER'];
  });

  afterEach(async () => {
    if (client) {
      await client.close();
    }
  });

  describe('constructor', () => {
    it('defaults to mock provider when MEMORY_PROVIDER is not set', () => {
      delete process.env['MEMORY_PROVIDER'];
      client = new MemoryClient();
      // The client is created without errors; it uses 'mock' internally
      expect(client).toBeInstanceOf(MemoryClient);
    });

    it('uses MEMORY_PROVIDER env var when set to a valid value', () => {
      process.env['MEMORY_PROVIDER'] = 'pgvector';
      client = new MemoryClient();
      expect(client).toBeInstanceOf(MemoryClient);
      delete process.env['MEMORY_PROVIDER'];
    });

    it('falls back to mock when MEMORY_PROVIDER is an invalid value', () => {
      process.env['MEMORY_PROVIDER'] = 'invalid-provider';
      client = new MemoryClient();
      // Should not throw, just default to mock
      expect(client).toBeInstanceOf(MemoryClient);
      delete process.env['MEMORY_PROVIDER'];
    });
  });

  describe('before initialization', () => {
    beforeEach(() => {
      client = new MemoryClient();
    });

    it('healthCheck returns down status', async () => {
      const health = await client.healthCheck();
      expect(health.status).toBe('down');
      expect(health.details).toEqual({ error: 'Provider not initialized' });
    });

    it('addMessage throws when provider not initialized', async () => {
      await expect(client.addMessage('s1', makeMessage())).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('getHistory throws when provider not initialized', async () => {
      await expect(client.getHistory('s1')).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('upsert throws when provider not initialized', async () => {
      await expect(client.upsert('col', [makeItem()])).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('search throws when provider not initialized', async () => {
      await expect(client.search('col', 'query', {})).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('delete throws when provider not initialized', async () => {
      await expect(client.delete('col', ['id-1'])).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('createCollection throws when provider not initialized', async () => {
      await expect(client.createCollection('col', 'ws-1')).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('listCollections throws when provider not initialized', async () => {
      await expect(client.listCollections('ws-1')).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('compact throws when provider not initialized', async () => {
      await expect(client.compact('col')).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('backup throws when provider not initialized', async () => {
      await expect(client.backup('col', '/tmp/bak')).rejects.toThrow(
        'Memory provider not initialized',
      );
    });

    it('restore throws when provider not initialized', async () => {
      await expect(client.restore('col', '/tmp/bak')).rejects.toThrow(
        'Memory provider not initialized',
      );
    });
  });

  describe('after initialization with mock provider', () => {
    beforeEach(async () => {
      delete process.env['MEMORY_PROVIDER'];
      client = new MemoryClient();
      await client.initialize();
    });

    it('healthCheck returns ok', async () => {
      const health = await client.healthCheck();
      expect(health.status).toBe('ok');
    });

    it('addMessage and getHistory round-trip', async () => {
      const msg = makeMessage({ id: 'msg-rt-1', sessionId: 'sess-rt' });
      await client.addMessage('sess-rt', msg);
      const history = await client.getHistory('sess-rt');
      expect(history).toHaveLength(1);
      expect(history[0].id).toBe('msg-rt-1');
      expect(history[0].content).toBe('Hello, world!');
    });

    it('getHistory returns empty array for unknown session', async () => {
      const history = await client.getHistory('unknown-session');
      expect(history).toEqual([]);
    });

    it('getHistory respects limit', async () => {
      for (let i = 0; i < 5; i++) {
        await client.addMessage(
          'sess-lim',
          makeMessage({ id: `msg-${i}`, sessionId: 'sess-lim', content: `Message ${i}` }),
        );
      }
      const history = await client.getHistory('sess-lim', 3);
      expect(history).toHaveLength(3);
      // Mock provider returns last N messages
      expect(history[0].content).toBe('Message 2');
      expect(history[2].content).toBe('Message 4');
    });

    it('upsert and search round-trip', async () => {
      const items = [
        makeItem({ id: 'item-a', content: 'Alpha content' }),
        makeItem({ id: 'item-b', content: 'Beta content' }),
      ];
      await client.upsert('test-col', items);
      const results = await client.search('test-col', 'Alpha', { limit: 10 });
      expect(results.length).toBeGreaterThanOrEqual(1);
      // Mock provider returns all items with score 0.5
      expect(results[0].score).toBe(0.5);
    });

    it('search returns empty array for unknown collection', async () => {
      const results = await client.search('nonexistent-col', 'query', {});
      expect(results).toEqual([]);
    });

    it('delete removes items from collection', async () => {
      await client.upsert('del-col', [
        makeItem({ id: 'del-1', content: 'Delete me' }),
        makeItem({ id: 'del-2', content: 'Keep me' }),
      ]);

      await client.delete('del-col', ['del-1']);

      const results = await client.search('del-col', 'anything', { limit: 10 });
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe('del-2');
    });

    it('createCollection and listCollections', async () => {
      await client.createCollection('new-col', 'ws-1');
      const collections = await client.listCollections('ws-1');
      expect(collections.length).toBeGreaterThanOrEqual(1);
      const created = collections.find((c) => c.name === 'new-col');
      expect(created).toBeDefined();
      expect(created!.itemCount).toBe(0);
    });

    it('compact does not throw', async () => {
      await client.createCollection('compact-col', 'ws-1');
      await expect(client.compact('compact-col')).resolves.toBeUndefined();
    });

    it('backup does not throw', async () => {
      await client.createCollection('bak-col', 'ws-1');
      await expect(client.backup('bak-col', '/tmp/backup')).resolves.toBeUndefined();
    });

    it('restore does not throw', async () => {
      await expect(client.restore('restore-col', '/tmp/backup')).resolves.toBeUndefined();
    });

    it('close nullifies the provider', async () => {
      await client.close();
      const health = await client.healthCheck();
      expect(health.status).toBe('down');
    });
  });

  describe('unsupported provider', () => {
    it('throws for chromadb (not yet implemented)', async () => {
      process.env['MEMORY_PROVIDER'] = 'chromadb';
      client = new MemoryClient();
      await expect(client.initialize()).rejects.toThrow('Unsupported memory provider');
      delete process.env['MEMORY_PROVIDER'];
    });

    it('throws for weaviate (not yet implemented)', async () => {
      process.env['MEMORY_PROVIDER'] = 'weaviate';
      client = new MemoryClient();
      await expect(client.initialize()).rejects.toThrow('Unsupported memory provider');
      delete process.env['MEMORY_PROVIDER'];
    });

    it('throws for pinecone (not yet implemented)', async () => {
      process.env['MEMORY_PROVIDER'] = 'pinecone';
      client = new MemoryClient();
      await expect(client.initialize()).rejects.toThrow('Unsupported memory provider');
      delete process.env['MEMORY_PROVIDER'];
    });
  });
});

describe('getGlobalMemoryClient', () => {
  it('returns a MemoryClient instance', async () => {
    const mc = await getGlobalMemoryClient();
    expect(mc).toBeInstanceOf(MemoryClient);
  });

  it('returns the same instance on repeated calls', async () => {
    const a = await getGlobalMemoryClient();
    const b = await getGlobalMemoryClient();
    expect(a).toBe(b);
  });
});
