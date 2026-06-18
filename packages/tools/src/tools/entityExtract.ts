export async function entityExtract(params: { text: string; types?: string[] }): Promise<string> {
  const { text, types } = params;
  if (!text) throw new Error('text is required');

  const entities: Array<{ text: string; type: string; start: number }> = [];

  const patterns: Array<{ type: string; regex: RegExp }> = [
    { type: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g },
    { type: 'url', regex: /https?:\/\/[^\s<>"{}|\\^`[\]]+/g },
    { type: 'phone', regex: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g },
    { type: 'date', regex: /\b\d{4}[-/]\d{2}[-/]\d{2}\b|\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g },
    { type: 'money', regex: /\$[\d,]+(?:\.\d{2})?|\b\d+(?:,\d{3})*(?:\.\d{2})?\s*(?:USD|EUR|GBP|SAR|EGP|AED)\b/gi },
    { type: 'percentage', regex: /\b\d+(?:\.\d+)?%/g },
    { type: 'ip_address', regex: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
    { type: 'version', regex: /v?\d+\.\d+\.\d+/g },
    { type: 'hashtag', regex: /#\w{2,}/g },
    { type: 'mention', regex: /@\w{2,}/g },
    { type: 'file_path', regex: /(?:\/[\w.-]+){2,}|[\w.-]+\.(?:ts|js|py|go|rs|java|json|yaml|md|sql|csv)\b/g },
    { type: 'person', regex: /\b[A-Z][a-z]+\s[A-Z][a-z]+\b/g },
    { type: 'organization', regex: /\b(?:Inc|Corp|LLC|Ltd|Co|Company|Foundation|Institute|University)\b/g },
  ];

  for (const { type, regex } of patterns) {
    if (types && !types.includes(type)) continue;
    const re = new RegExp(regex.source, regex.flags);
    let match;
    while ((match = re.exec(text)) !== null) {
      entities.push({ text: match[0], type, start: match.index });
    }
  }

  entities.sort((a, b) => a.start - b.start);
  const byType: Record<string, string[]> = {};
  for (const e of entities) {
    if (!byType[e.type]) byType[e.type] = [];
    if (!byType[e.type].includes(e.text)) byType[e.type].push(e.text);
  }

  return JSON.stringify({ totalEntities: entities.length, uniqueTypes: Object.keys(byType).length, byType, entities: entities.slice(0, 50) });
}
