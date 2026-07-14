interface FileValidationResult {
  valid: boolean;
  errors: string[];
  mimeType?: string;
  sizeMb: number;
}

const ALLOWED_MIMES = new Set([
  'text/plain', 'text/csv', 'text/html', 'text/markdown',
  'application/json', 'application/xml', 'application/pdf',
  'application/zip', 'application/gzip',
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'audio/mpeg', 'audio/wav', 'video/mp4',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const DANGEROUS_EXTENSIONS = new Set(['.exe', '.bat', '.cmd', '.sh', '.ps1', '.vbs', '.msi', '.dll', '.so', '.dylib']);
const MAX_SIZE_MB = 50;

export class FileValidator {
  validate(filename: string, sizeBytes: number, mimeType?: string): FileValidationResult {
    const errors: string[] = [];
    const sizeMb = Math.round((sizeBytes / 1024 / 1024) * 100) / 100;
    const ext = ('.' + (filename.split('.').pop() ?? '')).toLowerCase();

    if (sizeMb > MAX_SIZE_MB) errors.push(`File too large: ${sizeMb}MB (max ${MAX_SIZE_MB}MB)`);
    if (DANGEROUS_EXTENSIONS.has(ext)) errors.push(`Dangerous file extension: ${ext}`);
    if (mimeType && !ALLOWED_MIMES.has(mimeType)) errors.push(`Disallowed MIME type: ${mimeType}`);
    if (filename.includes('..')) errors.push('Path traversal in filename');
    if (filename.match(/[<>:"|?*\x00-\x1f]/)) errors.push('Invalid characters in filename');

    return { valid: errors.length === 0, errors, mimeType, sizeMb };
  }

  isAllowedMime(mime: string): boolean {
    return ALLOWED_MIMES.has(mime);
  }

  sanitizeFilename(filename: string): string {
    return filename.replace(/[<>:"|?*\x00-\x1f\\\/]/g, '_').replace(/\.\./g, '_').slice(0, 255);
  }
}
