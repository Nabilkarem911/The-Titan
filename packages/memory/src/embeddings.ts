import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'embeddings' });

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions(): number;
}

/**
 * OpenAI-compatible embedding provider.
 * Works with OpenAI, Azure OpenAI, and any OpenAI-compatible endpoint (e.g. LiteLLM, vLLM, Ollama).
 */
export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  private baseUrl: string;
  private apiKey: string;
  private model: string;
  private dims: number;

  constructor(opts?: { baseUrl?: string; apiKey?: string; model?: string; dimensions?: number }) {
    this.baseUrl = opts?.baseUrl ?? process.env['EMBEDDING_BASE_URL'] ?? process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1';
    this.apiKey = opts?.apiKey ?? process.env['EMBEDDING_API_KEY'] ?? process.env['LLM_API_KEY'] ?? '';
    this.model = opts?.model ?? process.env['EMBEDDING_MODEL'] ?? 'jina-embeddings-v3';
    this.dims = opts?.dimensions ?? Number(process.env['EMBEDDING_DIMENSIONS'] ?? 1024);
  }

  dimensions(): number {
    return this.dims;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey) {
      log.warn('No embedding API key configured — returning zero vectors');
      return texts.map(() => new Array(this.dims).fill(0));
    }

    try {
      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          input: texts,
          dimensions: this.dims,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        log.error({ status: res.status, error: errText }, 'embedding API request failed');
        return texts.map(() => new Array(this.dims).fill(0));
      }

      const data = await res.json() as {
        data: Array<{ embedding: number[]; index: number }>;
        usage?: { prompt_tokens: number; total_tokens: number };
      };

      if (data.usage) {
        log.debug({ tokens: data.usage.total_tokens, texts: texts.length }, 'embeddings generated');
      }

      // Sort by index to guarantee order
      const sorted = data.data.sort((a, b) => a.index - b.index);
      return sorted.map((d) => d.embedding);
    } catch (err) {
      log.error({ err }, 'embedding request failed');
      return texts.map(() => new Array(this.dims).fill(0));
    }
  }
}

/**
 * Create an embedding provider from environment variables.
 * Returns null if no embedding configuration is found.
 */
export function createEmbeddingProvider(): EmbeddingProvider | null {
  const apiKey = process.env['EMBEDDING_API_KEY'] ?? process.env['LLM_API_KEY'];
  if (!apiKey) {
    log.info('No embedding API key configured — semantic search disabled');
    return null;
  }
  return new OpenAiEmbeddingProvider();
}

let _globalProvider: EmbeddingProvider | null | undefined;

/**
 * Get or create the global embedding provider singleton.
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (_globalProvider === undefined) {
    _globalProvider = createEmbeddingProvider();
  }
  return _globalProvider;
}
