import { getLogger } from '@titan/logging';
import { DocumentProcessor, type ProcessedDocument, type DocumentChunk } from './document-processor.js';

const log = getLogger().child({ component: 'knowledge-base' });

export interface KBSearchResult {
  chunk: DocumentChunk;
  score: number;
  documentName: string;
  citation: string;
}

export class KnowledgeBase {
  private documents: Map<string, ProcessedDocument> = new Map();
  private processor: DocumentProcessor;

  constructor() {
    this.processor = new DocumentProcessor();
  }

  addDocument(text: string, name: string, type: 'text' | 'markdown' = 'text'): ProcessedDocument {
    const doc = type === 'markdown'
      ? this.processor.processMarkdown(text, name)
      : this.processor.processText(text, name);

    this.documents.set(doc.id, doc);
    log.info({ docId: doc.id, name, chunks: doc.totalChunks }, 'document added to knowledge base');
    return doc;
  }

  removeDocument(docId: string): boolean {
    return this.documents.delete(docId);
  }

  search(query: string, limit = 5): KBSearchResult[] {
    const queryWords = new Set(query.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
    const results: KBSearchResult[] = [];

    for (const doc of this.documents.values()) {
      for (const chunk of doc.chunks) {
        const chunkWords = chunk.content.toLowerCase().split(/\s+/);
        const overlap = chunkWords.filter((w) => queryWords.has(w)).length;
        if (overlap === 0) continue;

        const score = overlap / Math.max(queryWords.size, 1);
        const section = chunk.metadata.section ? `, Section: ${chunk.metadata.section}` : '';
        const page = chunk.metadata.page ? `, Page ${chunk.metadata.page}` : '';

        results.push({
          chunk,
          score,
          documentName: doc.name,
          citation: `[${doc.name}${section}${page}, Chunk ${chunk.index + 1}]`,
        });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  searchWithCitations(query: string, limit = 5): { answer: string; citations: string[] } {
    const results = this.search(query, limit);
    const citations = results.map((r) => r.citation);
    const context = results.map((r) => r.chunk.content).join('\n\n');
    return { answer: context, citations };
  }

  listDocuments(): Array<{ id: string; name: string; chunks: number; chars: number }> {
    return Array.from(this.documents.values()).map((d) => ({
      id: d.id,
      name: d.name,
      chunks: d.totalChunks,
      chars: d.totalChars,
    }));
  }

  getDocument(docId: string): ProcessedDocument | undefined {
    return this.documents.get(docId);
  }

  stats(): { documents: number; totalChunks: number; totalChars: number } {
    let totalChunks = 0;
    let totalChars = 0;
    for (const doc of this.documents.values()) {
      totalChunks += doc.totalChunks;
      totalChars += doc.totalChars;
    }
    return { documents: this.documents.size, totalChunks, totalChars };
  }

  clear(): void {
    this.documents.clear();
  }
}
