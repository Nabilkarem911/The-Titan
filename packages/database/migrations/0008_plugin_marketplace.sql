-- Plugin marketplace tables: ratings + install tracking
CREATE TABLE IF NOT EXISTS plugin_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  user_id UUID,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plugin_id, user_id)
);

CREATE TABLE IF NOT EXISTS plugin_installs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plugin_id UUID NOT NULL REFERENCES plugins(id) ON DELETE CASCADE,
  workspace_id UUID,
  version TEXT,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_plugin_ratings_plugin_id ON plugin_ratings(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_ratings_user_id ON plugin_ratings(user_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installs_plugin_id ON plugin_installs(plugin_id);
CREATE INDEX IF NOT EXISTS idx_plugin_installs_workspace_id ON plugin_installs(workspace_id);
