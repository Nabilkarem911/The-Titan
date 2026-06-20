import pg from 'pg';
const { Pool } = pg;
import { getLogger } from '@titan/logging';
import type { MemoryConfig, MemoryProvider, HealthStatus, MemoryMessage, MemoryItem, SearchOpts, SearchResult, CollectionInfo } from './index.js';

const log = getLogger().child({ component: 'memory-pgvector' });

export class PgVectorMemoryProvider implements MemoryProvider {
  private pool: InstanceType<typeof Pool> | null = null;
  private initialized = false;

  async initialize(config: MemoryConfig): Promise<void> {
    const host = (config['POSTGRES_HOST'] as string | undefined) ?? process.env['POSTGRES_HOST'] ?? 'localhost';
    const port = Number((config['POSTGRES_PORT'] as string | undefined) ?? process.env['POSTGRES_PORT'] ?? 5432);
    const database = (config['POSTGRES_DB'] as string | undefined) ?? process.env['POSTGRES_DB'] ?? 'titan';
    const user = (config['POSTGRES_USER'] as string | undefined) ?? process.env['POSTGRES_USER'] ?? 'titan';
    const password = (config['POSTGRES_PASSWORD'] as string | undefined) ?? process.env['POSTGRES_PASSWORD'] ?? '';

    this.pool = new Pool({ host, port, database, user, password, max: 5 });
    this.initialized = true;
    log.info({ provider: 'pgvector', host, database }, 'PgVector memory provider initialized');
  }

  private get db(): InstanceType<typeof Pool> {
    if (!this.pool || !this.initialized) throw new Error('Memory provider not initialized');
    return this.pool;
  }

  async healthCheck(): Promise<HealthStatus> {
    if (!this.initialized || !this.pool) return { status: 'down', details: { error: 'Not initialized' } };
    try {
      await this.pool.query('SELECT 1');
      return { status: 'ok' };
    } catch (err) {
      return { status: 'down', details: { error: (err as Error).message } };
    }
  }

  async addMessage(sessionId: string, message: MemoryMessage): Promise<void> {
    await this.db.query(
      `INSERT INTO memory_messages (id, session_id, role, content, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (id) DO NOTHING`,
      [message.id, sessionId, message.role, message.content, JSON.stringify(message.metadata ?? {}), message.timestamp],
    );
    log.debug({ sessionId, messageId: message.id }, 'message stored');
  }

