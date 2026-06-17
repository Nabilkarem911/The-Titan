import type { FastifyInstance } from 'fastify';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { agentRuns, agentSteps, userContext, getChatHistory, saveChatMessage, agentProfiles } from '@titan/database';
import { AgentRunner, createProviderFromEnv, getGlobalToolRegistry, type ToolCall, type ToolResult, type AgentRun, type AgentStep } from '@titan/agent-engine';
import { getGlobalMemoryClient } from '@titan/memory';
import { getWsServer } from '../ws-instance.js';
import { detectLanguage } from '../lang-detect.js';

const log = getLogger().child({ component: 'telegram' });

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
  };
}

function escapeMarkdown(text: string): string {
  // Escape characters that Telegram interprets as Markdown formatting
  return text
    .replace(/\\/g, '\\\\')
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/~/g, '\\~')
    .replace(/`/g, '\\`')
    .replace(/>/g, '\\>')
    .replace(/#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/-/g, '\\-')
    .replace(/=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/{/g, '\\{')
    .replace(/}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/!/g, '\\!');
}

async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = { chat_id: chatId, text: escapeMarkdown(text), parse_mode: 'MarkdownV2' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.text();
      log.warn({ chatId, status: res.status, err }, 'telegram sendMessage failed');
      // Fallback: if parse_mode caused the failure, retry without it
      if (res.status === 400) {
        try {
          const fallbackRes = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: chatId, text }),
          });
          if (fallbackRes.ok) {
            log.info({ chatId }, 'telegram fallback (no parse_mode) succeeded');
          } else {
            const fallbackErr = await fallbackRes.text();
            log.error({ chatId, status: fallbackRes.status, err: fallbackErr }, 'telegram fallback also failed');
          }
        } catch (fallbackEx) {
          log.error({ chatId, err: fallbackEx }, 'telegram fallback threw exception');
        }
      }
    }
  } catch (err) {
    log.error({ chatId, err }, 'telegram sendMessage error');
  }
}

