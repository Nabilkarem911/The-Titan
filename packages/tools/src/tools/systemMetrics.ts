import { cpus, totalmem, freemem, uptime, hostname, platform, arch } from 'node:os';

export async function systemMetrics(params: { type?: 'all' | 'cpu' | 'memory' | 'system' }): Promise<string> {
  const { type = 'all' } = params;
  const result: Record<string, unknown> = {};

  if (type === 'all' || type === 'cpu') {
    const cpuList = cpus();
    const avgLoad = cpuList.reduce((s, c) => {
      const total = Object.values(c.times).reduce((a, b) => a + b, 0);
      return s + (1 - c.times.idle / total);
    }, 0) / cpuList.length;

    result.cpu = {
      cores: cpuList.length,
      model: cpuList[0]?.model,
      speedMhz: cpuList[0]?.speed,
      usagePercent: Math.round(avgLoad * 100),
    };
  }

  if (type === 'all' || type === 'memory') {
    const total = totalmem();
    const free = freemem();
    const used = total - free;
    const processMemory = process.memoryUsage();

    result.memory = {
      totalMb: Math.round(total / 1024 / 1024),
      usedMb: Math.round(used / 1024 / 1024),
      freeMb: Math.round(free / 1024 / 1024),
      usagePercent: Math.round((used / total) * 100),
      processHeapMb: Math.round(processMemory.heapUsed / 1024 / 1024),
      processRssMb: Math.round(processMemory.rss / 1024 / 1024),
    };
  }

  if (type === 'all' || type === 'system') {
    result.system = {
      hostname: hostname(),
      platform: platform(),
      arch: arch(),
      nodeVersion: process.version,
      uptimeSeconds: Math.round(uptime()),
      uptimeHuman: formatUptime(uptime()),
      pid: process.pid,
    };
  }

  return JSON.stringify(result);
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(' ');
}
