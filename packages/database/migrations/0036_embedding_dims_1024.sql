-- =============================================================================
-- 0036 — توسيع أبعاد متجهات الذاكرة 384 → 1024 (نموذج تمثيل أقوى)
-- =============================================================================
-- السبب: النموذج الصغير (MiniLM 384) أثبت ضعف تمييزه في العربي عند الاختبار
-- الفعلي (الاستعلامات رجّعت نتايج غير ذات صلة). انتقلنا لـ
-- intfloat/multilingual-e5-large (1024 بُعد) وهو من أقوى نماذج الاسترجاع
-- متعدد اللغات. المتجهات القديمة تُصفَّر ويُعاد توليدها بعد الترحيل.
-- =============================================================================

DO $$
DECLARE col_type text;
BEGIN
  BEGIN CREATE EXTENSION IF NOT EXISTS vector; EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector غير متاح'; RETURN; END;

  SELECT format_type(a.atttypid, a.atttypmod) INTO col_type
    FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
   WHERE c.relname = 'memory_items' AND a.attname = 'embedding_vec';

  IF col_type = 'vector(384)' THEN
    BEGIN
      DROP INDEX IF EXISTS idx_memory_items_embedding_hnsw;
      DROP INDEX IF EXISTS memory_items_embedding_vec_idx;
      ALTER TABLE memory_items ALTER COLUMN embedding_vec TYPE vector(1024) USING NULL::vector(1024);
      CREATE INDEX IF NOT EXISTS idx_memory_items_embedding_hnsw
        ON memory_items USING hnsw (embedding_vec vector_cosine_ops) WITH (m = 16, ef_construction = 64);
      RAISE NOTICE '✅ embedding_vec → 1024 بُعد + الفهرس اتعاد';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'فشل: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'العمود بالفعل % — مفيش تغيير', col_type;
  END IF;
END $$;
