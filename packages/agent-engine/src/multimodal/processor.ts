import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { readFileSync, existsSync } from 'node:fs';
import { extname, basename } from 'node:path';

const log = getLogger().child({ component: 'multimodal-processor' });

interface ImageAnalysis {
  filePath: string;
  description: string;
  extractedText?: string;
  objects: string[];
  colors: string[];
  dimensions?: { width: number; height: number };
  format: string;
  analysisType: 'screenshot' | 'diagram' | 'photo' | 'document' | 'chart' | 'unknown';
  confidence: number;
}

interface PdfAnalysis {
  filePath: string;
  pageCount: number;
  extractedText: string;
  summary: string;
  keyPoints: string[];
  language: string;
  documentType: 'invoice' | 'report' | 'article' | 'contract' | 'manual' | 'unknown';
}

interface MultimodalResult {
  type: 'image' | 'pdf' | 'unsupported';
  analysis?: ImageAnalysis | PdfAnalysis;
  error?: string;
}

const SUPPORTED_IMAGE_FORMATS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
const SUPPORTED_PDF_FORMATS = ['.pdf'];

class MultimodalProcessor {
  private visionEnabled: boolean;

  constructor(
    private visionProvider?: {
      analyzeImage: (base64: string, mimeType: string) => Promise<string>;
      analyzePdf?: (base64: string) => Promise<string>;
    },
  ) {
    this.visionEnabled = !!visionProvider;
  }

  async analyzeFile(filePath: string): Promise<MultimodalResult> {
    if (!existsSync(filePath)) {
      return { type: 'unsupported', error: `File not found: ${filePath}` };
    }

    const ext = extname(filePath).toLowerCase();
    const name = basename(filePath);

    if (SUPPORTED_IMAGE_FORMATS.includes(ext)) {
      return this.analyzeImage(filePath);
    }

    if (SUPPORTED_PDF_FORMATS.includes(ext)) {
      return this.analyzePdf(filePath);
    }

    return { type: 'unsupported', error: `Unsupported format: ${ext}` };
  }

