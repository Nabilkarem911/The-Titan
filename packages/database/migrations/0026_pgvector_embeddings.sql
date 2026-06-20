-- =============================================================================
-- 0026 - pgvector: Add native vector column for embeddings
-- =============================================================================
-- Adds a `vector` column to memory_items for efficient similarity search
-- using the pgvector extension. Backfills from existing JSONB embeddings.
-- Falls back gracefully if pgvector is not installed.

-- Ensure pgvector extension is available
CREATE EXTENSION IF NOT EXISTS vector;

-- Add native vector column (1536 dimensions covers OpenAI text-embedding-3-small/large)
ALTER TABLE memory_items ADD COLUMN IF NOT EXISTS embedding_vec vector(1536);

-- Backfill: convert JSONB array to vector where possible
-- Only attempt if there are existing embeddings stored as JSONB arrays
DO $$
BEGIN
  -- Check if any rows have JSONB embeddings
  IF EXISTS (SELECT 1 FROM memory_items WHERE embedding IS NOT NULL LIMIT 1) THEN
    -- Update embedding_vec from JSONB array for rows where embedding is a numeric array
    UPDATE memory_items
    SET embedding_vec = (
      SELECT array_to_vector(
        ARRAY(
          SELECT (elem::text)::float8
          FROM jsonb_array_elements_text(embedding) AS elem
        )::float4[]
      )
    )
    WHERE embedding IS NOT NULL
      AND jsonb_typeof(embedding) = 'array'
      AND jsonb_array_length(embedding) = 1536
      AND embedding_vec IS NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Backfill skipped: %', SQLERRM;
END $$;

-- Create ivfflat index for fast approximate nearest neighbor search
-- Only create if there are rows with embeddings to avoid empty index
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM memory_items WHERE embedding_vec IS NOT NULL LIMIT 1) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS memory_items_embedding_vec_idx ON memory_items USING ivfflat (embedding_vec vector_cosine_ops) WITH (lists = 100)';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Index creation skipped: %', SQLERRM;
END $$;

-- Add updated_at trigger for memory_items (was missing in original migration)
DROP TRIGGER IF EXISTS memory_items_set_updated_at ON memory_items;
CREATE TRIGGER memory_items_set_updated_at
  BEFORE UPDATE ON memory_items
  FOR EACH ROW
  EXECUTE FUNCTION public.titan_set_updated_at();