export async function registerTelegramRoutes(app: FastifyInstance): Promise<void> {
  const cfg = loadConfig();

  if (!cfg.TELEGRAM_BOT_TOKEN) {
    log.info('TELEGRAM_BOT_TOKEN not set — telegram webhook disabled');
    return;
  }

  const allowedIds = cfg.TELEGRAM_ALLOWED_CHAT_IDS
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean)
    .map(Number);

  const registry = getGlobalToolRegistry();

  app.post('/telegram/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    const update = req.body as TelegramUpdate;
    const msg = update.message;

    if (!msg?.text || !msg.from) {
      return reply.code(200).send({ ok: true });
    }

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (allowedIds.length > 0 && !allowedIds.includes(chatId)) {
      log.warn({ chatId }, 'telegram message from unauthorized chat id');
      return reply.code(200).send({ ok: true });
    }

    log.info({ chatId, text: text.substring(0, 100) }, 'telegram message received');

    // Acknowledge immediately — Telegram requires 200 within 5s
    reply.code(200).send({ ok: true });

    // Send typing indicator
    fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    }).catch(() => {});

    // Run agent
    try {
      const agentId = cfg.TELEGRAM_AGENT_ID;
      const ownerId = String(chatId);
      const sessionId = `tg:${chatId}`;

      // Load user context and recent history
      const [ctx, history] = await Promise.all([
        userContext.getAll(ownerId),
        getChatHistory(sessionId, 50),
      ]);

      // Save incoming message to history
      await saveChatMessage(sessionId, 'user', text);

      // Build context block for system prompt
      const ctxLines = Object.entries(ctx).map(([k, v]: [string, string]) => `- ${k}: ${v}`);
      const historyLines = history.map((m: { role: string; content: string }) => `${m.role === 'user' ? 'User' : 'Titan'}: ${m.content}`);

      const contextBlock = [
        ctxLines.length ? `\n\nUser context:\n${ctxLines.join('\n')}` : '',
        historyLines.length ? `\n\nRecent conversation:\n${historyLines.join('\n')}` : '',
        `\n\nWhen using remember/recall/set_secret/list_secrets tools, always pass ownerId="${ownerId}".`,
        `\n\nPersonality reminder:
- You are Titan — a friend, not a bot. Talk like a real person (WhatsApp style, not essay style).
- Feel the mood before responding. Is the user frustrated? Happy? Testing you?
- Keep it short. One or two sentences for simple questions.
- If asked about code changes or integration, the user IS the developer. Answer YES/NO first, then brief steps.
- Never say "I don't know what's in my backend" or "I can't modify my own code". You KNOW your architecture (Node.js/Fastify/Postgres/agent-engine). You are a co-developer.
- Never repeat the same explanation twice. Never say "I am an AI" or "I cannot modify code".
- Developer relationship: This user may be the person who builds and updates you. Respect that.`,
      ].join('');

      // Detect user language and load the matching companion profile
      const lang = detectLanguage(text);
      const profileSlug = lang === 'ar' ? 'arabic-companion' : 'english-companion';
      let profileSystemPrompt = '';
      try {
        const systemUserId = '00000000-0000-0000-0000-000000000001';
        const profile = await agentProfiles.findBySlug(systemUserId, profileSlug);
        if (profile) {
          profileSystemPrompt = profile.systemPrompt;
        }
      } catch {
        /* ignore — fallback to DEFAULT_SYSTEM_PROMPT */
      }

      // Persist run in DB — id is auto-generated by the DB
      const createdRun = await agentRuns.create({
        agentId,
        prompt: text,
        maxSteps: 10,
      });
      const runId = createdRun.id;

      const memory = await getGlobalMemoryClient();

      const runner = new AgentRunner({
        llm: (() => { const p = createProviderFromEnv(); if (!p) throw new Error('LLM provider not configured'); return p; })(),
        executeTool: async (call: ToolCall, _runId: string): Promise<ToolResult> => {
          return registry.execute(call.name, call.params);
        },
        memory,
        persistRun: async (run: AgentRun) => {
          try {
            await agentRuns.updateStatus(runId, run.status, {
              currentStep: run.currentStep,
              tokensUsed: run.tokensUsed,
              finalAnswer: run.finalAnswer ?? undefined,
            });
          } catch (err) {
            log.warn({ err, runId }, 'failed to persist run');
          }
          getWsServer()?.broadcast('agent.run.updated', {
            runId,
            agentId,
            status: run.status,
            currentStep: run.currentStep,
            tokensUsed: run.tokensUsed,
            finalAnswer: run.finalAnswer ?? null,
          });
        },
        onStep: async (step: AgentStep) => {
          try {
            await agentSteps.create({
              runId,
              stepIndex: step.index,
              status: step.status,
              thought: step.thought,
              actionName: step.action?.name,
              actionParams: step.action?.params,
              observationSuccess: step.observation?.success,
              observationData: step.observation?.data as Record<string, unknown> | undefined,
              observationError: step.observation?.error,
              reflection: step.reflection,
              tokensUsed: step.tokensUsed,
              latencyMs: step.latencyMs,
            });
          } catch (err) {
            log.warn({ err, runId }, 'failed to persist step');
          }
          getWsServer()?.broadcast('agent.step', {
            runId,
            agentId,
            step: {
              index: step.index,
              status: step.status,
              thought: step.thought,
              actionName: step.action?.name,
              reflection: step.reflection,
              tokensUsed: step.tokensUsed,
              latencyMs: step.latencyMs,
            },
          });
        },
      });

      // Start background run — do not await so next messages can be processed concurrently
      log.info({ runId, chatId }, 'background agent run started');
      runner.run({
        runId,
        agentId,
        prompt: text,
        systemPromptExtra: (profileSystemPrompt ? profileSystemPrompt + '\n\n' : '') + contextBlock,
      }).then(async (result) => {
        const answer = result.finalAnswer?.trim() || 'لم أتمكن من إكمال المهمة.';
        await saveChatMessage(sessionId, 'assistant', answer);
        await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, answer);
        log.info({ runId, chatId }, 'background agent run completed');
      }).catch(async (err) => {
        log.error({ chatId, err }, 'background agent run failed');
        await sendTelegramMessage(
          cfg.TELEGRAM_BOT_TOKEN,
          chatId,
          '❌ حدث خطأ أثناء تنفيذ المهمة. حاول مرة أخرى.',
        );
      });

    } catch (err) {
      log.error({ chatId, err }, 'telegram handler setup failed');
      await sendTelegramMessage(
        cfg.TELEGRAM_BOT_TOKEN,
        chatId,
        '❌ حدث خطأ. حاول مرة أخرى.',
      );
    }
  });

  log.info({ allowedChatIds: allowedIds }, 'telegram webhook route registered at POST /telegram/webhook');
}

export async function registerTelegramWebhook(publicUrl: string): Promise<void> {
  const cfg = loadConfig();
  if (!cfg.TELEGRAM_BOT_TOKEN) return;

  const webhookUrl = `${publicUrl}/telegram/webhook`;
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/setWebhook`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl, drop_pending_updates: true }),
      },
    );
    const data = await res.json() as { ok: boolean; description?: string };
    if (data.ok) {
      log.info({ webhookUrl }, 'telegram webhook registered');
    } else {
      log.warn({ webhookUrl, description: data.description }, 'telegram webhook registration failed');
    }
  } catch (err) {
    log.error({ err }, 'failed to register telegram webhook');
  }
}
