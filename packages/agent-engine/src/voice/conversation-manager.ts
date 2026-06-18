import { randomUUID } from 'node:crypto';
import { getLogger } from '@titan/logging';
import type { STTProvider, TTSProvider, VoiceSession } from './voice-types.js';
import { EmotionDetector, type EmotionResult } from './emotion-detector.js';

const log = getLogger().child({ component: 'voice-conversation' });

export interface VoiceConversationDeps {
  stt: STTProvider;
  tts: TTSProvider;
  processText: (text: string) => Promise<string>;
}

export interface VoiceTurn {
  role: 'user' | 'assistant';
  text: string;
  audio?: Buffer;
  emotion?: EmotionResult;
  timestamp: Date;
}

export class VoiceConversationManager {
  private sessions: Map<string, VoiceSession> = new Map();
  private history: Map<string, VoiceTurn[]> = new Map();
  private emotionDetector = new EmotionDetector();

  createSession(userId: string, deps: VoiceConversationDeps, language = 'auto', voiceId = 'alloy'): VoiceSession {
    const session: VoiceSession = {
      id: randomUUID(),
      userId,
      sttProvider: deps.stt,
      ttsProvider: deps.tts,
      language,
      voiceId,
      isActive: true,
    };

    this.sessions.set(session.id, session);
    this.history.set(session.id, []);
    log.info({ sessionId: session.id, userId }, 'voice session created');
    return session;
  }

  async processAudio(sessionId: string, audio: Buffer, processText: (text: string) => Promise<string>): Promise<{ text: string; audio: Buffer; emotion: EmotionResult }> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.isActive) throw new Error('Session not found or inactive');

    // 1. Speech to Text
    const { text: userText } = await session.sttProvider.transcribe(audio, session.language !== 'auto' ? session.language : undefined);

    // 2. Detect emotion
    const emotion = this.emotionDetector.detect(userText);

    // 3. Record user turn
    this.addTurn(sessionId, { role: 'user', text: userText, audio, emotion, timestamp: new Date() });

    // 4. Process text (LLM)
    const responseText = await processText(userText);

    // 5. Text to Speech
    const responseAudio = await session.ttsProvider.synthesize(responseText, session.voiceId);

    // 6. Record assistant turn
    this.addTurn(sessionId, { role: 'assistant', text: responseText, audio: responseAudio, timestamp: new Date() });

    return { text: responseText, audio: responseAudio, emotion };
  }

  getHistory(sessionId: string): VoiceTurn[] {
    return this.history.get(sessionId) ?? [];
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      log.info({ sessionId }, 'voice session ended');
    }
  }

  isActive(sessionId: string): boolean {
    return this.sessions.get(sessionId)?.isActive ?? false;
  }

  listSessions(userId?: string): VoiceSession[] {
    const all = Array.from(this.sessions.values());
    return userId ? all.filter((s) => s.userId === userId) : all;
  }

  private addTurn(sessionId: string, turn: VoiceTurn): void {
    const turns = this.history.get(sessionId);
    if (turns) {
      turns.push(turn);
      if (turns.length > 100) turns.shift();
    }
  }
}
