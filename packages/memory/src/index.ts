// Core interfaces and types for the Memory Layer
export interface MemoryConfig {
  provider: 'mock' | 'chromadb' | 'pgvector' | 'weaviate' | 'pinecone';
  // Provider-specific configuration will be added later
  [key: string]: unknown;
}

export interface HealthStatus {
  status: 'ok' | 'degraded' | 'down';
  details?: Record<string, unknown>;
}

export interface MemoryMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface MemoryItem {
  id: string;
  content: string;
  embedding?: number[]; // For semantic search
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface SearchOpts {
  limit?: number;
  minScore?: number; // For similarity search
  filters?: Record<string, unknown>; // Metadata filters
}

export interface SearchResult {
  id: string;
  content: string;
  score: number; // Similarity score
  metadata?: Record<string, unknown>;
}

export interface CollectionInfo {
  name: string;
  itemCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Main MemoryProvider interface
export interface MemoryProvider {
  initialize(config: MemoryConfig): Promise<void>;
  healthCheck(): Promise<HealthStatus>;
  
  // Conversation history
  addMessage(sessionId: string, message: MemoryMessage): Promise<void>;
  getHistory(sessionId: string, limit?: number): Promise<MemoryMessage[]>;
  
  // Semantic memory
  upsert(collection: string, items: MemoryItem[]): Promise<void>;
  search(collection: string, query: string | number[], opts: SearchOpts): Promise<SearchResult[]>;
  delete(collection: string, ids: string[]): Promise<void>;
  
  // Project knowledge
  createCollection(name: string, workspaceId: string): Promise<void>;
  listCollections(workspaceId: string): Promise<CollectionInfo[]>;
  
  // Maintenance
  compact(collection: string): Promise<void>;
  backup(collection: string, destination: string): Promise<void>;
  restore(collection: string, source: string): Promise<void>;
}

// MemoryClient will be implemented in client.ts
export { MemoryClient, getGlobalMemoryClient } from './client.js';
export { OpenAiEmbeddingProvider, createEmbeddingProvider, getEmbeddingProvider, type EmbeddingProvider } from './embeddings.js';

// Phase 2: Advanced Memory
export * from './layers/index.js';
export * from './consolidation/index.js';
export * from './retrieval/index.js';
export * from './graph/index.js';