  async getHistory(sessionId: string, limit = 50): Promise<MemoryMessage[]> {
    const { rows } = await this.db.query<{
      id: string; session_id: string; role: string; content: string; metadata: Record<string, unknown>; created_at: Date;
    }>(
      `SELECT id, session_id, role, content, metadata, created_at
       FROM memory_messages
       WHERE session_id = $1
       ORDER BY created_at ASC
       LIMIT $2`,
      [sessionId, limit],
    );
    return rows.map((r: { id: string; session_id: string; role: string; content: string; metadata: Record<string, unknown>; created_at: Date }) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role as MemoryMessage['role'],
      content: r.content,
      metadata: r.metadata,
      timestamp: r.created_at,
    }));
  }

  private async resolveCollectionId(collectionName: string): Promise<string | null> {
    const { rows } = await this.db.query<{ id: string }>(
      `SELECT id FROM memory_collections WHERE name = $1 LIMIT 1`,
      [collectionName],
    );
    return rows[0]?.id ?? null;
  }

  async upsert(collection: string, items: MemoryItem[]): Promise<void> {
    if (items.length === 0) return;
    const collId = await this.resolveCollectionId(collection);
    if (!collId) {
      log.warn({ collection }, 'upsert: collection not found, creating');
      await this.createCollection(collection, 'default');
    }
    const id = (await this.resolveCollectionId(collection))!;
    for (const item of items) {
      await this.insertItem(id, item);
    }
    await this.db.query(
      `UPDATE memory_collections SET item_count = (SELECT COUNT(*) FROM memory_items WHERE collection_id = $1), updated_at = now() WHERE id = $1`,
      [id],
    );
    log.debug({ collection, count: items.length }, 'upserted');
  }

  private async insertItem(collectionId: string, item: MemoryItem): Promise<void> {
    const embeddingJson = item.embedding ? JSON.stringify(item.embedding) : null;
    const embeddingVec = item.embedding && item.embedding.length === 1536
      ? `[${item.embedding.join(',')}]`
      : null;
    await this.db.query(
      `INSERT INTO memory_items (collection_id, external_id, content, embedding, embedding_vec, metadata, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (collection_id, external_id)
       DO UPDATE SET content = EXCLUDED.content, embedding = EXCLUDED.embedding,
                     embedding_vec = EXCLUDED.embedding_vec,
                     metadata = EXCLUDED.metadata, updated_at = now()`,
      [collectionId, item.id, item.content, embeddingJson, embeddingVec, JSON.stringify(item.metadata ?? {})],
    );
  }

  async search(collection: string, query: string | number[], opts: SearchOpts): Promise<SearchResult[]> {
    const collId = await this.resolveCollectionId(collection);
    if (!collId) return [];
    const limit = opts.limit ?? 10;

    if (typeof query === 'string') {
      // Try pgvector similarity search first if embedding column exists
      // Fall back to multi-strategy text search: exact → trigram → keyword tokens
      const terms = query
        .split(/\s+/)
        .filter((t) => t.length > 1)
        .map((t) => `%${t}%`);

      if (terms.length === 0) {
        // Empty query — return most recent items
        const { rows } = await this.db.query<{ external_id: string; content: string; metadata: Record<string, unknown> }>(
          `SELECT external_id, content, metadata
           FROM memory_items
           WHERE collection_id = $1
           ORDER BY updated_at DESC
           LIMIT $2`,
          [collId, limit],
        );
        return rows.map((r, i) => ({ id: r.external_id, content: r.content, score: 1 - i * 0.05, metadata: r.metadata }));
      }

      // Build WHERE clause: each token must partially match content
      const conditions = terms.map((_, i) => `content ILIKE $${i + 3}`).join(' OR ');
      const { rows } = await this.db.query<{ external_id: string; content: string; metadata: Record<string, unknown>; match_count: string }>(
        `SELECT external_id, content, metadata,
                (${terms.map((_, i) => `(CASE WHEN content ILIKE $${i + 3} THEN 1 ELSE 0 END)`).join(' + ')}) AS match_count
         FROM memory_items
         WHERE collection_id = $1
           AND (${conditions})
         ORDER BY match_count DESC, updated_at DESC
         LIMIT $2`,
        [collId, limit, ...terms],
      );
      return rows.map((r, i) => ({
        id: r.external_id,
        content: r.content,
        score: Math.max(0.1, 1 - i * 0.08),
        metadata: r.metadata,
      }));
    }

    // Vector array provided — try pgvector cosine similarity on native vector column first
    try {
      const vectorStr = `[${query.join(',')}]`;
      const { rows } = await this.db.query<{ external_id: string; content: string; metadata: Record<string, unknown>; similarity: number }>(
        `SELECT external_id, content, metadata,
                1 - (embedding_vec <=> $3::vector) AS similarity
         FROM memory_items
         WHERE collection_id = $1
           AND embedding_vec IS NOT NULL
         ORDER BY embedding_vec <=> $3::vector
         LIMIT $2`,
        [collId, limit, vectorStr],
      );
      if (rows.length > 0) {
        return rows.map((r) => ({ id: r.external_id, content: r.content, score: r.similarity, metadata: r.metadata }));
      }
    } catch {
      // native vector column not available — try JSONB fallback
    }

    // Fallback: try casting JSONB embedding to vector
    try {
      const vectorStr = `[${query.join(',')}]`;
      const { rows } = await this.db.query<{ external_id: string; content: string; metadata: Record<string, unknown>; similarity: number }>(
        `SELECT external_id, content, metadata,
                1 - (embedding <=> $3::vector) AS similarity
         FROM memory_items
         WHERE collection_id = $1
           AND embedding IS NOT NULL
         ORDER BY embedding <=> $3::vector
         LIMIT $2`,
        [collId, limit, vectorStr],
      );
      if (rows.length > 0) {
        return rows.map((r) => ({ id: r.external_id, content: r.content, score: r.similarity, metadata: r.metadata }));
      }
    } catch {
      // pgvector not available or no embeddings — fall through to recency scan
    }

    // Fallback: return most recent items ordered by recency
    const { rows } = await this.db.query<{ external_id: string; content: string; metadata: Record<string, unknown> }>(
      `SELECT external_id, content, metadata
       FROM memory_items
       WHERE collection_id = $1
       ORDER BY updated_at DESC
       LIMIT $2`,
      [collId, limit],
    );
    return rows.map((r, i) => ({ id: r.external_id, content: r.content, score: 1 - i * 0.05, metadata: r.metadata }));
  }

  async delete(collection: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    const collId = await this.resolveCollectionId(collection);
    if (!collId) return;
    await this.db.query(
      `DELETE FROM memory_items WHERE collection_id = $1 AND external_id = ANY($2::text[])`,
      [collId, ids],
    );
    await this.db.query(
      `UPDATE memory_collections SET item_count = (SELECT COUNT(*) FROM memory_items WHERE collection_id = $1), updated_at = now() WHERE id = $1`,
      [collId],
    );
  }

  async createCollection(name: string, workspaceId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO memory_collections (name, workspace_id) VALUES ($1, $2) ON CONFLICT (name, workspace_id) DO NOTHING`,
      [name, workspaceId],
    );
    log.info({ name, workspaceId }, 'collection created');
  }

  async listCollections(workspaceId: string): Promise<CollectionInfo[]> {
    const { rows } = await this.db.query<{ name: string; item_count: number; created_at: Date; updated_at: Date }>(
      `SELECT name, item_count, created_at, updated_at FROM memory_collections WHERE workspace_id = $1 ORDER BY name`,
      [workspaceId],
    );
    return rows.map((r: { name: string; item_count: number; created_at: Date; updated_at: Date }) => ({ name: r.name, itemCount: r.item_count, createdAt: r.created_at, updatedAt: r.updated_at }));
  }

  async compact(_collection: string): Promise<void> {
    log.info({ collection: _collection }, 'compact: no-op for PostgreSQL (VACUUM handles this)');
  }

  async backup(collection: string, destination: string): Promise<void> {
    log.info({ collection, destination }, 'backup: not implemented — use pg_dump for PostgreSQL backups');
  }

  async restore(collection: string, source: string): Promise<void> {
    log.info({ collection, source }, 'restore: not implemented — use pg_restore for PostgreSQL restores');
  }

  async close(): Promise<void> {
    await this.pool?.end();
    this.pool = null;
    this.initialized = false;
  }
}