  async analyzeImage(filePath: string): Promise<MultimodalResult> {
    const ext = extname(filePath).toLowerCase();
    const format = ext.slice(1);
    incCounter('multimodal_image', 'Images analyzed', 1);

    try {
      const buffer = readFileSync(filePath);
      const base64 = buffer.toString('base64');
      const mimeType = this.getMimeType(ext);

      if (this.visionEnabled && this.visionProvider) {
        const description = await this.visionProvider.analyzeImage(base64, mimeType);
        const analysis = this.parseImageDescription(filePath, description, format);
        log.info({ filePath, type: analysis.analysisType, confidence: analysis.confidence }, 'image analyzed via vision model');
        return { type: 'image', analysis };
      }

      // Fallback: basic file info without vision model
      const analysis: ImageAnalysis = {
        filePath,
        description: `Image file: ${basename(filePath)} (${format.toUpperCase()}, ${buffer.length} bytes)`,
        objects: [],
        colors: [],
        format,
        analysisType: 'unknown',
        confidence: 0,
      };
      log.info({ filePath }, 'image analyzed (no vision model — basic info only)');
      return { type: 'image', analysis };
    } catch (err) {
      log.error({ err, filePath }, 'image analysis failed');
      return { type: 'image', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  async analyzePdf(filePath: string): Promise<MultimodalResult> {
    incCounter('multimodal_pdf', 'PDFs analyzed', 1);

    try {
      const buffer = readFileSync(filePath);
      const base64 = buffer.toString('base64');

      if (this.visionProvider?.analyzePdf) {
        const content = await this.visionProvider.analyzePdf(base64);
        const analysis = this.parsePdfContent(filePath, content);
        log.info({ filePath, pages: analysis.pageCount, type: analysis.documentType }, 'PDF analyzed via vision model');
        return { type: 'pdf', analysis };
      }

      // Fallback: try to extract text from PDF (basic — looks for text streams)
      const extractedText = this.extractPdfTextBasic(buffer);
      const analysis: PdfAnalysis = {
        filePath,
        pageCount: this.estimatePdfPages(buffer),
        extractedText,
        summary: extractedText.slice(0, 500),
        keyPoints: [],
        language: this.detectLanguage(extractedText),
        documentType: 'unknown',
      };
      log.info({ filePath, pages: analysis.pageCount }, 'PDF analyzed (basic extraction)');
      return { type: 'pdf', analysis };
    } catch (err) {
      log.error({ err, filePath }, 'PDF analysis failed');
      return { type: 'pdf', error: err instanceof Error ? err.message : 'Unknown error' };
    }
  }

  isVisionEnabled(): boolean {
    return this.visionEnabled;
  }

  getSupportedFormats(): { images: string[]; pdfs: string[] } {
    return { images: SUPPORTED_IMAGE_FORMATS, pdfs: SUPPORTED_PDF_FORMATS };
  }

  private parseImageDescription(filePath: string, description: string, format: string): ImageAnalysis {
    const lower = description.toLowerCase();

    let analysisType: ImageAnalysis['analysisType'] = 'unknown';
    if (lower.includes('screenshot')) analysisType = 'screenshot';
    else if (lower.includes('diagram') || lower.includes('flowchart')) analysisType = 'diagram';
    else if (lower.includes('chart') || lower.includes('graph')) analysisType = 'chart';
    else if (lower.includes('document') || lower.includes('text')) analysisType = 'document';
    else if (lower.includes('photo') || lower.includes('image')) analysisType = 'photo';

    // Extract objects (simple heuristic)
    const objects: string[] = [];
    const objectMatch = description.match(/objects?:\s*(.+)/i);
    if (objectMatch) {
      objects.push(...objectMatch[1].split(',').map((s) => s.trim()).slice(0, 10));
    }

    // Extract text if mentioned
    let extractedText: string | undefined;
    const textMatch = description.match(/text[:\s]+["']?([^"'\n]+)["']?/i);
    if (textMatch) {
      extractedText = textMatch[1].trim();
    }

    return {
      filePath,
      description,
      extractedText,
      objects,
      colors: [],
      format,
      analysisType,
      confidence: 75,
    };
  }

  private parsePdfContent(filePath: string, content: string): PdfAnalysis {
    const pageBreaks = content.match(/\f/g);
    const pageCount = pageBreaks ? pageBreaks.length + 1 : 1;

    let documentType: PdfAnalysis['documentType'] = 'unknown';
    const lower = content.toLowerCase();
    if (lower.includes('invoice') || lower.includes('amount due')) documentType = 'invoice';
    else if (lower.includes('report') || lower.includes('findings')) documentType = 'report';
    else if (lower.includes('abstract') || lower.includes('introduction')) documentType = 'article';
    else if (lower.includes('agreement') || lower.includes('party')) documentType = 'contract';
    else if (lower.includes('manual') || lower.includes('instructions')) documentType = 'manual';

    // Extract key points (lines starting with bullet points or numbers)
    const keyPoints = content
      .split('\n')
      .filter((l) => /^[\d•\-\*]/.test(l.trim()))
      .map((l) => l.trim().replace(/^[\d•\-\*]+\s*/, ''))
      .filter((l) => l.length > 10)
      .slice(0, 10);

    return {
      filePath,
      pageCount,
      extractedText: content.slice(0, 5000),
      summary: content.slice(0, 500),
      keyPoints,
      language: this.detectLanguage(content),
      documentType,
    };
  }

  private extractPdfTextBasic(buffer: Buffer): string {
    // Very basic PDF text extraction — finds text in parentheses between BT/ET markers
    const content = buffer.toString('latin1');
    const textMatches: string[] = [];
    const regex = /\(([^)]+)\)/g;
    let match: RegExpExecArray | null;
    let count = 0;
    while ((match = regex.exec(content)) !== null && count < 500) {
      const text = match[1];
      // Filter out non-text content
      if (/^[\x20-\x7E]+$/.test(text) && text.trim().length > 1) {
        textMatches.push(text);
        count++;
      }
    }
    return textMatches.join(' ');
  }

  private estimatePdfPages(buffer: Buffer): number {
    const content = buffer.toString('latin1');
    const pageMatches = content.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  }

  private detectLanguage(text: string): string {
    if (/[\u0600-\u06FF]/.test(text)) return 'ar';
    if (/[\u4e00-\u9fff]/.test(text)) return 'zh';
    if (/[\u3040-\u309f\u30a0-\u30ff]/.test(text)) return 'ja';
    if (/[\uac00-\ud7af]/.test(text)) return 'ko';
    return 'en';
  }

  private getMimeType(ext: string): string {
    const map: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.bmp': 'image/bmp',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}

let globalProcessor: MultimodalProcessor | null = null;

export function getMultimodalProcessor(): MultimodalProcessor {
  if (!globalProcessor) {
    globalProcessor = new MultimodalProcessor();
  }
  return globalProcessor;
}
