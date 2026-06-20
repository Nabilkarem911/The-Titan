import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { WhisperSTTProvider, OpenAITTSProvider } from '@titan/agent-engine';
import { requireAuth } from '../plugins/auth.js';

let sttProvider: WhisperSTTProvider | null = null;
let ttsProvider: OpenAITTSProvider | null = null;

function getStt(): WhisperSTTProvider {
  if (!sttProvider) sttProvider = new WhisperSTTProvider();
  return sttProvider;
}

function getTts(): OpenAITTSProvider {
  if (!ttsProvider) ttsProvider = new OpenAITTSProvider();
  return ttsProvider;
}

export const voiceRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  // POST /api/v1/voice/transcribe — accepts audio blob, returns text
  app.post('/api/v1/voice/transcribe', { preHandler: [requireAuth] }, async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.status(400).send({ error: 'No audio file provided' });

    const chunks: Buffer[] = [];
    const stream = data.file;
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    const audioBuffer = Buffer.concat(chunks);

    if (audioBuffer.length === 0) {
      return reply.status(400).send({ error: 'Empty audio' });
    }

    try {
      const result = await getStt().transcribe(audioBuffer);
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({
        error: 'Transcription failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // POST /api/v1/voice/synthesize — accepts text, returns audio mp3
  app.post('/api/v1/voice/synthesize', { preHandler: [requireAuth] }, async (req, reply) => {
    const { text, voice } = req.body as { text: string; voice?: string };

    if (!text || !text.trim()) {
      return reply.status(400).send({ error: 'Text is required' });
    }

    try {
      const audioBuffer = await getTts().synthesize(text.slice(0, 4096), voice || 'alloy');
      reply.header('Content-Type', 'audio/mpeg');
      return reply.send(audioBuffer);
    } catch (err) {
      return reply.status(500).send({
        error: 'Synthesis failed',
        detail: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  });

  // GET /api/v1/voice/voices — list available TTS voices
  app.get('/api/v1/voice/voices', { preHandler: [requireAuth] }, async (_req, reply) => {
    const voices = await getTts().listVoices();
    return reply.send({ voices });
  });
};
