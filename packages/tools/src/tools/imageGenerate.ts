export async function imageGenerate(params: { prompt: string; size?: string; model?: string; style?: string }): Promise<string> {
  const { prompt, size = '1024x1024', model = 'dall-e-3', style = 'natural' } = params;
  if (!prompt) throw new Error('prompt is required');

  const apiKey = process.env['OPENAI_API_KEY'] ?? process.env['LLM_API_KEY'];
  const baseUrl = process.env['IMAGE_API_BASE_URL'] ?? 'https://api.openai.com/v1';

  if (!apiKey) throw new Error('No API key configured for image generation');

  const response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, prompt, size, style, n: 1, response_format: 'url' }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Image generation failed: ${response.status} — ${err}`);
  }

  const data = await response.json() as { data: Array<{ url: string; revised_prompt?: string }> };
  return JSON.stringify({ url: data.data[0]?.url, revisedPrompt: data.data[0]?.revised_prompt, size, model });
}
