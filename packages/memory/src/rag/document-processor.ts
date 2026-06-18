import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'document-processor' });

export interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  metadata: {
    source: string;
    page?: number;
    section?: string;
    type: 'text' | 'code' | 'table' | 'heading';
  };
}

export interface ProcessedDocument {
  id: string;
  name: string;
  type: string;
  chunks: DocumentChunk[];
  totalChunks: number;
  totalChars: number;
  processedAt: Date;
}

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

export class DocumentProcessor {
  processText(text: string, name: string, source = 'upload'): ProcessedDocument {
    const docId = randomUUID();
    const chunks = this.semanticChunk(text, docId, source);

    log.info({ name, chunks: chunks.length, chars: text.length }, 'document processed');

    return {
      id: docId,
      name,
      type: 'text',
      chunks,
      totalChunks: chunks.length,
      totalChars: text.length,
      processedAt: new Date(),
    };
  }

  processMarkdown(markdown: string, name: string): ProcessedDocument {
    const docId = randomUUID();
    const chunks: DocumentChunk[] = [];

    // Split by headings for semantic sections
    const sections = markdown.split(/^(#{1,3}\s.+)$/m);
    let currentSection = '';
    let chunkIndex = 0;

    for (const section of sections) {
      if (section.match(/^#{1,3}\s/)) {
        currentSection = section.replace(/^#+\s*/, '').trim();
        continue;
      }

      const text = section.trim();
      if (!text) continue;

      // Detect code blocks
      const codeBlocks = text.match(/```[\s\S]*?```/g) ?? [];
      const textParts = text.split(/```[\s\S]*?```/);

      for (const part of textParts) {
        if (part.trim()) {
          for (const subChunk of this.splitChunk(part.trim())) {
            chunks.push({
              id: randomUUID(),
              documentId: docId,
              content: subChunk,
              index: chunkIndex++,
              metadata: { source: name, section: currentSection, type: 'text' },
            });
          }
        }
      }

      for (const code of codeBlocks) {
        chunks.push({
          id: randomUUID(),
          documentId: docId,
          content: code,
          index: chunkIndex++,
          metadata: { source: name, section: currentSection, type: 'code' },
        });
      }
    }

    return { id: docId, name, type: 'markdown', chunks, totalChunks: chunks.length, totalChars: markdown.length, processedAt: new Date() };
  }

  private semanticChunk(text: string, docId: string, source: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const paragraphs = text.split(/\n\s*\n/);
    let buffer = '';
    let index = 0;

    for (const para of paragraphs) {
      if (buffer.length + para.length > CHUNK_SIZE && buffer.length > 0) {
        chunks.push({
          id: randomUUID(),
          documentId: docId,
          content: buffer.trim(),
          index: index++,
          metadata: { source, type: 'text' },
        });
        buffer = buffer.slice(-CHUNK_OVERLAP);
      }
      buffer += (buffer ? '\n\n' : '') + para;
    }

    if (buffer.trim()) {
      chunks.push({
        id: randomUUID(),
        documentId: docId,
        content: buffer.trim(),
        index: index++,
        metadata: { source, type: 'text' },
      });
    }

    return chunks;
  }

  private splitChunk(text: string): string[] {
    if (text.length <= CHUNK_SIZE) return [text];

    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + CHUNK_SIZE, text.length);
      chunks.push(text.slice(start, end));
      start = end - CHUNK_OVERLAP;
    }

    return chunks;
  }
}
