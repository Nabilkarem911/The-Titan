import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { voiceClones } from '@titan/database';

const log = getLogger().child({ component: 'elevenlabs-tts' });

export interface ElevenLabsOptions {
  apiKey?: string;
  voiceId?: string;
  model?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

export interface VoiceClone {
  id: string;
  name: string;
  voiceId: string;
  createdAt: Date;
}

const DEFAULT_VOICE = '21m00Tcm4TlvDq8ikWAM';
const DEFAULT_MODEL = 'eleven_multilingual_v2';
const MAX_INPUT_LENGTH = 5000;
const CLONE_MAX_DURATION_SEC = 300;

export class ElevenLabsTTSProvider {
  private apiKey: string;
  private voiceId: string;
  private model: string;
  private stability: number;
  private similarityBoost: number;
  private style: number;
  private useSpeakerBoost: boolean;
  private clonedVoices: VoiceClone[] = [];

  constructor(opts?: ElevenLabsOptions) {
    this.apiKey = opts?.apiKey ?? process.env.ELEVENLABS_API_KEY ?? '';
    this.voiceId = opts?.voiceId ?? DEFAULT_VOICE;
    this.model = opts?.model ?? DEFAULT_MODEL;
    this.stability = opts?.stability ?? 0.5;
    this.similarityBoost = opts?.similarityBoost ?? 0.75;
    this.style = opts?.style ?? 0;
    this.useSpeakerBoost = opts?.useSpeakerBoost ?? true;
  }

  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY not set — cannot use ElevenLabs TTS');
    }

    if (text.length > MAX_INPUT_LENGTH) {
      text = text.slice(0, MAX_INPUT_LENGTH);
      log.warn({ length: text.length }, 'input text truncated to 5000 chars');
    }

    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId ?? this.voiceId}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'xi-api-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
          model_id: this.model,
          voice_settings: {
            stability: this.stability,
            similarity_boost: this.similarityBoost,
            style: this.style,
            use_speaker_boost: this.useSpeakerBoost,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      incCounter('elevenlabs_tts_calls', 'ElevenLabs TTS calls', 1);
      log.info({ voiceId: voiceId ?? this.voiceId, textLength: text.length, audioSize: buffer.length }, 'TTS synthesized');

      return buffer;
    } catch (err) {
      log.error({ err }, 'ElevenLabs TTS failed');
      throw err;
    }
  }

  async cloneVoice(name: string, audioSample: Buffer): Promise<VoiceClone> {
    if (!this.apiKey) {
      throw new Error('ELEVENLABS_API_KEY not set — cannot clone voice');
    }

    if (audioSample.length > CLONE_MAX_DURATION_SEC * 16000 * 2) {
      log.warn({ size: audioSample.length }, 'audio sample may exceed 5min limit');
    }

    try {
      const formData = new FormData();
      formData.append('name', name);
      formData.append('files', new Blob([audioSample]), 'sample.wav');

      const response = await fetch('https://api.elevenlabs.io/v1/voices/add', {
        method: 'POST',
        headers: { 'xi-api-key': this.apiKey },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs clone error: ${response.status}`);
      }

      const data = await response.json() as { voice_id: string };
      const clone: VoiceClone = {
        id: crypto.randomUUID(),
        name,
        voiceId: data.voice_id,
        createdAt: new Date(),
      };

      this.clonedVoices.push(clone);
      voiceClones.insert(clone.id, clone.name, clone.voiceId).catch((err) => log.error({ err }, 'DB write failed'));
      incCounter('elevenlabs_voice_clones', 'Voice clones created', 1);
      log.info({ name, voiceId: clone.voiceId }, 'voice cloned successfully');

      return clone;
    } catch (err) {
      log.error({ err }, 'voice cloning failed');
      throw err;
    }
  }

  getClonedVoices(): VoiceClone[] {
    return [...this.clonedVoices];
  }

  isAvailable(): boolean {
    return Boolean(this.apiKey);
  }

  getProviderName(): string {
    return 'elevenlabs';
  }

  getVoiceId(): string {
    return this.voiceId;
  }

  setVoiceId(voiceId: string): void {
    this.voiceId = voiceId;
  }
}

export function autoSelectTTSProvider(
  elevenlabs: ElevenLabsTTSProvider,
  openaiAvailable: boolean,
  preferClone: boolean = false,
): 'elevenlabs' | 'openai' {
  if (preferClone && elevenlabs.isAvailable() && elevenlabs.getClonedVoices().length > 0) {
    return 'elevenlabs';
  }
  if (elevenlabs.isAvailable()) {
    return 'elevenlabs';
  }
  return 'openai';
}
