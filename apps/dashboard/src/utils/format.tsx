import {
  File,
  FileCode,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(name: string, className = 'h-5 w-5') {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['ts', 'tsx', 'js', 'jsx', 'py', 'go', 'rs', 'java', 'cpp', 'c', 'html', 'css', 'json'].includes(ext)) {
    return <FileCode className={`${className} text-blue-400`} />;
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico'].includes(ext)) {
    return <ImageIcon className={`${className} text-purple-400`} />;
  }
  if (['md', 'txt', 'log', 'env', 'yml', 'yaml', 'toml'].includes(ext)) {
    return <FileText className={`${className} text-emerald-400`} />;
  }
  return <File className={`${className} text-slate-400`} />;
}
