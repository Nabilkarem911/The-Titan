export async function xmlParse(params: { xml: string; xpath?: string; action?: 'parse' | 'to_json' | 'extract' }): Promise<string> {
  const { xml, xpath, action = 'parse' } = params;
  if (!xml) throw new Error('xml is required');

  switch (action) {
    case 'to_json': return JSON.stringify(xmlToJson(xml));
    case 'extract': {
      if (!xpath) throw new Error('xpath required for extract');
      return JSON.stringify(extractByTag(xml, xpath));
    }
    case 'parse':
    default: {
      const tags = countTags(xml);
      const root = xml.match(/<(\w+)[^>]*>/)?.[1] ?? 'unknown';
      return JSON.stringify({ rootElement: root, totalTags: Object.values(tags).reduce((s, v) => s + v, 0), tagCounts: tags, wellFormed: isWellFormed(xml) });
    }
  }
}

function xmlToJson(xml: string): unknown {
  const result: Record<string, unknown> = {};
  const tagRegex = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = tagRegex.exec(xml)) !== null) {
    const [, tag, , content] = match;
    const inner = content.trim();
    if (inner.includes('<')) result[tag] = xmlToJson(inner);
    else result[tag] = inner;
  }
  return Object.keys(result).length > 0 ? result : xml.replace(/<[^>]+>/g, '').trim();
}

function extractByTag(xml: string, tag: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  let match;
  while ((match = regex.exec(xml)) !== null) results.push(match[1].trim());
  return results;
}

function countTags(xml: string): Record<string, number> {
  const tags: Record<string, number> = {};
  const regex = /<(\w+)[^>]*>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) { tags[match[1]] = (tags[match[1]] ?? 0) + 1; }
  return tags;
}

function isWellFormed(xml: string): boolean {
  const stack: string[] = [];
  const regex = /<\/?(\w+)[^>]*\/?>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    const tag = match[1];
    if (match[0].startsWith('</')) { if (stack.pop() !== tag) return false; }
    else if (!match[0].endsWith('/>')) stack.push(tag);
  }
  return stack.length === 0;
}
