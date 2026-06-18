export async function csvTransform(params: { csv: string; action: 'filter' | 'sort' | 'select' | 'aggregate' | 'pivot'; column?: string; value?: string; columns?: string[]; direction?: 'asc' | 'desc'; groupBy?: string; aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' }): Promise<string> {
  const { csv, action, column, value, columns, direction = 'asc', groupBy, aggregation = 'count' } = params;
  if (!csv) throw new Error('csv data is required');

  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('CSV must have at least a header row and one data row');

  const headers = rows[0];
  const data = rows.slice(1);

  switch (action) {
    case 'filter': {
      if (!column || !value) throw new Error('column and value required for filter');
      const colIdx = headers.indexOf(column);
      if (colIdx === -1) throw new Error(`Column "${column}" not found`);
      const filtered = data.filter((row) => row[colIdx]?.includes(value));
      return formatCsv(headers, filtered);
    }
    case 'sort': {
      if (!column) throw new Error('column required for sort');
      const colIdx = headers.indexOf(column);
      if (colIdx === -1) throw new Error(`Column "${column}" not found`);
      const sorted = [...data].sort((a, b) => {
        const va = a[colIdx] ?? '';
        const vb = b[colIdx] ?? '';
        const cmp = isNaN(Number(va)) ? va.localeCompare(vb) : Number(va) - Number(vb);
        return direction === 'desc' ? -cmp : cmp;
      });
      return formatCsv(headers, sorted);
    }
    case 'select': {
      if (!columns || columns.length === 0) throw new Error('columns required for select');
      const indices = columns.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
      const selectedHeaders = indices.map((i) => headers[i]);
      const selectedData = data.map((row) => indices.map((i) => row[i]));
      return formatCsv(selectedHeaders, selectedData);
    }
    case 'aggregate': {
      if (!groupBy) throw new Error('groupBy required');
      const groupIdx = headers.indexOf(groupBy);
      const valIdx = column ? headers.indexOf(column) : -1;
      if (groupIdx === -1) throw new Error(`Column "${groupBy}" not found`);

      const groups = new Map<string, number[]>();
      for (const row of data) {
        const key = row[groupIdx] ?? '';
        const vals = groups.get(key) ?? [];
        if (valIdx >= 0) vals.push(Number(row[valIdx]) || 0);
        else vals.push(1);
        groups.set(key, vals);
      }

      const result: string[][] = [];
      for (const [key, vals] of groups) {
        let agg: number;
        switch (aggregation) {
          case 'sum': agg = vals.reduce((s, v) => s + v, 0); break;
          case 'avg': agg = vals.reduce((s, v) => s + v, 0) / vals.length; break;
          case 'min': agg = Math.min(...vals); break;
          case 'max': agg = Math.max(...vals); break;
          default: agg = vals.length;
        }
        result.push([key, String(Math.round(agg * 100) / 100)]);
      }
      return formatCsv([groupBy, `${aggregation}(${column ?? 'count'})`], result);
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}

function parseCsv(csv: string): string[][] {
  return csv.trim().split('\n').map((line) => line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')));
}

function formatCsv(headers: string[], data: string[][]): string {
  const lines = [headers.join(','), ...data.map((row) => row.join(','))];
  return lines.join('\n');
}
