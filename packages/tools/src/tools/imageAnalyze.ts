export async function imageAnalyze(params: { url: string; question?: string }): Promise<string> {
  const { url, question = 'Describe this image in detail' } = params;
  if (!url) throw new Error('url is required');

  const apiKey = process.env['OPENAI_API_KEY'] ?? process.env['LLM_API_KEY'];
  const baseUrl = process.env['LLM_BASE_URL'] ?? 'https://api.openai.com/v1';
  const model = process.env['VISION_MODEL'] ?? 'gpt-4o';

  if (!apiKey) throw new Error('No API key configured for vision');

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: question },
          { type: 'image_url', image_url: { url } },
        ],
      }],
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Vision analysis failed: ${response.status} — ${err}`);
  }

  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  return data.choices[0]?.message?.content ?? 'No analysis available';
}
