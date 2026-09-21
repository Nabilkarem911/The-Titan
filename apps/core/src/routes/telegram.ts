import type { FastifyInstance } from 'fastify';
import { stepsForMessage } from '../lib/simple-message.js';
import { loadConfig } from '@titan/config';
import { getLogger } from '@titan/logging';
import { agentRuns, userContext, userProjects, getChatHistory, saveChatMessage, agentProfiles } from '@titan/database';
import { getGlobalToolRegistry } from '@titan/agent-engine';
import { getGlobalMemoryClient } from '@titan/memory';
import { createRunner } from '../create-runner.js';
import { detectLanguage } from '../lang-detect.js';
import { getDesktopBridge } from '../desktop-bridge-instance.js';
import {
  type CallbackQuery,
  buildQuickActionsKeyboard,
  buildProgressBar,
  sendMessageWithOptions,
  editMessageText,
  answerCallbackQuery,
  parseCallbackData,
  validateCallbackOrigin,
  deleteMessage,
} from '../telegram-ui.js';

const log = getLogger().child({ component: 'telegram' });

interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: { id: number; first_name?: string; username?: string };
    chat: { id: number; type: string };
    text?: string;
    date: number;
    document?: TelegramFile;
    photo?: Array<{ file_id: string; file_unique_id: string; file_size?: number; width: number; height: number }>;
    caption?: string;
    voice?: { file_id: string; file_unique_id: string; duration?: number; mime_type?: string };
  };
  callback_query?: CallbackQuery;
}

function markdownToTelegramHtml(text: string): string {
  let html = text;
  // Code blocks: ```lang\ncode\n``` → <pre>code</pre>
  html = html.replace(/```[\w]*\n([\s\S]*?)```/g, '<pre>$1</pre>');
  // Inline code: `code` → <code>code</code>
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Bold: **text** → <b>text</b>
  html = html.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  // Italic: *text* → <i>text</i> (but not inside <b> tags)
  html = html.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, '<i>$1</i>');
  // Escape remaining HTML special chars (but not our tags)
  html = html.replace(/&(?!amp;|lt;|gt;)/g, '&amp;');
  html = html.replace(/<(?!\/?(?:b|i|code|pre|a)\b)/g, '&lt;');
  return html;
}

const TELEGRAM_MSG_LIMIT = 4000;

function splitMessage(text: string): string[] {
  if (text.length <= TELEGRAM_MSG_LIMIT) return [text];
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= TELEGRAM_MSG_LIMIT) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', TELEGRAM_MSG_LIMIT);
    if (splitAt < TELEGRAM_MSG_LIMIT * 0.3) splitAt = remaining.lastIndexOf('. ', TELEGRAM_MSG_LIMIT);
    if (splitAt < TELEGRAM_MSG_LIMIT * 0.3) splitAt = TELEGRAM_MSG_LIMIT;
    chunks.push(remaining.slice(0, splitAt + 1));
    remaining = remaining.slice(splitAt + 1);
  }
  return chunks;
}

async function sendTelegramChunk(token: string, chatId: number, text: string): Promise<boolean> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    // Try HTML formatting first (converts **bold** → <b>bold</b>, etc.)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: markdownToTelegramHtml(text), parse_mode: 'HTML' }),
    });
    if (res.ok) return true;
    // Fallback: send as plain text (strips all formatting)
    const fallbackRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    if (fallbackRes.ok) return true;
    const err = await fallbackRes.text();
    log.error({ chatId, status: fallbackRes.status, err }, 'telegram send failed');
    return false;
  } catch (err) {
    log.error({ chatId, err }, 'telegram sendMessage error');
    return false;
  }
}

async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<void> {
  const chunks = splitMessage(text);
  for (const chunk of chunks) {
    await sendTelegramChunk(token, chatId, chunk);
  }
}

