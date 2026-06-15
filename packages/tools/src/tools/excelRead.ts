import * as XLSX from 'xlsx';
import { readFileSync, existsSync } from 'node:fs';

export interface ExcelReadResult {
  sheets: string[];
  data: Record<string, unknown[][]>;
  rowCounts: Record<string, number>;
}

export async function excelRead(params: { path: string; sheet?: string }): Promise<ExcelReadResult> {
  const { path, sheet } = params;

  if (!existsSync(path)) {
    throw new Error(`File not found: ${path}`);
  }

  const buffer = readFileSync(path);
  const workbook = XLSX.read(buffer, { type: 'buffer' });

  const sheets = workbook.SheetNames;
  const targetSheets = sheet ? [sheet] : sheets;

  const data: Record<string, unknown[][]> = {};
  const rowCounts: Record<string, number> = {};

  for (const name of targetSheets) {
    if (!workbook.Sheets[name]) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1 });
    data[name] = rows;
    rowCounts[name] = rows.length;
  }

  return { sheets, data, rowCounts };
}
