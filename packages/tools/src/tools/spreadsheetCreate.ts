export async function spreadsheetCreate(params: { data: unknown[][]; headers?: string[]; format?: 'csv' | 'tsv'; title?: string }): Promise<string> {
  const { data, headers, format = 'csv', title } = params;
  if (!Array.isArray(data)) throw new Error('data must be a 2D array');

  const separator = format === 'tsv' ? '\t' : ',';
  const lines: string[] = [];

  if (headers) {
    lines.push(headers.map((h) => escapeCsvField(h, separator)).join(separator));
  }

  for (const row of data) {
    if (Array.isArray(row)) {
      lines.push(row.map((cell) => escapeCsvField(String(cell ?? ''), separator)).join(separator));
    }
  }

  const content = lines.join('\n');
  return JSON.stringify({ success: true, content, format, rows: data.length, columns: headers?.length ?? (data[0] as unknown[])?.length ?? 0, title });
}

function escapeCsvField(field: string, separator: string): string {
  if (field.includes(separator) || field.includes('"') || field.includes('\n')) {
    return `"${field.replace(/"/g, '""')}"`;
  }
  return field;
}
