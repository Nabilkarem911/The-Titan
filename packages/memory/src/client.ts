import { getLogger } from '@titan/logging';
import type { MemoryConfig, MemoryProvider, HealthStatus, MemoryMessage, MemoryItem, SearchOpts, SearchResult, CollectionInfo } from './index.js';
import { PgVectorMemoryProvider } from './pgvectorProvider.js';

const log = getLogger().child({ component: 'memory-client' });

// Mock provider implementation for testing
class MockMemoryProvider implements MemoryProvider {
  private config: MemoryConfig | null = null;
  private messages: Map<string, MemoryMessage[]> = new Map();
  private collections: Map<string, { items: Map<string, MemoryItem>, info: CollectionInfo }> = new Map();

  async initialize(config: MemoryConfig): Promise<void> {
    this.config = config;
    log.info({ provider: config.provider }, 'Mock memory provider initialized');
  }

  async healthCheck(): Promise<HealthStatus> {
    return { status: 'ok' };
  }

  async addMessage(sessionId: string, message: MemoryMessage): Promise<void> {
    if (!this.messages.has(sessionId)) {
      this.messages.set(sessionId, []);
    }
    this.messages.get(sessionId)!.push(message);
    log.debug({ sessionId, messageId: message.id }, 'Added message to mock memory');
  }

  async getHistory(sessionId: string, limit = 10): Promise<MemoryMessage[]> {
    const messages = this.messages.get(sessionId) || [];
    return messages.slice(-limit);
  }

  async upsert(collection: string, items: MemoryItem[]): Promise<void> {
    if (!this.collections.has(collection)) {
      this.collections.set(collection, {
        items: new Map(),
        info: {
          name: collection,
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
    }
    
    const coll = this.collections.get(collection)!;
    for (const item of items) {
      coll.items.set(item.id, item);
    }
    coll.info.itemCount = coll.items.size;
    coll.info.updatedAt = new Date();
    log.debug({ collection, itemCount: items.length }, 'Upserted items to mock memory');
  }

  async search(collection: string, query: string | number[], opts: SearchOpts): Promise<SearchResult[]> {
    // Simple mock search - just return all items with score 0.5
    const coll = this.collections.get(collection);
    if (!coll) return [];
    
    const items = Array.from(coll.items.values());
    const limit = opts.limit || 10;
    return items.slice(0, limit).map(item => ({
      id: item.id,
      content: item.content,
      score: 0.5,
      metadata: item.metadata
    }));
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    const coll = this.collections.get(collection);
    if (!coll) return;
    
    for (const id of ids) {
      coll.items.delete(id);
    }
    coll.info.itemCount = coll.items.size;
    coll.info.updatedAt = new Date();
    log.debug({ collection, deletedCount: ids.length }, 'Deleted items from mock memory');
  }

  async createCollection(name: string, workspaceId: string): Promise<void> {
    if (!this.collections.has(name)) {
      this.collections.set(name, {
        items: new Map(),
        info: {
          name,
          itemCount: 0,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      });
      log.info({ name, workspaceId }, 'Created mock collection');
    }
  }

  async listCollections(_workspaceId: string): Promise<CollectionInfo[]> {
    // In a real implementation, we'd filter by workspaceId
    return Array.from(this.collections.values()).map(c => c.info);
  }

  async compact(collection: string): Promise<void> {
    log.info({ collection }, 'Compacted mock collection');
  }

  async backup(collection: string, destination: string): Promise<void> {
    log.info({ collection, destination }, 'Backed up mock collection');
  }

  async restore(collection: string, source: string): Promise<void> {
    log.info({ collection, source }, 'Restored mock collection');
  }
}

export class MemoryClient {
  private provider: MemoryProvider | null = null;
  private config: MemoryConfig;

  constructor() {
    const envProvider = process.env['MEMORY_PROVIDER'];
    const validProviders: MemoryConfig['provider'][] = ['mock', 'chromadb', 'pgvector', 'weaviate', 'pinecone'];
    const provider = validProviders.includes(envProvider as MemoryConfig['provider']) ? (envProvider as MemoryConfig['provider']) : 'mock';
    this.config = { provider };
  }

  async initialize(): Promise<void> {
    log.info({ provider: this.config.provider }, 'Initializing memory client');
    
    switch (this.config.provider) {
      case 'mock':
        this.provider = new MockMemoryProvider();
        break;
      case 'pgvector':
        this.provider = new PgVectorMemoryProvider();
        break;
      default:
        throw new Error(`Unsupported memory provider: ${this.config.provider}`);
    }
    
    if (this.provider) {
      await this.provider.initialize(this.config);
    }
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.provider) {
      return { status: 'down', details: { error: 'Provider not initialized' } };
    }
    return await this.provider.healthCheck();
  }

  // Delegate all methods to the provider
  async addMessage(sessionId: string, message: MemoryMessage): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.addMessage(sessionId, message);
  }

  async getHistory(sessionId: string, limit?: number): Promise<MemoryMessage[]> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.getHistory(sessionId, limit);
  }

  async upsert(collection: string, items: MemoryItem[]): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.upsert(collection, items);
  }

  async search(collection: string, query: string | number[], opts: SearchOpts): Promise<SearchResult[]> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.search(collection, query, opts);
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.delete(collection, ids);
  }

  async createCollection(name: string, workspaceId: string): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.createCollection(name, workspaceId);
  }

  async listCollections(_workspaceId: string): Promise<CollectionInfo[]> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.listCollections(_workspaceId);
  }

  async compact(collection: string): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.compact(collection);
  }

  async backup(collection: string, destination: string): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.backup(collection, destination);
  }

  async restore(collection: string, source: string): Promise<void> {
    if (!this.provider) throw new Error('Memory provider not initialized');
    return await this.provider.restore(collection, source);
  }
}