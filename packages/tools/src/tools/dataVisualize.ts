export async function dataVisualize(params: { data: Array<{ label: string; value: number }>; type?: 'bar' | 'pie' | 'line' | 'table'; title?: string; width?: number }): Promise<string> {
  const { data, type = 'bar', title, width = 40 } = params;
  if (!Array.isArray(data) || data.length === 0) throw new Error('data array required');

  switch (type) {
    case 'bar': return renderBarChart(data, title, width);
    case 'pie': return renderPieChart(data, title);
    case 'line': return renderLineChart(data, title, width);
    case 'table': return renderTable(data, title);
    default: throw new Error(`Unknown chart type: ${type}`);
  }
}

function renderBarChart(data: Array<{ label: string; value: number }>, title?: string, width = 40): string {
  const max = Math.max(...data.map((d) => d.value));
  const maxLabelLen = Math.max(...data.map((d) => d.label.length));
  const lines: string[] = [];

  if (title) lines.push(`  ${title}`, '');

  for (const item of data) {
    const barLen = max > 0 ? Math.round((item.value / max) * width) : 0;
    const bar = '█'.repeat(barLen);
    lines.push(`  ${item.label.padEnd(maxLabelLen)} │ ${bar} ${item.value}`);
  }

  return lines.join('\n');
}

function renderPieChart(data: Array<{ label: string; value: number }>, title?: string): string {
  const total = data.reduce((s, d) => s + d.value, 0);
  const lines: string[] = [];

  if (title) lines.push(`  ${title}`, '');

  const symbols = ['■', '□', '▪', '▫', '●', '○', '▲', '△'];
  for (let i = 0; i < data.length; i++) {
    const pct = total > 0 ? Math.round((data[i].value / total) * 100) : 0;
    const sym = symbols[i % symbols.length];
    lines.push(`  ${sym} ${data[i].label}: ${data[i].value} (${pct}%)`);
  }

  lines.push(`  ─── Total: ${total}`);
  return lines.join('\n');
}

function renderLineChart(data: Array<{ label: string; value: number }>, title?: string, width = 40): string {
  const max = Math.max(...data.map((d) => d.value));
  const min = Math.min(...data.map((d) => d.value));
  const range = max - min || 1;
  const height = 8;
  const lines: string[] = [];

  if (title) lines.push(`  ${title}`, '');

  const grid: string[][] = Array.from({ length: height }, () => Array(data.length).fill(' '));

  for (let i = 0; i < data.length; i++) {
    const y = Math.round(((data[i].value - min) / range) * (height - 1));
    grid[height - 1 - y][i] = '●';
  }

  for (let row = 0; row < height; row++) {
    const val = max - (row / (height - 1)) * range;
    lines.push(`  ${String(Math.round(val)).padStart(6)} │ ${grid[row].join('')}`);
  }
  lines.push(`  ${''.padStart(6)} └${'─'.repeat(data.length + 1)}`);

  return lines.join('\n');
}

function renderTable(data: Array<{ label: string; value: number }>, title?: string): string {
  const lines: string[] = [];
  if (title) lines.push(`  ${title}`, '');

  const maxLabel = Math.max(5, ...data.map((d) => d.label.length));
  lines.push(`  ${'Label'.padEnd(maxLabel)}  Value`);
  lines.push(`  ${'─'.repeat(maxLabel)}  ─────`);

  for (const item of data) {
    lines.push(`  ${item.label.padEnd(maxLabel)}  ${item.value}`);
  }

  const total = data.reduce((s, d) => s + d.value, 0);
  const avg = data.length > 0 ? Math.round(total / data.length) : 0;
  lines.push(`  ${'─'.repeat(maxLabel)}  ─────`);
  lines.push(`  ${'Total'.padEnd(maxLabel)}  ${total}`);
  lines.push(`  ${'Average'.padEnd(maxLabel)}  ${avg}`);

  return lines.join('\n');
}
