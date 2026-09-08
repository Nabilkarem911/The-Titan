import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { randomUUID } from 'node:crypto';
import type { LlmProvider } from '../types.js';

const log = getLogger().child({ component: 'advanced-multimodal' });

interface PDFTable {
  id: string;
  page: number;
  rows: string[][];
  headers: string[];
  confidence: number;
}

interface CodeFromImage {
  id: string;
  language: string;
  code: string;
  confidence: number;
  formatted: boolean;
}

interface DiagramToCode {
  id: string;
  diagramType: string;
  generatedCode: string;
  language: string;
  confidence: number;
}

interface ChartData {
  id: string;
  chartType: string;
  data: Array<{ label: string; value: number }>;
  confidence: number;
}

const PDF_TABLE_PROMPT = `Extract tables from the PDF content. Respond in JSON:
{"tables": [{"page": 1, "headers": ["col1"], "rows": [["val1"]], "confidence": 0.0-1.0}]}`;

const CODE_OCR_PROMPT = `You are a code OCR engine. Extract code from a screenshot description. Respond in JSON:
{"language": "typescript|python|rust|...", "code": "the extracted code", "confidence": 0.0-1.0}`;

const DIAGRAM_PROMPT = `You are a diagram-to-code converter. Convert a whiteboard/diagram description into code. Respond in JSON:
{"diagramType": "flowchart|class_diagram|er_diagram|...", "generatedCode": "the code", "language": "typescript|mermaid|...", "confidence": 0.0-1.0}`;

const CHART_PROMPT = `You are a chart understanding engine. Extract data from a chart description. Respond in JSON:
{"chartType": "bar|line|pie|scatter|...", "data": [{"label": "...", "value": 0}], "confidence": 0.0-1.0}`;

export class AdvancedMultimodal {
  private llm: LlmProvider;

  constructor(llm: LlmProvider) {
    this.llm = llm;
  }

  async extractPDFTables(pdfText: string): Promise<PDFTable[]> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: PDF_TABLE_PROMPT },
        { role: 'user', content: `PDF content:\n${pdfText.slice(0, 4000)}` },
      ], { temperature: 0.1, maxTokens: 2000 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]);
      const tables: PDFTable[] = Array.isArray(parsed.tables) ? parsed.tables.map((t: Record<string, unknown>) => ({
        id: randomUUID(),
        page: Number(t.page ?? 1),
        headers: Array.isArray(t.headers) ? t.headers.map(String) : [],
        rows: Array.isArray(t.rows) ? (t.rows as unknown[]).map((r: unknown) => Array.isArray(r) ? r.map(String) : []) : [],
        confidence: Math.max(0, Math.min(1, Number(t.confidence ?? 0.5))),
      })) : [];

      incCounter('pdf_tables_extracted', 'PDF tables extracted', tables.length);
      return tables;
    } catch (err) {
      log.error({ err }, 'PDF table extraction failed');
      return [];
    }
  }

  async codeFromScreenshot(imageDescription: string): Promise<CodeFromImage> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: CODE_OCR_PROMPT },
        { role: 'user', content: `Screenshot description: ${imageDescription}` },
      ], { temperature: 0.1, maxTokens: 2000 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let language = 'unknown';
      let code = '';
      let confidence = 0;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        language = parsed.language ?? 'unknown';
        code = parsed.code ?? '';
        confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
      }

      const result: CodeFromImage = {
        id: randomUUID(),
        language,
        code,
        confidence,
        formatted: confidence > 0.5,
      };

      incCounter('code_from_screenshot', 'Code extracted from screenshots', 1);
      return result;
    } catch (err) {
      log.error({ err }, 'code OCR failed');
      return { id: randomUUID(), language: 'unknown', code: '', confidence: 0, formatted: false };
    }
  }

  async diagramToCode(diagramDescription: string): Promise<DiagramToCode> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: DIAGRAM_PROMPT },
        { role: 'user', content: `Diagram description: ${diagramDescription}` },
      ], { temperature: 0.2, maxTokens: 2000 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let diagramType = 'unknown';
      let generatedCode = '';
      let language = 'mermaid';
      let confidence = 0;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        diagramType = parsed.diagramType ?? 'unknown';
        generatedCode = parsed.generatedCode ?? '';
        language = parsed.language ?? 'mermaid';
        confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
      }

      const result: DiagramToCode = {
        id: randomUUID(),
        diagramType,
        generatedCode,
        language,
        confidence,
      };

      incCounter('diagram_to_code', 'Diagrams converted to code', 1);
      return result;
    } catch (err) {
      log.error({ err }, 'diagram to code failed');
      return { id: randomUUID(), diagramType: 'unknown', generatedCode: '', language: 'mermaid', confidence: 0 };
    }
  }

  async understandChart(chartDescription: string): Promise<ChartData> {
    try {
      const completion = await this.llm.complete([
        { role: 'system', content: CHART_PROMPT },
        { role: 'user', content: `Chart description: ${chartDescription}` },
      ], { temperature: 0.1, maxTokens: 1000 });

      const jsonMatch = completion.content.match(/\{[\s\S]*\}/);
      let chartType = 'unknown';
      let data: Array<{ label: string; value: number }> = [];
      let confidence = 0;

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        chartType = parsed.chartType ?? 'unknown';
        data = Array.isArray(parsed.data) ? parsed.data.map((d: Record<string, unknown>) => ({
          label: String(d.label ?? ''),
          value: Number(d.value ?? 0),
        })) : [];
        confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5));
      }

      const result: ChartData = {
        id: randomUUID(),
        chartType,
        data,
        confidence,
      };

      incCounter('chart_understanding', 'Charts understood', 1);
      return result;
    } catch (err) {
      log.error({ err }, 'chart understanding failed');
      return { id: randomUUID(), chartType: 'unknown', data: [], confidence: 0 };
    }
  }
}
