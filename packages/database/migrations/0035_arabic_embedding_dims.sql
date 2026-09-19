-- =============================================================================
-- 0035 — إصلاح أبعاد متجهات الذاكرة + نموذج تمثيل متعدد اللغات (عربي)
-- =============================================================================
-- المشكلة اللي بتحل:
--   1) العمود كان vector(1536) بينما خدمة التمثيل بتنتج 384 بُعد
--      → الكود كان بيرفض تخزين embedding_vec (كان بيتحقق من 1536 ثابتة)
--      → embedding_vec كان NULL دايمًا → البحث الدلالي كان معطّل بالكامل.
--   2) نموذج التمثيل كان bge-small-en-v1.5 = إنجليزي فقط
--      → العربي كان مش مفهوم في الذاكرة.
--
-- الحل: العمود يتظبط على 384 (مطابق لـ intfloat/multilingual-e5-small)
--        وإعادة بناء الفهرس. المتجهات القديمة كلها NULL فلا يوجد فقدان بيانات.
-- ملاحظة: عشان متجهات عربية صحيحة، لازم إعادة توليد التمثيل للعناصر الموجودة
--         (شغّل backfill: أعِد حفظ العناصر أو استخدم سكربت إعادة التمثيل).
-- =============================================================================

DO $$
DECLARE
  col_type text;
BEGIN
  -- نتأكد إن الإضافة متاحة
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vector;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'pgvector غير متاح — تخطّي: %', SQLERRM;
    RETURN;
  END;

  SELECT format_type(a.atttypid, a.atttypmod)
    INTO col_type
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
   WHERE c.relname = 'memory_items' AND a.attname = 'embedding_vec';

  IF col_type IS NULL THEN
    RAISE NOTICE 'العمود embedding_vec غير موجود — تخطّي';
    RETURN;
  END IF;

  IF col_type = 'vector(1536)' THEN
    -- القيم الحالية كلها NULL (بسبب الباچ القديم) → التحويل آمن
    BEGIN
      DROP INDEX IF EXISTS idx_memory_items_embedding_hnsw;
      DROP INDEX IF EXISTS memory_items_embedding_vec_idx;

      ALTER TABLE memory_items
        ALTER COLUMN embedding_vec TYPE vector(384) USING NULL::vector(384);

      CREATE INDEX IF NOT EXISTS idx_memory_items_embedding_hnsw
        ON memory_items USING hnsw (embedding_vec vector_cosine_ops)
        WITH (m = 16, ef_construction = 64);

      RAISE NOTICE '✅ embedding_vec اتظبط على 384 بُعد والفهرس اتعاد بناؤه';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'فشل التعديل: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'العمود بالفعل % — مفيش حاجة تتعدل', col_type;
  END IF;
END $$;
