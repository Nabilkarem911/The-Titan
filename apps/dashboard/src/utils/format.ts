export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
}

export function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const iconMap: Record<string, string> = {
    ts: 'FileCode2',
    tsx: 'FileCode2',
    js: 'FileCode2',
    jsx: 'FileCode2',
    py: 'FileCode2',
    rs: 'FileCode2',
    go: 'FileCode2',
    json: 'FileJson',
    yaml: 'FileText',
    yml: 'FileText',
    toml: 'FileText',
    md: 'FileText',
    txt: 'FileText',
    log: 'FileText',
    csv: 'FileSpreadsheet',
    png: 'FileImage',
    jpg: 'FileImage',
    jpeg: 'FileImage',
    gif: 'FileImage',
    svg: 'FileImage',
    webp: 'FileImage',
    mp4: 'FileVideo',
    webm: 'FileVideo',
    mp3: 'FileAudio',
    wav: 'FileAudio',
    zip: 'FileArchive',
    tar: 'FileArchive',
    gz: 'FileArchive',
    pdf: 'FileText',
    html: 'FileCode2',
    css: 'FileCode2',
    sql: 'Database',
    sh: 'Terminal',
    bash: 'Terminal',
    dockerfile: 'Container',
  };
  return iconMap[ext] || 'File';
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(date);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const min = Math.floor(sec / 60);
  const remSec = Math.floor(sec % 60);
  if (min < 60) return `${min}m ${remSec}s`;
  const hr = Math.floor(min / 60);
  const remMin = min % 60;
  return `${hr}h ${remMin}m`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

export function classNames(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
