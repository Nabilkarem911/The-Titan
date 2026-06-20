import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { ChannelRouter, DiscordAdapter, SlackAdapter, WhatsAppAdapter } from '@titan/agent-engine';
import type { ChannelConfig, ChannelMessage } from '@titan/agent-engine';
import { getGlobalToolRegistry } from '@titan/agent-engine';
import { getGlobalMemoryClient } from '@titan/memory';
import { createRunner } from '../create-runner.js';
import { getChatHistory, saveChatMessage, agentRuns, agentProfiles, userContext } from '@titan/database';
import { getLogger } from '@titan/logging';
import { detectLanguage } from '../lang-detect.js';
import { recordUserInteraction, getLearnedPreferences, getPersonaInstructionsForUser } from '../preference-singleton.js';

const log = getLogger().child({ component: 'multi-platform-bots' });

const channelRouter = new ChannelRouter();

function registerAdaptersFromEnv(): void {
  const configs: ChannelConfig[] = [
    {
      type: 'discord',
      enabled: !!process.env['DISCORD_BOT_TOKEN'],
      botToken: process.env['DISCORD_BOT_TOKEN'],
      webhookSecret: process.env['DISCORD_WEBHOOK_SECRET'],
    },
    {
      type: 'slack',
      enabled: !!process.env['SLACK_BOT_TOKEN'],
      botToken: process.env['SLACK_BOT_TOKEN'],
      webhookSecret: process.env['SLACK_WEBHOOK_SECRET'],
    },
    {
      type: 'whatsapp',
      enabled: !!process.env['WHATSAPP_API_KEY'],
      apiKey: process.env['WHATSAPP_API_KEY'],
      webhookSecret: process.env['WHATSAPP_WEBHOOK_SECRET'],
      phoneNumberId: process.env['WHATSAPP_PHONE_NUMBER_ID'],
    },
  ];

  channelRouter.registerFromConfig(configs);

  for (const channel of channelRouter.listChannels()) {
    log.info({ channel }, 'platform bot registered');
  }
}

