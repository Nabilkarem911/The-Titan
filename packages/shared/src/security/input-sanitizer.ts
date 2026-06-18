export class InputSanitizer {
  sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, (c) => c === '<' ? '&lt;' : '&gt;')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/data:\s*text\/html/gi, '');
  }

  sanitizeSql(input: string): string {
    return input
      .replace(/['";\\]/g, '')
      .replace(/--/g, '')
      .replace(/\/\*/g, '')
      .replace(/\*\//g, '')
      .replace(/\b(DROP|DELETE|TRUNCATE|ALTER|EXEC|EXECUTE|INSERT|UPDATE)\b/gi, '[BLOCKED]');
  }

  sanitizeCommand(input: string): string {
    return input
      .replace(/[;&|`$(){}]/g, '')
      .replace(/\.\.\//g, '')
      .replace(/~\//g, '');
  }

  sanitizePath(input: string): string {
    return input
      .replace(/\.\.\//g, '')
      .replace(/\/etc\//g, '[BLOCKED]/')
      .replace(/\/proc\//g, '[BLOCKED]/')
      .replace(/~\//g, '');
  }

  sanitizeUrl(input: string): { safe: boolean; url: string; reason?: string } {
    try {
      const url = new URL(input);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return { safe: false, url: input, reason: `Blocked protocol: ${url.protocol}` };
      }
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname.startsWith('192.168.') || url.hostname.startsWith('10.') || url.hostname.startsWith('172.')) {
        return { safe: false, url: input, reason: 'Internal/private IP blocked (SSRF prevention)' };
      }
      return { safe: true, url: input };
    } catch {
      return { safe: false, url: input, reason: 'Invalid URL' };
    }
  }

  detectInjection(input: string): { safe: boolean; threats: string[] } {
    const threats: string[] = [];
    if (input.match(/<script/i)) threats.push('XSS: script tag');
    if (input.match(/['"];\s*(DROP|DELETE|SELECT)/i)) threats.push('SQL injection');
    if (input.match(/[;&|`$]/)) threats.push('Command injection characters');
    if (input.match(/\.\.\//)) threats.push('Path traversal');
    if (input.match(/javascript:/i)) threats.push('JavaScript URI');
    return { safe: threats.length === 0, threats };
  }
}
