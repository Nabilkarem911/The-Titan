import { useEffect, useState } from 'react';
import { Monitor, Cpu, CheckCircle2, XCircle, RefreshCw, Copy } from 'lucide-react';

interface Device {
  deviceId: string;
  deviceName: string;
  platform: string;
  hostname: string | null;
  capabilities: string[];
  status: string;
  lastSeenAt: string | null;
}

export function DeviceManager() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = async () => {
    try {
      const settings = await (window as any).titan?.getSettings();
      const token = settings?.token;
      const serverUrl = settings?.serverUrl;
      if (!token || !serverUrl) {
        setLoading(false);
        return;
      }
      const res = await fetch(`${serverUrl}/api/v1/desktop/devices`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json() as { devices: Device[] };
        setDevices(data.devices);
      }
    } catch {
      // ignore — keep last state
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-bg-primary overflow-y-auto">
      <div className="h-12 border-b border-border flex items-center px-4 gap-2 glass">
        <Monitor size={16} className="text-accent" />
        <span className="font-semibold text-sm">Device Manager</span>
        <div className="flex-1" />
        <button onClick={fetchDevices} className="p-1.5 rounded hover:bg-bg-tertiary transition-colors">
          <RefreshCw size={14} className="text-text-muted" />
        </button>
      </div>

      <div className="max-w-2xl w-full mx-auto p-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="h-20 rounded-xl shimmer" />
            ))}
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-text-muted">
            <Monitor size={48} className="mb-4 opacity-50" />
            <p className="text-sm">No devices registered yet</p>
            <p className="text-xs mt-1">Connect a device to see it here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {devices.map((device) => (
              <div
                key={device.deviceId}
                className="bg-bg-secondary border border-border rounded-xl p-4 flex items-center gap-4"
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  device.status === 'online' ? 'bg-success/20' : 'bg-danger/20'
                }`}>
                  {device.status === 'online' ? (
                    <CheckCircle2 size={20} className="text-success" />
                  ) : (
                    <XCircle size={20} className="text-danger" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{device.deviceName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      device.status === 'online' ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
                    }`}>
                      {device.status}
                    </span>
                  </div>
                  <div className="text-xs text-text-muted mt-1">
                    {device.platform} {device.hostname && `· ${device.hostname}`}
                  </div>
                  <div className="text-[10px] text-text-muted mt-1 font-mono flex items-center gap-1">
                    <span>ID: {device.deviceId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(device.deviceId);
                      }}
                      className="text-text-muted hover:text-accent transition-colors"
                      title="Copy device ID"
                    >
                      <Copy size={10} />
                    </button>
                  </div>
                  <div className="flex gap-1 mt-2">
                    {device.capabilities.map((cap) => (
                      <span key={cap} className="text-[10px] px-1.5 py-0.5 rounded bg-bg-tertiary text-text-muted">
                        {cap}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
