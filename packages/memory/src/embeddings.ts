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
    this.model = opts?.model ?? process.env['EMBEDDING_MODEL'] ?? 'auto';
    this.dims = opts?.dimensions ?? Number(process.env['EMBEDDING_DIMENSIONS'] ?? 1024);
  }

  dimensions(): number {
    return this.dims;
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    if (!this.apiKey && !this.baseUrl) {
      log.warn('No embedding API key or base URL configured — returning zero vectors');
      return texts.map(() => new Array(this.dims).fill(0));
    }

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (this.apiKey && this.apiKey !== 'local') {
        headers['Authorization'] = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(`${this.baseUrl}/embeddings`, {
        method: 'POST',
        headers,
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
  const baseUrl = process.env['EMBEDDING_BASE_URL'];
  if (!apiKey && !baseUrl) {
    log.info('No embedding API key or base URL configured — semantic search disabled');
    return null;
  }
  return new OpenAiEmbeddingProvider();
}

let _globalProvider: EmbeddingProvider | null | undefined;

/**
 * النص اللي بنحسب منه بصمة المعنى.
 *
 * ⚠️ السبب: العناصر المخزّنة بتيجي ملزوقة (سؤال + إجابة مع بعض في نص طويل)
 * وده بيميّع البصمة فالبحث الدلالي بيرجع نتايج ضعيفة.
 * الحل: نركّز على السؤال (اللي بيحمل الموضوع) + أول جزء من الإجابة.
 *
 * ⚠️ أي تغيير في القاعدة دي لازم يتطبق كمان في سكربت إعادة التمثيل القديم،
 * وإلا البصمات القديمة والجديدة تبقى بتقيس حاجات مختلفة.
 */
export function embeddingText(content: string, maxLen = 900): string {
  const flat = (content ?? '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const parts: string[] = [];
  const p = flat.match(/Prompt:\s*(.*?)(?:\s*Answer:|$)/i);
  const a = flat.match(/Answer:\s*(.*)$/i);
  if (p?.[1]?.trim()) parts.push(p[1].trim());
  if (a?.[1]?.trim()) parts.push(a[1].trim().slice(0, 300));
  const text = parts.length > 0 ? parts.join(' | ') : flat;
  return text.slice(0, maxLen);
}

/**
 * Get or create the global embedding provider singleton.
 */
export function getEmbeddingProvider(): EmbeddingProvider | null {
  if (_globalProvider === undefined) {
    _globalProvider = createEmbeddingProvider();
  }
  return _globalProvider;
}
