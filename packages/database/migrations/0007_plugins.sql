-- =============================================================================
-- 0007 - Plugin System Schema
-- =============================================================================

CREATE TABLE IF NOT EXISTS plugins (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  description   TEXT,
  author        TEXT,
  source        TEXT NOT NULL CHECK (source IN ('registry', 'local', 'marketplace')),
  status        TEXT NOT NULL DEFAULT 'disabled' CHECK (status IN ('enabled', 'disabled', 'error')),
  tags          TEXT[],
  capabilities  TEXT[],
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE INDEX IF NOT EXISTS plugins_status_idx
  ON plugins (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS plugins_tags_idx
  ON plugins USING GIN (tags);

CREATE TABLE IF NOT EXISTS plugin_versions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id     UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  version       TEXT NOT NULL,
  manifest      JSONB NOT NULL,
  entrypoint    TEXT,
  checksum      TEXT NOT NULL,
  signature     TEXT,
  status        TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'deprecated')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plugin_id, version)
);

CREATE INDEX IF NOT EXISTS plugin_versions_plugin_idx
  ON plugin_versions (plugin_id, version);
