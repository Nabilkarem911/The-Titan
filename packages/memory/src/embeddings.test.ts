import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OpenAiEmbeddingProvider, createEmbeddingProvider, getEmbeddingProvider } from './embeddings.js';

// Mock @titan/logging to avoid real logger setup
vi.mock('@titan/logging', () => ({
  getLogger: () => ({
    child: () => ({
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('OpenAiEmbeddingProvider', () => {
  describe('constructor defaults', () => {
    beforeEach(() => {
      delete process.env['EMBEDDING_BASE_URL'];
      delete process.env['LLM_BASE_URL'];
      delete process.env['EMBEDDING_API_KEY'];
      delete process.env['LLM_API_KEY'];
      delete process.env['EMBEDDING_MODEL'];
      delete process.env['EMBEDDING_DIMENSIONS'];
    });

    it('uses default baseUrl when no env or opts provided', () => {
      const provider = new OpenAiEmbeddingProvider();
      // We test the provider was constructed without errors
      expect(provider).toBeInstanceOf(OpenAiEmbeddingProvider);
    });

    it('defaults dimensions to 1024', () => {
      const provider = new OpenAiEmbeddingProvider();
      expect(provider.dimensions()).toBe(1024);
    });

    it('respects explicit dimensions option', () => {
      const provider = new OpenAiEmbeddingProvider({ dimensions: 768 });
      expect(provider.dimensions()).toBe(768);
    });

    it('respects EMBEDDING_DIMENSIONS env var', () => {
      process.env['EMBEDDING_DIMENSIONS'] = '512';
      const provider = new OpenAiEmbeddingProvider();
      expect(provider.dimensions()).toBe(512);
      delete process.env['EMBEDDING_DIMENSIONS'];
    });

    it('opts.dimensions takes precedence over env var', () => {
      process.env['EMBEDDING_DIMENSIONS'] = '512';
      const provider = new OpenAiEmbeddingProvider({ dimensions: 256 });
      expect(provider.dimensions()).toBe(256);
      delete process.env['EMBEDDING_DIMENSIONS'];
    });
  });

  describe('dimensions()', () => {
    it('returns the configured dimension count', () => {
      const provider = new OpenAiEmbeddingProvider({ dimensions: 384 });
      expect(provider.dimensions()).toBe(384);
    });
  });

  describe('embed()', () => {
    it('returns empty array for empty input', async () => {
      const provider = new OpenAiEmbeddingProvider({ apiKey: 'test-key' });
      const result = await provider.embed([]);
      expect(result).toEqual([]);
    });

    it('returns zero vectors when no apiKey and no baseUrl configured', async () => {
      // No apiKey and explicitly empty baseUrl — triggers the fallback
      const provider = new OpenAiEmbeddingProvider({
        apiKey: '',
        baseUrl: '',
        dimensions: 4,
      });
      const result = await provider.embed(['hello', 'world']);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual([0, 0, 0, 0]);
      expect(result[1]).toEqual([0, 0, 0, 0]);
    });

    it('returns zero vectors of correct dimension', async () => {
      const provider = new OpenAiEmbeddingProvider({
        apiKey: '',
        baseUrl: '',
        dimensions: 8,
      });
      const result = await provider.embed(['test']);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveLength(8);
      expect(result[0].every((v: number) => v === 0)).toBe(true);
    });

    it('calls fetch with correct URL and headers on success', async () => {
      const mockEmbeddings = [
        { embedding: [0.1, 0.2, 0.3], index: 0 },
        { embedding: [0.4, 0.5, 0.6], index: 1 },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: mockEmbeddings,
            usage: { prompt_tokens: 10, total_tokens: 10 },
          }),
          { status: 200 },
        ),
      );

      const provider = new OpenAiEmbeddingProvider({
        baseUrl: 'https://test.example.com/v1',
        apiKey: 'sk-test-key',
        model: 'text-embedding-3-small',
        dimensions: 3,
      });

      const result = await provider.embed(['hello', 'world']);

      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).toBe('https://test.example.com/v1/embeddings');
      expect(options?.method).toBe('POST');

      const headers = options?.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['Authorization']).toBe('Bearer sk-test-key');

      const body = JSON.parse(options?.body as string);
      expect(body.model).toBe('text-embedding-3-small');
      expect(body.input).toEqual(['hello', 'world']);
      expect(body.dimensions).toBe(3);

      expect(result).toEqual([
        [0.1, 0.2, 0.3],
        [0.4, 0.5, 0.6],
      ]);

      fetchSpy.mockRestore();
    });

    it('sorts embeddings by index to guarantee order', async () => {
      // Return out-of-order indices
      const mockEmbeddings = [
        { embedding: [0.4, 0.5], index: 1 },
        { embedding: [0.1, 0.2], index: 0 },
      ];

      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: mockEmbeddings }),
          { status: 200 },
        ),
      );

      const provider = new OpenAiEmbeddingProvider({
        baseUrl: 'https://test.example.com/v1',
        apiKey: 'sk-test',
        dimensions: 2,
      });

      const result = await provider.embed(['first', 'second']);

      // Despite out-of-order response, result should be sorted by index
      expect(result[0]).toEqual([0.1, 0.2]);
      expect(result[1]).toEqual([0.4, 0.5]);

      fetchSpy.mockRestore();
    });

    it('does not send Authorization header when apiKey is "local"', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: [{ embedding: [1, 2], index: 0 }] }),
          { status: 200 },
        ),
      );

      const provider = new OpenAiEmbeddingProvider({
        baseUrl: 'http://localhost:11434/v1',
        apiKey: 'local',
        dimensions: 2,
      });

      await provider.embed(['test']);

      const headers = fetchSpy.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();

      fetchSpy.mockRestore();
    });

    it('returns zero vectors on HTTP error response', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Internal Server Error', { status: 500 }),
      );

      const provider = new OpenAiEmbeddingProvider({
        baseUrl: 'https://test.example.com/v1',
        apiKey: 'sk-test',
        dimensions: 3,
      });

      const result = await provider.embed(['hello']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0, 0, 0]);

      fetchSpy.mockRestore();
    });

    it('returns zero vectors on network/fetch error', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(
        new Error('Network error'),
      );

      const provider = new OpenAiEmbeddingProvider({
        baseUrl: 'https://test.example.com/v1',
        apiKey: 'sk-test',
        dimensions: 5,
      });

      const result = await provider.embed(['hello']);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual([0, 0, 0, 0, 0]);

      fetchSpy.mockRestore();
    });
  });
});

