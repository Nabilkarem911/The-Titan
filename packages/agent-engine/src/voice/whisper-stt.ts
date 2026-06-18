import { getLogger } from '@titan/logging';
import type { STTProvider } from './voice-types.js';

const log = getLogger().child({ component: 'whisper-stt' });

export class WhisperSTTProvider implements STTProvider {
  private baseUrl: string;
  private apiKey: string;

  constructor(opts?: { baseUrl?: string; apiKey?: string }) {
    this.baseUrl = opts?.baseUrl ?? process.env['STT_BASE_URL'] ?? 'https://api.openai.com/v1';
    this.apiKey = opts?.apiKey ?? process.env['STT_API_KEY'] ?? process.env['LLM_API_KEY'] ?? '';
  }

  async transcribe(audio: Buffer, language?: string): Promise<{ text: string; confidence: number; language: string }> {
    const formData = new FormData();
    formData.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
    formData.append('model', 'whisper-1');
    if (language) formData.append('language', language);

    try {
      const response = await fetch(`${this.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
        body: formData,
      });

      if (!response.ok) throw new Error(`STT error: ${response.status}`);

      const data = await response.json() as { text: string };
      log.info({ length: data.text.length }, 'audio transcribed');

      return { text: data.text, confidence: 0.9, language: language ?? 'auto' };
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : 'Unknown' }, 'transcription failed');
      throw err;
    }
  }
}
