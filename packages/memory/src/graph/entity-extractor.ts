import { getLogger } from '@titan/logging';
import type { ExtractionResult, Entity } from './types.js';

const log = getLogger().child({ component: 'entity-extractor' });

const EXTRACT_PROMPT = `Extract entities and their relationships from the text.

Respond ONLY with JSON:
{
  "entities": [
    { "name": "EntityName", "type": "person|tool|concept|project|file|service|custom" }
  ],
  "relations": [
    { "source": "Entity1", "target": "Entity2", "type": "uses|creates|depends_on|related_to|contains|manages" }
  ]
}

Keep entity names short and normalized (lowercase, no articles).`;

export class EntityExtractor {
  private llm?: { complete(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> };

  constructor(llm?: { complete(messages: Array<{ role: string; content: string }>): Promise<{ content: string }> }) {
    this.llm = llm;
  }

  async extract(text: string): Promise<ExtractionResult> {
    const patternResult = this.extractWithPatterns(text);

    if (this.llm && text.length > 50) {
      try {
        const llmResult = await this.extractWithLlm(text);
        return this.mergeResults(patternResult, llmResult);
      } catch (err) {
        log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'LLM extraction failed');
      }
    }

    return patternResult;
  }

  extractWithPatterns(text: string): ExtractionResult {
    const entities: ExtractionResult['entities'] = [];
    const relations: ExtractionResult['relations'] = [];

    // Tool names
    const toolPattern = /\b(execute_bash|brave_search|http_request|write_file|read_file|patch_file|docker_manage|firecrawl_scrape|database_query|send_email)\b/g;
    let match;
    while ((match = toolPattern.exec(text)) !== null) {
      entities.push({ name: match[1], type: 'tool' });
    }

    // File paths
    const filePattern = /(?:^|[\s"'`])([\/\w.-]+\.[a-z]{1,5})(?:\s|$|["'`])/gm;
    while ((match = filePattern.exec(text)) !== null) {
      if (match[1].includes('/') || match[1].includes('.ts') || match[1].includes('.js')) {
        entities.push({ name: match[1], type: 'file' });
      }
    }

    // Services/URLs
    const servicePattern = /\b(postgres(?:ql)?|redis|docker|nginx|node\.?js|fastify|react|vite)\b/gi;
    while ((match = servicePattern.exec(text)) !== null) {
      entities.push({ name: match[1].toLowerCase(), type: 'service' });
    }

    // Deduplicate
    const uniqueEntities = Array.from(
      new Map(entities.map((e) => [e.name.toLowerCase(), e])).values(),
    );

    return { entities: uniqueEntities, relations };
  }

  private async extractWithLlm(text: string): Promise<ExtractionResult> {
    if (!this.llm) return { entities: [], relations: [] };

    const result = await this.llm.complete([
      { role: 'system', content: EXTRACT_PROMPT },
      { role: 'user', content: text.slice(0, 4000) },
    ]);

    const match = result.content.match(/\{[\s\S]*\}/);
    if (!match) return { entities: [], relations: [] };

    try {
      const parsed = JSON.parse(match[0]) as Record<string, unknown>;
      const validTypes: Entity['type'][] = ['person', 'tool', 'concept', 'project', 'file', 'service', 'custom'];

      const entities = Array.isArray(parsed.entities)
        ? parsed.entities.map((e) => {
            const raw = e as Record<string, unknown>;
            const type = validTypes.includes(String(raw.type) as Entity['type'])
              ? (String(raw.type) as Entity['type'])
              : 'custom';
            return { name: String(raw.name ?? '').toLowerCase(), type };
          }).filter((e) => e.name.length > 0)
        : [];

      const relations = Array.isArray(parsed.relations)
        ? parsed.relations.map((r) => {
            const raw = r as Record<string, unknown>;
            return {
              source: String(raw.source ?? '').toLowerCase(),
              target: String(raw.target ?? '').toLowerCase(),
              type: String(raw.type ?? 'related_to'),
            };
          }).filter((r) => r.source.length > 0 && r.target.length > 0)
        : [];

      return { entities, relations };
    } catch {
      return { entities: [], relations: [] };
    }
  }

  private mergeResults(a: ExtractionResult, b: ExtractionResult): ExtractionResult {
    const entityMap = new Map<string, ExtractionResult['entities'][0]>();
    for (const e of [...a.entities, ...b.entities]) {
      entityMap.set(e.name.toLowerCase(), e);
    }

    const relationSet = new Set<string>();
    const relations: ExtractionResult['relations'] = [];
    for (const r of [...a.relations, ...b.relations]) {
      const key = `${r.source}:${r.type}:${r.target}`;
      if (!relationSet.has(key)) {
        relationSet.add(key);
        relations.push(r);
      }
    }

    return { entities: Array.from(entityMap.values()), relations };
  }
}