describe('createEmbeddingProvider', () => {
  beforeEach(() => {
    delete process.env['EMBEDDING_API_KEY'];
    delete process.env['LLM_API_KEY'];
    delete process.env['EMBEDDING_BASE_URL'];
  });

  afterEach(() => {
    delete process.env['EMBEDDING_API_KEY'];
    delete process.env['LLM_API_KEY'];
    delete process.env['EMBEDDING_BASE_URL'];
  });

  it('returns null when no API key or base URL is configured', () => {
    const provider = createEmbeddingProvider();
    expect(provider).toBeNull();
  });

  it('returns an OpenAiEmbeddingProvider when EMBEDDING_API_KEY is set', () => {
    process.env['EMBEDDING_API_KEY'] = 'sk-test-key';
    const provider = createEmbeddingProvider();
    expect(provider).toBeInstanceOf(OpenAiEmbeddingProvider);
  });

  it('returns an OpenAiEmbeddingProvider when LLM_API_KEY is set', () => {
    process.env['LLM_API_KEY'] = 'sk-llm-key';
    const provider = createEmbeddingProvider();
    expect(provider).toBeInstanceOf(OpenAiEmbeddingProvider);
  });

  it('returns an OpenAiEmbeddingProvider when EMBEDDING_BASE_URL is set', () => {
    process.env['EMBEDDING_BASE_URL'] = 'http://localhost:11434/v1';
    const provider = createEmbeddingProvider();
    expect(provider).toBeInstanceOf(OpenAiEmbeddingProvider);
  });
});

describe('getEmbeddingProvider', () => {
  // Note: getEmbeddingProvider uses a module-level singleton (_globalProvider).
  // Since the module is already loaded by other tests above, the singleton
  // may already be set. We test what we can without resetting module state.

  it('returns an EmbeddingProvider or null', () => {
    const provider = getEmbeddingProvider();
    // It should be either null or have the expected interface
    if (provider !== null) {
      expect(typeof provider.embed).toBe('function');
      expect(typeof provider.dimensions).toBe('function');
    } else {
      expect(provider).toBeNull();
    }
  });

  it('returns the same instance on repeated calls (singleton)', () => {
    const a = getEmbeddingProvider();
    const b = getEmbeddingProvider();
    expect(a).toBe(b);
  });
});
