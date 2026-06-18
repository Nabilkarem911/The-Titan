import { getLogger } from '@titan/logging';
import type { TTSProvider } from './voice-types.js';

const log = getLogger().child({ component: 'openai-tts' });

export class OpenAITTSProvider implements TTSProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = opts?.baseUrl ?? process.env['TTS_BASE_URL'] ?? 'https://api.openai.com/v1';
    this.apiKey = opts?.apiKey ?? process.env['TTS_API_KEY'] ?? process.env['LLM_API_KEY'] ?? '';
  }

  async synthesize(text: string, voice = 'alloy'): Promise<Buffer> {
    try {
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ model: 'tts-1', input: text, voice, response_format: 'mp3' }),
      });

      if (!response.ok) throw new Error(`TTS error: ${response.status}`);

      const arrayBuffer = await response.arrayBuffer();
      log.info({ chars: text.length, voice }, 'speech synthesized');
      return Buffer.from(arrayBuffer);
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : 'Unknown' }, 'synthesis failed');
      throw err;
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string; language: string }>> {
    return [
      { id: 'alloy', name: 'Alloy', language: 'en' },
      { id: 'echo', name: 'Echo', language: 'en' },
      { id: 'fable', name: 'Fable', language: 'en' },
      { id: 'onyx', name: 'Onyx', language: 'en' },
      { id: 'nova', name: 'Nova', language: 'en' },
      { id: 'shimmer', name: 'Shimmer', language: 'en' },
    ];
  }
}
