-- Desktop Agent: device registration table
-- Tracks user devices connected via the Desktop Bridge WebSocket

CREATE TABLE IF NOT EXISTS desktop_devices (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_name  VARCHAR(100) NOT NULL,
  device_id    VARCHAR(100) NOT NULL,
  platform     VARCHAR(50) NOT NULL,
  hostname     VARCHAR(200),
  status       VARCHAR(20) NOT NULL DEFAULT 'offline',
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_desktop_devices_user_id ON desktop_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_desktop_devices_status ON desktop_devices(status);
