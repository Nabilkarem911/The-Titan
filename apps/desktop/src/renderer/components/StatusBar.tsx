import { Cpu, MemoryStick, HardDrive } from 'lucide-react';
import { useAppStore } from '../stores/app-store.js';

export function StatusBar() {
  const connected = useAppStore((s) => s.connected);
  const deviceName = useAppStore((s) => s.deviceName);
  const systemInfo = useAppStore((s) => s.systemInfo);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  return (
    <div className="h-8 bg-bg-secondary border-t border-border flex items-center justify-between px-4 text-xs text-text-muted">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${connected ? 'bg-success' : 'bg-danger'}`} />
          <span>{connected ? 'Connected' : 'Disconnected'}</span>
        </div>
        {deviceName && (
          <>
            <span className="text-border">|</span>
            <span>{deviceName}</span>
          </>
        )}
        {systemInfo && (
          <>
            <span className="text-border">|</span>
            <span>{systemInfo.platform} {systemInfo.osVersion}</span>
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        {systemInfo && (
          <>
            <div className="flex items-center gap-1">
              <Cpu size={12} />
              <span>{systemInfo.cpu.cores} cores</span>
            </div>
            <div className="flex items-center gap-1">
              <MemoryStick size={12} />
              <span>{systemInfo.memory.usagePercent}%</span>
            </div>
            <div className="flex items-center gap-1">
              <HardDrive size={12} />
              <span>{formatBytes(systemInfo.memory.used)} / {formatBytes(systemInfo.memory.total)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
