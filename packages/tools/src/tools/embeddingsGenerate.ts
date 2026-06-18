export async function embeddingsGenerate(params: { texts: string[]; model?: string }): Promise<string> {
  const { texts, model = 'auto' } = params;
  if (!texts?.length) throw new Error('texts array required');

  const apiKey = process.env['EMBEDDING_API_KEY'] ?? process.env['LLM_API_KEY'];
  const baseUrl = process.env['EMBEDDING_BASE_URL'] ?? process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1';

  if (!apiKey) throw new Error('No API key configured for embeddings');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey !== 'local') headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ model, input: texts, dimensions: Number(process.env['EMBEDDING_DIMENSIONS'] ?? 1024) }),
  });

  if (!res.ok) throw new Error(`Embeddings failed: ${res.status}`);

  const data = await res.json() as { data: Array<{ embedding: number[]; index: number }>; usage?: { total_tokens: number } };
  const sorted = data.data.sort((a, b) => a.index - b.index);

  return JSON.stringify({
    count: sorted.length,
    dimensions: sorted[0]?.embedding?.length ?? 0,
    tokensUsed: data.usage?.total_tokens ?? 0,
    embeddings: sorted.map((d) => d.embedding),
  });
}
