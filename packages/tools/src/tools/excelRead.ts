import ExcelJS from 'exceljs';
import { readFileSync, existsSync } from 'node:fs';
import { validateCwd } from '../sandbox.js';

export interface ExcelReadResult {
  sheets: string[];
  data: Record<string, unknown[][]>;
  rowCounts: Record<string, number>;
}

export async function excelRead(params: { path: string; sheet?: string }): Promise<ExcelReadResult> {
  const { path, sheet } = params;
  validateCwd(path);

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const buffer = readFileSync(path);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);

  const sheets = workbook.worksheets.map(ws => ws.name);
  const targetSheets = sheet ? [sheet] : sheets;

  const data: Record<string, unknown[][]> = {};
  const rowCounts: Record<string, number> = {};

  for (const name of targetSheets) {
    const ws = workbook.getWorksheet(name);
    if (!ws) continue;
    const rows: unknown[][] = [];
    for (let i = 1; i <= ws.rowCount; i++) {
      const row = ws.getRow(i);
      rows.push((row.values ?? []).slice(1) as unknown[]);
    }
    data[name] = rows;
    rowCounts[name] = rows.length;
  }

  return { sheets, data, rowCounts };
}