async function downloadTelegramFile(token: string, fileId: string): Promise<{ url: string; filename?: string; localPath?: string } | null> {
  try {
    const infoRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const info = await infoRes.json() as { ok: boolean; result?: { file_path: string; file_size?: number }; description?: string };
    if (!info.ok || !info.result?.file_path) {
      log.warn({ fileId, desc: info.description }, 'telegram getFile failed');
      return null;
    }
    const filePath = info.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;
    const filename = filePath.split('/').pop() ?? 'unknown';

    // Download file to local filesystem so tools can access it
    try {
      const { writeFile, mkdir } = await import('node:fs/promises');
      const { join } = await import('node:path');
      const res = await fetch(downloadUrl);
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        const isKey = filename.includes('key') || filename.includes('pem') || filename.includes('id_rsa') || filename.endsWith('.pub');
        const dir = isKey ? '/home/titan/.ssh' : '/tmp/titan-uploads';
        await mkdir(dir, { recursive: true });
        const localPath = join(dir, filename);
        await writeFile(localPath, buffer, { mode: isKey ? 0o600 : 0o644 });
        log.info({ fileId, localPath, size: buffer.length }, 'telegram file downloaded to local filesystem');
        return { url: downloadUrl, filename, localPath };
      }
    } catch (dlErr) {
      log.warn({ fileId, err: dlErr }, 'failed to download file locally — falling back to URL only');
    }

    return { url: downloadUrl, filename };
  } catch (err) {
    log.error({ fileId, err }, 'downloadTelegramFile error');
    return null;
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

  const webhookSecret = cfg.TELEGRAM_WEBHOOK_SECRET || '';

  app.post('/telegram/webhook', {
    config: { rawBody: true },
  }, async (req, reply) => {
    if (webhookSecret) {
      const headerSecret = req.headers['x-telegram-bot-api-secret-token'];
      if (headerSecret !== webhookSecret) {
        log.warn({ ip: req.ip }, 'telegram webhook rejected — invalid secret token');
        return reply.code(403).send({ error: 'Forbidden' });
      }
    }

    const update = req.body as TelegramUpdate;

    // ── Handle callback queries (inline keyboard button presses) ──
    if (update.callback_query) {
      const cq = update.callback_query;
      reply.code(200).send({ ok: true });

      const chatId = cq.message?.chat?.id;
      if (!chatId) {
        await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id, 'Error: chat not found');
        return;
      }

      if (allowedIds.length > 0 && !allowedIds.includes(chatId)) {
        log.warn({ chatId }, 'callback query from unauthorized chat id');
        await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id);
        return;
      }

      const data = cq.data ?? '';
      const { prefix, value } = parseCallbackData(data);
      log.info({ chatId, prefix, value, userId: cq.from.id }, 'callback query received');

      // Validate origin — only the user who triggered the keyboard can press buttons
      if (!validateCallbackOrigin(cq, cq.from.id)) {
        await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id, 'Unauthorized');
        return;
      }

      // Handle different callback prefixes
      if (prefix === 'action') {
        await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id);

        if (value === 'screenshot') {
          // Trigger screenshot via desktop tools
          const bridge = getDesktopBridge();
          const ownerId = String(chatId);
          const linkedUserId = await userContext.findOwnerByKey('telegram_id', String(chatId));
          const desktopUserId = linkedUserId ?? ownerId;
          const devices = bridge?.listOnlineDevices(desktopUserId) ?? [];
          if (devices.length === 0) {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ مفيش جهاز متصل. شغل الـ desktop app الأول.');
          } else {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '📸 بتصور الشاشة...');
            try {
              (globalThis as Record<string, unknown>).__currentUserId = desktopUserId;
              (globalThis as Record<string, unknown>).__currentChatId = String(chatId);
              const result = await registry.execute('desktop_screenshot', {});
              if (!result.success) {
                await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `❌ فشل التصوير: ${result.error ?? 'unknown error'}`);
              }
            } catch (err) {
              await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `❌ خطأ: ${(err as Error).message}`);
            }
          }
          return;
        }

        if (value === 'status') {
          // Reuse /status logic
          try {
            const { execSync } = await import('node:child_process');
            const uptime = execSync('uptime -p 2>/dev/null || uptime', { timeout: 5000 }).toString().trim();
            const mem = execSync('free -h 2>/dev/null || echo "N/A"', { timeout: 5000 }).toString().trim();
            const disk = execSync('df -h / 2>/dev/null | tail -1 || echo "N/A"', { timeout: 5000 }).toString().trim();
            const dockerPs = execSync('docker ps --format "{{.Names}}: {{.Status}}" 2>/dev/null || echo "Docker not available"', { timeout: 5000 }).toString().trim();
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId,
              `🖥️ Server Status\n\n⏱ ${uptime}\n\n💾 Memory:\n${mem}\n\n💿 Disk:\n${disk}\n\n🐳 Docker:\n${dockerPs}`);
          } catch (err) {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `❌ Failed to get status: ${(err as Error).message}`);
          }
          return;
        }

        if (value === 'devices') {
          const bridge = getDesktopBridge();
          const ownerId = String(chatId);
          const linkedUserId = await userContext.findOwnerByKey('telegram_id', String(chatId));
          const desktopUserId = linkedUserId ?? ownerId;
          const devices = bridge?.listOnlineDevices(desktopUserId) ?? [];
          if (devices.length === 0) {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '🖥️ مفيش أجهزة متصلة.');
          } else {
            const lines = devices.map((d: { deviceName: string; platform: string; capabilities: string[] }) =>
              `• ${d.deviceName} (${d.platform}) — ${d.capabilities.join(', ')}`);
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `🖥️ الأجهزة المتصلة (${devices.length}):\n\n${lines.join('\n')}`);
          }
          return;
        }

        if (value === 'memory') {
          try {
            const ownerId = String(chatId);
            const ctx = await userContext.getAll(ownerId);
            const entries = Object.entries(ctx);
            if (entries.length === 0) {
              await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '🧠 الذاكرة فاضية.');
            } else {
              const lines = entries.map(([k, v]) => `• ${k}: ${String(v).substring(0, 100)}`);
              await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `🧠 الذاكرة (${entries.length} عنصر):\n\n${lines.join('\n')}`);
            }
          } catch {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ فشل قراءة الذاكرة.');
          }
          return;
        }

        if (value === 'help') {
          const helpText = `🤖 أوامر تيتان:\n\n` +
            `/status — حالة السيرفر\n` +
            `/memory — عرض الذاكرة\n` +
            `/forget — مسح الذاكرة\n` +
            `/servers — السيرفرات المحفوظة\n` +
            `/reset — مسح كل البيانات\n` +
            `/menu — القائمة السريعة\n` +
            `/help — عرض الأوامر`;
          await sendMessageWithOptions(cfg.TELEGRAM_BOT_TOKEN, {
            chatId,
            text: helpText,
            replyMarkup: buildQuickActionsKeyboard(),
          });
          return;
        }
      }

      if (prefix === 'confirm') {
        if (value === 'cancel') {
          await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id, 'Cancelled');
          if (cq.message?.message_id) {
            await editMessageText(cfg.TELEGRAM_BOT_TOKEN, chatId, cq.message.message_id, '✖️ Action cancelled.');
          }
          return;
        }
        // For confirm actions, answer and let the caller handle
        await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id, `Confirmed: ${value}`);
        return;
      }

      if (prefix === 'choice') {
        await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id, `Selected: ${value}`);
        // Send the choice as a user message for the agent to process
        const choiceText = value === 'yes' ? 'Yes' : value === 'no' ? 'No' : `Option ${value.toUpperCase()}`;
        await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `👤 You selected: ${choiceText}`);
        return;
      }

      // Unknown callback — just answer
      await answerCallbackQuery(cfg.TELEGRAM_BOT_TOKEN, cq.id);
      return;
    }

    const msg = update.message;

    if (!msg || !msg.from) {
      return reply.code(200).send({ ok: true });
    }

    const chatId = msg.chat.id;
    let text = (msg.text ?? msg.caption ?? '').trim();
    const ownerId = String(chatId);

    // ── Slash commands ──
    if (text.startsWith('/')) {
      const cmd = text.split(/\s/)[0].toLowerCase().replace(/@\w+$/, '');
      reply.code(200).send({ ok: true });

      if (cmd === '/status') {
        try {
          const { execSync } = await import('node:child_process');
          const uptime = execSync('uptime -p 2>/dev/null || uptime', { timeout: 5000 }).toString().trim();
          const mem = execSync('free -h 2>/dev/null || echo "N/A"', { timeout: 5000 }).toString().trim();
          const disk = execSync('df -h / 2>/dev/null | tail -1 || echo "N/A"', { timeout: 5000 }).toString().trim();
          const dockerPs = execSync('docker ps --format "{{.Names}}: {{.Status}}" 2>/dev/null || echo "Docker not available"', { timeout: 5000 }).toString().trim();
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId,
            `🖥️ Server Status\n\n⏱ ${uptime}\n\n💾 Memory:\n${mem}\n\n💿 Disk:\n${disk}\n\n🐳 Docker:\n${dockerPs}`);
        } catch (err) {
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `❌ Failed to get status: ${(err as Error).message}`);
        }
        return;
      }

      if (cmd === '/memory') {
        try {
          const ctx = await userContext.getAll(ownerId);
          const entries = Object.entries(ctx);
          if (entries.length === 0) {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '🧠 الذاكرة فاضية — مفيش حاجة محفوظة.');
          } else {
            const lines = entries.map(([k, v]) => `• ${k}: ${String(v).substring(0, 100)}`);
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `🧠 الذاكرة (${entries.length} عنصر):\n\n${lines.join('\n')}`);
          }
        } catch {
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ فشل قراءة الذاكرة.');
        }
        return;
      }

      if (cmd === '/forget') {
        try {
          const keys = Object.keys(await userContext.getAll(ownerId));
          for (const key of keys) await userContext.delete(ownerId, key);
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `🗑️ تم مسح ${keys.length} عنصر من الذاكرة.`);
        } catch {
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ فشل مسح الذاكرة.');
        }
        return;
      }

      if (cmd === '/servers') {
        try {
          const ctx = await userContext.getAll(ownerId);
          const serverKeys = Object.entries(ctx).filter(([k]) => k.startsWith('server_'));
          if (serverKeys.length === 0) {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '🖥️ مفيش سيرفرات محفوظة.');
          } else {
            const lines = serverKeys.map(([k, v]) => `• ${k.replace('server_', '')}: ${v}`);
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, `🖥️ السيرفرات (${serverKeys.length}):\n\n${lines.join('\n')}`);
          }
        } catch {
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ فشل قراءة السيرفرات.');
        }
        return;
      }

      if (cmd === '/reset') {
        try {
          const keys = Object.keys(await userContext.getAll(ownerId));
          for (const key of keys) await userContext.delete(ownerId, key);
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '🔄 تم مسح كل البيانات. هنبدأ من جديد.');
        } catch {
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ فشل إعادة التعيين.');
        }
        return;
      }

      if (cmd === '/help') {
        await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId,
          `🤖 أوامر تيتان:\n\n/status — حالة السيرفر\n/memory — عرض الذاكرة\n/forget — مسح الذاكرة\n/servers — السيرفرات المحفوظة\n/reset — مسح كل البيانات\n/menu — القائمة السريعة\n/help — عرض الأوامر`);
        return;
      }

      if (cmd === '/menu') {
        await sendMessageWithOptions(cfg.TELEGRAM_BOT_TOKEN, {
          chatId,
          text: '🤖 Quick Actions Menu\n\nاختر عملية:',
          replyMarkup: buildQuickActionsKeyboard(),
        });
        return;
      }

      // Unknown command — fall through to agent
    }

    // Handle file uploads (document or photo)
    let fileInfo: { url?: string; filename?: string; type?: string; localPath?: string } = {};
    if (msg.document) {
      const file = msg.document;
      const downloaded = await downloadTelegramFile(cfg.TELEGRAM_BOT_TOKEN, file.file_id);
      if (downloaded) {
        fileInfo = { url: downloaded.url, filename: downloaded.filename ?? file.file_name, type: file.mime_type ?? 'document', localPath: downloaded.localPath };
        if (!text) text = `User uploaded a file: ${fileInfo.filename}`;
      }
    } else if (msg.photo && msg.photo.length > 0) {
      // Get the largest photo
      const photo = msg.photo[msg.photo.length - 1];
      const downloaded = await downloadTelegramFile(cfg.TELEGRAM_BOT_TOKEN, photo.file_id);
      if (downloaded) {
        fileInfo = { url: downloaded.url, filename: downloaded.filename, type: 'image', localPath: downloaded.localPath };
        if (!text) text = 'User uploaded an image.';
      }
    } else if (msg.voice) {
      // Voice message — download and transcribe with Whisper
      const voiceFile = msg.voice;
      const downloaded = await downloadTelegramFile(cfg.TELEGRAM_BOT_TOKEN, voiceFile.file_id);
      if (downloaded?.localPath) {
        try {
          const { readFile } = await import('node:fs/promises');
          const audioBuffer = await readFile(downloaded.localPath);
          const { WhisperSTTProvider } = await import('@titan/agent-engine');
          const stt = new WhisperSTTProvider();
          const result = await stt.transcribe(audioBuffer);
          text = result.text.trim();
          log.info({ chatId, duration: voiceFile.duration, textLength: text.length }, 'voice message transcribed');
          if (!text) {
            await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '🎤 لم أتمكن من سماع الرسالة الصوتية بوضوح. حاول مرة أخرى.');
            return reply.code(200).send({ ok: true });
          }
        } catch (err) {
          log.error({ chatId, err }, 'voice transcription failed');
          await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, '❌ فشل تحويل الرسالة الصوتية إلى نص. حاول مرة أخرى.');
          return reply.code(200).send({ ok: true });
        }
      }
    }

    if (!text) {
      return reply.code(200).send({ ok: true });
    }

    if (allowedIds.length > 0 && !allowedIds.includes(chatId)) {
      log.warn({ chatId }, 'telegram message from unauthorized chat id');
      return reply.code(200).send({ ok: true });
    }

    log.info({ chatId, text: text.substring(0, 100), hasFile: !!fileInfo.url }, 'telegram message received');

    // Acknowledge immediately — Telegram requires 200 within 5s
    reply.code(200).send({ ok: true });

    // Continuous typing indicator while agent thinks
    const typingInterval = setInterval(() => {
      fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      }).catch(() => {});
    }, 4000);

    // Send first typing immediately
    fetch(`https://api.telegram.org/bot${cfg.TELEGRAM_BOT_TOKEN}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    }).catch(() => {});

    // Run agent
    try {
      const agentId = cfg.TELEGRAM_AGENT_ID;
      const sessionId = `tg:${chatId}`;

      // Resolve the real database userId linked to this Telegram chatId
      // Desktop devices are registered with the DB userId, not the chatId
      const linkedUserId = await userContext.findOwnerByKey('telegram_id', String(chatId));
      const desktopUserId = linkedUserId ?? ownerId;
      if (linkedUserId) {
        log.info({ chatId, linkedUserId }, 'telegram chat linked to database user');
      }

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

      // (removed forced SSH prompt — let the LLM decide tool usage naturally)

      // File upload info
      let fileContext = '';
      if (fileInfo.url) {
        const localInfo = fileInfo.localPath ? `\n- saved locally at: ${fileInfo.localPath}\nThe file has been downloaded and saved. You can read it with read_file_content or use it directly (e.g., for SSH keys, use the local path in ssh -i commands).` : `\n- url: ${fileInfo.url}\nThe file is available at the URL above.`;
        fileContext = `\n\n📎 File uploaded by user:\n- filename: ${fileInfo.filename ?? 'unknown'}\n- type: ${fileInfo.type ?? 'unknown'}${localInfo}`;
      }

      const contextBlock = [
        ctxLines.length ? `\n\nUser context:\n${ctxLines.join('\n')}` : '',
        historyLines.length ? `\n\nRecent conversation:\n${historyLines.join('\n')}` : '',
        fileContext,
        `\n\nWhen using remember/recall/set_secret/list_secrets tools, always pass ownerId="${ownerId}".`,
        (() => {
          const bridge = getDesktopBridge();
          if (!bridge) return '';
          const devices = bridge.listOnlineDevices(ownerId);
          if (devices.length === 0) return '';
          const deviceLines = devices.map((d: { deviceName: string; platform: string; capabilities: string[] }) => `- ${d.deviceName} (${d.platform}) — capabilities: ${d.capabilities.join(', ')}`);
          return `\n\nDesktop devices online (${devices.length}):\n${deviceLines.join('\n')}\nYou can use desktop_* tools to interact with the user's local machine. The user's device is connected and ready.\nWhen you take a screenshot with desktop_screenshot, it returns a filePath. Use telegram_send_file with type=photo and that filePath to send the image to the user. Do NOT try to send image data as text.`;
        })(),
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
        maxSteps: stepsForMessage(text),
      });
      const runId = createdRun.id;

      const memory = await getGlobalMemoryClient();

      // Load user's saved context (preferences, facts) — Smart Memory
      const userContextItems = await userContext.getAll(ownerId);
      log.info({ ownerId, contextKeys: Object.keys(userContextItems).length }, 'user context loaded');

      // Load user's default project — Project Context
      const defaultProject = await userProjects.getDefault(ownerId);
      if (defaultProject) {
        userContextItems['active_project'] = `${defaultProject.name} (${defaultProject.path ?? defaultProject.repoUrl ?? 'no path'})`;
        log.info({ ownerId, project: defaultProject.name }, 'default project injected');
      }

      // Progress tracking state — declared before createRunner so onStep closure can access
      let progressMessageId: number | null = null;
      let lastProgressEditMs = 0;

      // Send initial progress message
      const initialProgress = buildProgressBar(0, 10, 'Starting...');
      const progressResult = await sendMessageWithOptions(cfg.TELEGRAM_BOT_TOKEN, {
        chatId,
        text: initialProgress,
      });
      progressMessageId = progressResult.messageId ?? null;

      const runner = createRunner({
        runId,
        agentId,
        executeTool: (name, params) => {
          const p = params as Record<string, unknown>;
          if (['remember', 'recall', 'set_secret', 'list_secrets', 'set_project', 'get_project'].includes(name)) {
            p.ownerId = ownerId;
          }
          if (name.startsWith('desktop_')) {
            (globalThis as Record<string, unknown>).__currentUserId = desktopUserId;
            (globalThis as Record<string, unknown>).__currentChatId = String(chatId);
          }
          if (name === 'telegram_send_file' && !p.chatId) {
            p.chatId = chatId;
          }
          return registry.execute(name, p);
        },
        memory,
        userContextItems,
        enablePlanning: true,
        onStep: (step) => {
          if (progressMessageId === null) return;
          const now = Date.now();
          if (now - lastProgressEditMs < 2000) return;
          lastProgressEditMs = now;
          const maxSteps = 10;
          const currentStep = step.index + 1;
          const actionLabel = step.action?.name ? `Step ${currentStep}: ${step.action.name}` : `Step ${currentStep}`;
          const bar = buildProgressBar(currentStep, maxSteps, actionLabel);
          editMessageText(
            cfg.TELEGRAM_BOT_TOKEN,
            chatId,
            progressMessageId,
            bar,
          ).catch(() => {});
        },
      });

      // Start background run — do not await so next messages can be processed concurrently
      log.info({ runId, chatId }, 'background agent run started');
      const chatHistory = history.map((m: { role: string; content: string }) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

      runner.run({
        runId,
        agentId,
        prompt: text,
        maxSteps: stepsForMessage(text),
        systemPromptExtra: (profileSystemPrompt ? profileSystemPrompt + '\n\n' : '') + contextBlock,
        conversationHistory: chatHistory.slice(-10),
      }).then(async (result) => {
        clearInterval(typingInterval);
        const answer = result.finalAnswer?.trim() || 'لم أتمكن من إكمال المهمة.';
        await saveChatMessage(sessionId, 'assistant', answer);

        // Remove progress message and send final answer
        if (progressMessageId !== null) {
          const deleted = await deleteMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, progressMessageId);
          if (!deleted) {
            await editMessageText(cfg.TELEGRAM_BOT_TOKEN, chatId, progressMessageId, '✅ Done').catch(() => {});
          }
        }

        await sendTelegramMessage(cfg.TELEGRAM_BOT_TOKEN, chatId, answer);
        log.info({ runId, chatId, steps: result.steps.length }, 'background agent run completed');
      }).catch(async (err) => {
        clearInterval(typingInterval);
        log.error({ chatId, err }, 'background agent run failed');

        // Update progress message to show error
        if (progressMessageId !== null) {
          await editMessageText(cfg.TELEGRAM_BOT_TOKEN, chatId, progressMessageId, '❌ Failed').catch(() => {});
        }

        await sendTelegramMessage(
          cfg.TELEGRAM_BOT_TOKEN,
          chatId,
          '❌ حدث خطأ أثناء تنفيذ المهمة. حاول مرة أخرى.',
        );
      });

    } catch (err) {
      clearInterval(typingInterval);
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
        body: JSON.stringify({
          url: webhookUrl,
          drop_pending_updates: true,
          ...(cfg.TELEGRAM_WEBHOOK_SECRET ? { secret_token: cfg.TELEGRAM_WEBHOOK_SECRET } : {}),
        }),
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