async function handleMessage(
  msg: ChannelMessage,
  replyTo: string,
  channelType: string,
): Promise<void> {
  const ownerId = `${channelType}:${msg.senderId}`;
  const sessionId = `${channelType}:${msg.senderId}`;
  const text = msg.content.trim();

  if (!text) return;

  await saveChatMessage(sessionId, 'user', text);

  const registry = getGlobalToolRegistry();
  const memory = await getGlobalMemoryClient();
  const history = await getChatHistory(sessionId, 20);
  const historyLines = history.map((m) => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content}`);

  const ctx = await userContext.getAll(ownerId);
  const ctxLines = Object.entries(ctx).map(([k, v]) => `- ${k}: ${v}`);

  const lang = detectLanguage(text);
  const profileSlug = lang === 'ar' ? 'arabic-companion' : 'english-companion';
  let profileSystemPrompt = '';
  try {
    const systemUserId = '00000000-0000-0000-0000-000000000001';
    const profile = await agentProfiles.findBySlug(systemUserId, profileSlug);
    if (profile) profileSystemPrompt = profile.systemPrompt;
  } catch { /* ignore */ }

  const learnedPrefs = getLearnedPreferences(ownerId);
  const personaInstr = getPersonaInstructionsForUser(ownerId);

  const contextBlock = [
    ctxLines.length ? `\n\nUser context:\n${ctxLines.join('\n')}` : '',
    historyLines.length ? `\n\nRecent conversation:\n${historyLines.join('\n')}` : '',
    learnedPrefs ? `\n\nLearned preferences:\n${learnedPrefs}` : '',
    personaInstr ? `\n\nAdaptive persona:\n${personaInstr}` : '',
    `\n\nWhen using remember/recall/set_secret tools, always pass ownerId="${ownerId}".`,
    `\n\nPersonality reminder:\n- You are Titan — a friend, not a bot.\n- Keep it short. One or two sentences for simple questions.\n- Never say "I am an AI".`,
  ].join('');

  const dbRun = await agentRuns.create({
    agentId: 'platform-bot',
    prompt: text,
    maxSteps: 10,
  });

  const runner = createRunner({
    runId: dbRun.id,
    agentId: 'platform-bot',
    executeTool: (name, params) => {
      const p = params as Record<string, unknown>;
      if (['remember', 'recall', 'set_secret', 'list_secrets'].includes(name)) {
        p.ownerId = ownerId;
      }
      return registry.execute(name, p);
    },
    memory,
    userContextItems: Object.keys(ctx).length > 0 ? ctx : undefined,
  });

  const chatHistory = history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  const result = await runner.run({
    runId: dbRun.id,
    agentId: 'platform-bot',
    prompt: text,
    systemPromptExtra: (profileSystemPrompt ? profileSystemPrompt + '\n\n' : '') + contextBlock,
    conversationHistory: chatHistory.slice(-20),
  });

  const answer = result.finalAnswer?.trim() || 'لم أتمكن من إكمال المهمة.';
  await saveChatMessage(sessionId, 'assistant', answer);

  try { recordUserInteraction(ownerId, [text, answer]); } catch { /* optional */ }

  await channelRouter.sendResponse(channelType, replyTo, { content: answer });
  log.info({ channelType, senderId: msg.senderId, steps: result.steps.length }, 'platform bot response sent');
}

export const multiPlatformBotRoutes: FastifyPluginAsync = async (app: FastifyInstance) => {
  registerAdaptersFromEnv();

  const channels = channelRouter.listChannels();
  if (channels.length === 0) {
    log.info('no platform bots configured — set DISCORD_BOT_TOKEN, SLACK_BOT_TOKEN, or WHATSAPP_API_KEY to enable');
    return;
  }

  // Discord webhook
  if (channelRouter.getAdapter('discord')) {
    app.post('/webhooks/discord', { config: { rawBody: true } }, async (req, reply) => {
      const secret = process.env['DISCORD_WEBHOOK_SECRET'];
      if (secret) {
        const sig = req.headers['x-discord-webhook-secret'];
        if (sig !== secret) return reply.code(403).send({ error: 'Forbidden' });
      }

      const msg = channelRouter.parseMessage('discord', req.body);
      if (!msg) return reply.code(200).send({ ok: true });

      const replyTo = String((msg.metadata?.channelId as string) ?? '');
      reply.code(200).send({ ok: true });

      handleMessage(msg, replyTo, 'discord').catch((err) => {
        log.error({ channel: 'discord', err }, 'discord message handler failed');
      });
    });

    // Discord interaction (slash commands)
    app.post('/webhooks/discord/interactions', async (req, reply) => {
      const body = req.body as { type?: number; data?: { name?: string } };
      if (body.type === 1) return reply.send({ type: 1 }); // Pong
      reply.send({ type: 4, data: { content: 'Processing your request...' } });
    });

    log.info('discord webhook registered at /webhooks/discord');
  }

  // Slack events
  if (channelRouter.getAdapter('slack')) {
    app.post('/webhooks/slack', { config: { rawBody: true } }, async (req, reply) => {
      const body = req.body as { type?: string; challenge?: string; event?: Record<string, unknown> };

      // Slack URL verification
      if (body.type === 'url_verification' && body.challenge) {
        return reply.send({ challenge: body.challenge });
      }

      const msg = channelRouter.parseMessage('slack', req.body);
      if (!msg) return reply.code(200).send({ ok: true });

      const replyTo = String((msg.metadata?.channel as string) ?? msg.senderId);
      reply.code(200).send({ ok: true });

      handleMessage(msg, replyTo, 'slack').catch((err) => {
        log.error({ channel: 'slack', err }, 'slack message handler failed');
      });
    });

    log.info('slack webhook registered at /webhooks/slack');
  }

  // WhatsApp webhook
  if (channelRouter.getAdapter('whatsapp')) {
    app.get('/webhooks/whatsapp', async (req, reply) => {
      // WhatsApp verification
      const mode = (req.query as { 'hub.mode'?: string })['hub.mode'];
      const token = (req.query as { 'hub.verify_token'?: string })['hub.verify_token'];
      const challenge = (req.query as { 'hub.challenge'?: string })['hub.challenge'];
      const verifyToken = process.env['WHATSAPP_VERIFY_TOKEN'] ?? 'titan';

      if (mode === 'subscribe' && token === verifyToken) {
        return reply.send(Number(challenge));
      }
      return reply.code(403).send({ error: 'Verification failed' });
    });

    app.post('/webhooks/whatsapp', { config: { rawBody: true } }, async (req, reply) => {
      const msg = channelRouter.parseMessage('whatsapp', req.body);
      if (!msg) return reply.code(200).send({ ok: true });

      const replyTo = msg.senderId;
      reply.code(200).send({ ok: true });

      handleMessage(msg, replyTo, 'whatsapp').catch((err) => {
        log.error({ channel: 'whatsapp', err }, 'whatsapp message handler failed');
      });
    });

    log.info('whatsapp webhook registered at /webhooks/whatsapp');
  }

  // Management endpoints
  app.get('/api/v1/bots/channels', async (_req, reply) => {
    const channels = channelRouter.listChannels();
    return reply.send({
      channels: channels.map((name) => {
        const adapter = channelRouter.getAdapter(name);
        return { name, connected: !!adapter };
      }),
      total: channels.length,
    });
  });

  app.post('/api/v1/bots/send', async (req, reply) => {
    const { channel, to, message } = req.body as { channel: string; to: string; message: string };
    if (!channel || !to || !message) {
      return reply.code(400).send({ error: 'channel, to, and message are required' });
    }

    const sent = await channelRouter.sendResponse(channel, to, { content: message });
    return reply.send({ sent, channel, to });
  });
};
