import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-parse-csv-json' });

function parseCsv(content: string): Record<string, string>[] {
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return [];
  const headers = lines[0]!.split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']));
  });
}

export async function parseCsvJson(input: {
  content: string;
  format: 'csv' | 'json' | 'auto';
  query?: string;
  limit?: number;
}): Promise<{ format: string; rows?: unknown[]; data?: unknown; count?: number; summary?: string }> {
  const { content, format, query, limit = 100 } = input;
  log.info({ format, contentLength: content.length }, 'parsing data');

  const detected = format === 'auto'
    ? (content.trimStart().startsWith('{') || content.trimStart().startsWith('[') ? 'json' : 'csv')
    : format;

  if (detected === 'json') {
    const data: unknown = JSON.parse(content);
    if (Array.isArray(data)) {
      const rows = data.slice(0, limit) as unknown[];
      return { format: 'json', rows, count: data.length, summary: `Array with ${data.length} items, showing ${rows.length}` };
    }
    return { format: 'json', data, summary: 'JSON object' };
  }

  const rows = parseCsv(content).slice(0, limit);
  const totalLines = content.trim().split(/\r?\n/).length - 1;

  if (query) {
    const q = query.toLowerCase();
    const filtered = rows.filter((r) =>
      Object.values(r).some((v) => String(v).toLowerCase().includes(q))
    );
    return { format: 'csv', rows: filtered, count: filtered.length, summary: `Filtered ${filtered.length} rows matching "${query}"` };
  }

  return { format: 'csv', rows, count: totalLines, summary: `CSV with ${totalLines} rows, showing ${rows.length}` };
}
