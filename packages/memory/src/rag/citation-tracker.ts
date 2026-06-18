import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'citation-tracker' });

export interface Citation {
  id: string;
  documentName: string;
  section?: string;
  page?: number;
  chunkIndex: number;
  relevanceScore: number;
  excerpt: string;
}

export class CitationTracker {
  private citations: Map<string, Citation[]> = new Map();

  addCitation(responseId: string, citation: Citation): void {
    const list = this.citations.get(responseId) ?? [];
    list.push(citation);
    this.citations.set(responseId, list);
  }

  getCitations(responseId: string): Citation[] {
    return this.citations.get(responseId) ?? [];
  }

  formatCitations(responseId: string): string {
    const cites = this.getCitations(responseId);
    if (cites.length === 0) return '';

    return cites
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map((c, i) => {
        const parts = [`[${i + 1}] ${c.documentName}`];
        if (c.section) parts.push(`Section: ${c.section}`);
        if (c.page) parts.push(`Page ${c.page}`);
        parts.push(`(relevance: ${Math.round(c.relevanceScore * 100)}%)`);
        return parts.join(', ');
      })
      .join('\n');
  }

  formatInline(responseId: string): Map<string, string> {
    const cites = this.getCitations(responseId);
    const inline = new Map<string, string>();

    for (let i = 0; i < cites.length; i++) {
      inline.set(cites[i].excerpt.slice(0, 50), `[${i + 1}]`);
    }

    return inline;
  }

  clear(responseId?: string): void {
    if (responseId) this.citations.delete(responseId);
    else this.citations.clear();
  }
}
