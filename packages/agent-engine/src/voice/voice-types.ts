export interface STTProvider {
  transcribe(audio: Buffer, language?: string): Promise<{ text: string; confidence: number; language: string }>;
}

export interface TTSProvider {
  synthesize(text: string, voice?: string): Promise<Buffer>;
  listVoices(): Promise<Array<{ id: string; name: string; language: string }>>;
}

export interface VoiceSession {
  id: string;
  userId: string;
  sttProvider: STTProvider;
  ttsProvider: TTSProvider;
  language: string;
  voiceId: string;
  isActive: boolean;
}

