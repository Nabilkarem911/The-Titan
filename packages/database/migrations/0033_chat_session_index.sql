-- Index for chat session queries: (session_id, created_at)
-- Speeds up GROUP BY session_id + ORDER BY created_at and window function queries
CREATE INDEX IF NOT EXISTS idx_memory_messages_session_created_at
  ON memory_messages (session_id, created_at DESC);
