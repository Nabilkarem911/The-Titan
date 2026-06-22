import { query } from './client.js';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'desktop-devices' });

export interface DesktopDevice {
  id: string;
  userId: string;
  deviceName: string;
  deviceId: string;
  platform: string;
  hostname: string | null;
  status: 'online' | 'offline';
  lastSeenAt: Date | null;
  capabilities: string[];
  createdAt: Date;
  updatedAt: Date;
}

function mapDevice(row: Record<string, unknown>): DesktopDevice {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    deviceName: row.device_name as string,
    deviceId: row.device_id as string,
    platform: row.platform as string,
    hostname: (row.hostname as string | null) ?? null,
    status: row.status as 'online' | 'offline',
    lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at as string) : null,
    capabilities: Array.isArray(row.capabilities) ? row.capabilities as string[] : [],
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

export const desktopDevices = {
  async register(input: {
    userId: string;
    deviceId: string;
    deviceName: string;
    platform: string;
    hostname?: string;
    capabilities: string[];
  }): Promise<DesktopDevice> {
    const r = await query<Record<string, unknown>>(
      `INSERT INTO desktop_devices (user_id, device_id, device_name, platform, hostname, capabilities, status, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'online', now())
       ON CONFLICT (user_id, device_id)
       DO UPDATE SET device_name = $3, platform = $4, hostname = $5, capabilities = $6, status = 'online', last_seen_at = now(), updated_at = now()
       RETURNING *`,
      [input.userId, input.deviceId, input.deviceName, input.platform, input.hostname ?? null, JSON.stringify(input.capabilities)],
    );
    log.info({ userId: input.userId, deviceId: input.deviceId, deviceName: input.deviceName }, 'device registered');
    return mapDevice(r.rows[0]);
  },

  async setStatus(userId: string, deviceId: string, status: 'online' | 'offline'): Promise<void> {
    await query(
      `UPDATE desktop_devices SET status = $3::text, last_seen_at = CASE WHEN $3::text = 'online' THEN now() ELSE last_seen_at END, updated_at = now()
       WHERE user_id = $1 AND device_id = $2`,
      [userId, deviceId, status],
    );
  },

  async listByUser(userId: string): Promise<DesktopDevice[]> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM desktop_devices WHERE user_id = $1 ORDER BY updated_at DESC',
      [userId],
    );
    return r.rows.map(mapDevice);
  },

  async findOnline(userId: string): Promise<DesktopDevice | null> {
    const r = await query<Record<string, unknown>>(
      "SELECT * FROM desktop_devices WHERE user_id = $1 AND status = 'online' ORDER BY last_seen_at DESC LIMIT 1",
      [userId],
    );
    return r.rows[0] ? mapDevice(r.rows[0]) : null;
  },

  async findByDeviceId(userId: string, deviceId: string): Promise<DesktopDevice | null> {
    const r = await query<Record<string, unknown>>(
      'SELECT * FROM desktop_devices WHERE user_id = $1 AND device_id = $2',
      [userId, deviceId],
    );
    return r.rows[0] ? mapDevice(r.rows[0]) : null;
  },

  async remove(userId: string, deviceId: string): Promise<void> {
    await query('DELETE FROM desktop_devices WHERE user_id = $1 AND device_id = $2', [userId, deviceId]);
  },
};
