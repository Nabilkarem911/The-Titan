-- 0034 - Replace IVFFlat with HNSW index for faster approximate nearest neighbor search
-- HNSW provides better recall and faster queries than IVFFlat, especially for smaller datasets.
-- Falls back gracefully if pgvector is not installed or version is too old.

DO $$
BEGIN
  -- Drop the old IVFFlat index if it exists
  DROP INDEX IF EXISTS memory_items_embedding_vec_idx;

  -- Create HNSW index (requires pgvector >= 0.5.0)
  -- m: max connections per layer (default 16, higher = more memory, better recall)
  -- ef_construction: build-time search width (default 64, higher = slower build, better index)
  EXECUTE 'CREATE INDEX IF NOT EXISTS idx_memory_items_embedding_hnsw ON memory_items USING hnsw (embedding_vec vector_cosine_ops) WITH (m = 16, ef_construction = 64)';

  RAISE NOTICE 'HNSW index created on memory_items.embedding_vec';
EXCEPTION WHEN OTHERS THEN
  -- If HNSW is not supported, fall back to IVFFlat
  BEGIN
    EXECUTE 'CREATE INDEX IF NOT EXISTS memory_items_embedding_vec_idx ON memory_items USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 100)';
    RAISE NOTICE 'HNSW not supported, fell back to IVFFlat: %', SQLERRM;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Index creation skipped entirely: %', SQLERRM;
  END;
END $$;
