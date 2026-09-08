import { getLogger } from '@titan/logging';
import type { KnowledgeBase, KBSearchResult } from './knowledge-base.js';
import { CitationTracker, type Citation } from './citation-tracker.js';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'rag-pipeline' });

interface RAGResult {
  responseId: string;
  context: string;
  citations: Citation[];
  sourceDocs: string[];
  totalChunks: number;
}

interface RAGConfig {
  maxChunks: number;
  minRelevance: number;
  includeMetadata: boolean;
  deduplicateChunks: boolean;
}

const DEFAULT_CONFIG: RAGConfig = {
  maxChunks: 8,
  minRelevance: 0.1,
  includeMetadata: true,
  deduplicateChunks: true,
};

export class HybridRAGPipeline {
  private kb: KnowledgeBase;
  private citationTracker: CitationTracker;
  private config: RAGConfig;

  constructor(kb: KnowledgeBase, config?: Partial<RAGConfig>) {
    this.kb = kb;
    this.citationTracker = new CitationTracker();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  retrieve(query: string): RAGResult {
    const responseId = randomUUID();
    const results = this.kb.search(query, this.config.maxChunks * 2);

    // Filter by minimum relevance
    let filtered = results.filter((r) => r.score >= this.config.minRelevance);

    // Deduplicate similar chunks
    if (this.config.deduplicateChunks) {
      filtered = this.deduplicateResults(filtered);
    }

    // Take top N
    const topResults = filtered.slice(0, this.config.maxChunks);

    // Build citations
    const citations: Citation[] = topResults.map((r, i) => {
      const citation: Citation = {
        id: `cite_${i}`,
        documentName: r.documentName,
        section: r.chunk.metadata.section,
        page: r.chunk.metadata.page,
        chunkIndex: r.chunk.index,
        relevanceScore: r.score,
        excerpt: r.chunk.content.slice(0, 100),
      };
      this.citationTracker.addCitation(responseId, citation);
      return citation;
    });

    // Build context string
    const contextParts = topResults.map((r, i) => {
      const header = this.config.includeMetadata
        ? `[Source ${i + 1}: ${r.documentName}${r.chunk.metadata.section ? ` > ${r.chunk.metadata.section}` : ''}]`
        : `[${i + 1}]`;
      return `${header}\n${r.chunk.content}`;
    });

    const sourceDocs = [...new Set(topResults.map((r) => r.documentName))];

    log.info({ query: query.slice(0, 50), chunks: topResults.length, sources: sourceDocs.length }, 'RAG retrieval complete');

    return {
      responseId,
      context: contextParts.join('\n\n---\n\n'),
      citations,
      sourceDocs,
      totalChunks: topResults.length,
    };
  }

  retrieveForLLM(query: string): string {
    const result = this.retrieve(query);
    if (result.totalChunks === 0) return '';

    return `The following information was retrieved from the knowledge base to help answer the query:\n\n${result.context}\n\n---\nSources: ${result.sourceDocs.join(', ')}`;
  }

  getCitations(responseId: string): string {
    return this.citationTracker.formatCitations(responseId);
  }

  private deduplicateResults(results: KBSearchResult[]): KBSearchResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      const key = r.chunk.content.slice(0, 100).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
