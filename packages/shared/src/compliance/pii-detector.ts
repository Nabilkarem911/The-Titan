export interface PIIMatch {
  type: 'email' | 'phone' | 'ssn' | 'credit_card' | 'ip_address' | 'api_key' | 'password';
  value: string;
  start: number;
  end: number;
}

const PII_PATTERNS: Array<{ type: PIIMatch['type']; regex: RegExp }> = [
  { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
  { type: 'phone', regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
  { type: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: 'credit_card', regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
  { type: 'ip_address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
  { type: 'api_key', regex: /\b(?:sk|pk|tk|api)[_-][a-zA-Z0-9]{20,}\b/g },
  { type: 'password', regex: /(?:password|passwd|pwd)\s*[:=]\s*["']?([^\s"']+)/gi },
];

export class PIIDetector {
  detect(text: string): PIIMatch[] {
    const matches: PIIMatch[] = [];

    for (const { type, regex } of PII_PATTERNS) {
      const re = new RegExp(regex.source, regex.flags);
      let match;
      while ((match = re.exec(text)) !== null) {
        matches.push({ type, value: match[0], start: match.index, end: match.index + match[0].length });
      }
    }

    return matches;
  }

  redact(text: string, replacement = '***'): { redacted: string; count: number } {
    const matches = this.detect(text);
    if (matches.length === 0) return { redacted: text, count: 0 };

    let redacted = text;
    // Process from end to preserve indices
    for (const match of matches.sort((a, b) => b.start - a.start)) {
      redacted = redacted.slice(0, match.start) + `[${match.type}:${replacement}]` + redacted.slice(match.end);
    }

    return { redacted, count: matches.length };
  }

  hasPII(text: string): boolean {
    return this.detect(text).length > 0;
  }

  getSummary(text: string): Record<string, number> {
    const matches = this.detect(text);
    const summary: Record<string, number> = {};
    for (const m of matches) {
      summary[m.type] = (summary[m.type] ?? 0) + 1;
    }
    return summary;
  }
}
