/**
 * Telegram Rich UI helpers — inline keyboards, progress indicators,
 * MarkdownV2 formatting, callback query handling.
 *
 * All functions are pure (no side effects except fetch calls).
 * All fetch calls have timeout + retry + error handling.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org/bot';
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 3;
const RETRY_BACKOFF_MS = 500;

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export interface TelegramMessageOptions {
  chatId: number;
  text: string;
  parseMode?: 'HTML' | 'MarkdownV2';
  replyMarkup?: InlineKeyboardMarkup;
  disablePreview?: boolean;
}

export interface CallbackQuery {
  id: string;
  from: { id: number; first_name?: string; username?: string };
  message?: {
    message_id: number;
    chat: { id: number; type: string };
    text?: string;
  };
  data?: string;
}

/* ------------------------------------------------------------------ */
/*  MarkdownV2 escaping                                                */
/* ------------------------------------------------------------------ */

const MARKDOWN_V2_SPECIAL = ['_', '*', '[', ']', '(', ')', '~', '`', '>', '#', '+', '-', '=', '|', '{', '}', '.', '!'];

/**
 * Escape special characters for Telegram MarkdownV2 parse mode.
 * Must be applied to user-provided text that is NOT already formatted.
 */
export function escapeMarkdownV2(text: string): string {
  let result = text;
  for (const char of MARKDOWN_V2_SPECIAL) {
    result = result.replaceAll(char, `\\${char}`);
  }
  return result;
}

/**
 * Convert plain markdown (**) to MarkdownV2 format.
 * Escapes all special chars except our formatting markers.
 *
 * Telegram MarkdownV2 uses:
 *   *bold*  → bold
 *   _italic_ → italic
 *   `code`  → monospace
 *   ```block``` → preformatted
 */
export function markdownToMarkdownV2(text: string): string {
  // Extract code blocks first to preserve them
  // In MarkdownV2, content inside ``` is treated as literal — no escaping needed
  const codeBlocks: string[] = [];
  let working = text.replace(/```[\w]*\n?([\s\S]*?)```/g, (_match, code: string) => {
    codeBlocks.push(code.replace(/\n$/, ''));
    return `\x00BLOCK${codeBlocks.length - 1}\x00`;
  });

  // Extract inline code
  const inlineCodes: string[] = [];
  working = working.replace(/`([^`]+)`/g, (_match, code: string) => {
    inlineCodes.push(escapeMarkdownV2(code));
    return `\x00INLINE${inlineCodes.length - 1}\x00`;
  });

  // Bold: **text** → *text* (MarkdownV2 bold)
  // Use placeholder to protect from italic regex
  const boldMarkers: string[] = [];
  working = working.replace(/\*\*(.+?)\*\*/g, (_match, content: string) => {
    boldMarkers.push(`*${content}*`);
    return `\x00BOLD${boldMarkers.length - 1}\x00`;
  });

  // Italic: *text* → _text_ (MarkdownV2 italic)
  // Now safe — bold markers are placeholders, won't match
  const italicMarkers: string[] = [];
  working = working.replace(/(?<!\w)\*([^*]+?)\*(?!\w)/g, (_match, content: string) => {
    italicMarkers.push(`_${content}_`);
    return `\x00ITALIC${italicMarkers.length - 1}\x00`;
  });

  // Escape all remaining special chars
  working = escapeMarkdownV2(working);

  // Restore italic markers (already in MarkdownV2 format)
  working = working.replace(/\x00ITALIC(\d+)\x00/g, (_m, idx: string) => italicMarkers[Number(idx)] ?? '');

  // Restore bold markers (already in MarkdownV2 format, no escaping needed)
  working = working.replace(/\x00BOLD(\d+)\x00/g, (_m, idx: string) => boldMarkers[Number(idx)] ?? '');

  // Restore inline code
  working = working.replace(/\x00INLINE(\d+)\x00/g, (_m, idx: string) => `\`${inlineCodes[Number(idx)] ?? ''}\``);

  // Restore code blocks
  working = working.replace(/\x00BLOCK(\d+)\x00/g, (_m, idx: string) => `\`\`\`\n${codeBlocks[Number(idx)] ?? ''}\n\`\`\``);

  return working;
}

/* ------------------------------------------------------------------ */
/*  Inline keyboard builders                                           */
/* ------------------------------------------------------------------ */

/**
 * Build a keyboard with Yes/No buttons.
 */
export function buildYesNoKeyboard(prefix = 'choice'): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Yes', callback_data: `${prefix}:yes` },
        { text: '❌ No', callback_data: `${prefix}:no` },
      ],
    ],
  };
}

/**
 * Build a keyboard with multiple choice buttons (A/B/C/D).
 */
export function buildChoiceKeyboard(options: string[], prefix = 'choice'): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (let i = 0; i < options.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    for (let j = i; j < Math.min(i + 2, options.length); j++) {
      const letter = letters[j] ?? `O${j}`;
      row.push({ text: `${letter}. ${options[j]}`, callback_data: `${prefix}:${letter.toLowerCase()}` });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

/**
 * Build a keyboard with quick action buttons.
 */
export function buildQuickActionsKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '📸 Screenshot', callback_data: 'action:screenshot' },
        { text: '🖥️ System Info', callback_data: 'action:status' },
      ],
      [
        { text: '📋 Devices', callback_data: 'action:devices' },
        { text: '🧠 Memory', callback_data: 'action:memory' },
      ],
      [
        { text: '❓ Help', callback_data: 'action:help' },
      ],
    ],
  };
}

/**
 * Build a keyboard for confirming potentially destructive actions.
 */
export function buildConfirmKeyboard(action: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '⚠️ Confirm', callback_data: `confirm:${action}` },
        { text: '✖️ Cancel', callback_data: 'confirm:cancel' },
      ],
    ],
  };
}

/* ------------------------------------------------------------------ */
/*  Progress bar builder                                               */
/* ------------------------------------------------------------------ */

/**
 * Build a text-based progress bar.
 * @param current - current step number (1-indexed)
 * @param total - total steps
 * @param label - optional label for the current step
 * @returns formatted progress string
 */
export function buildProgressBar(current: number, total: number, label?: string): string {
  const clampedCurrent = Math.max(0, Math.min(current, total));
  const percentage = total > 0 ? Math.round((clampedCurrent / total) * 100) : 0;
  const filledBlocks = Math.round((percentage / 100) * 10);
  const emptyBlocks = 10 - filledBlocks;
  const bar = '█'.repeat(filledBlocks) + '░'.repeat(emptyBlocks);
  const labelStr = label ? ` — ${escapeMarkdownV2(label)}` : '';
  return `📊 Progress: [${bar}] ${percentage}% (${clampedCurrent}/${total})${labelStr}`;
}

/* ------------------------------------------------------------------ */
/*  Telegram API calls with retry + timeout                            */
/* ------------------------------------------------------------------ */

async function telegramApiCall(
  token: string,
  method: string,
  body: Record<string, unknown>,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const url = `${TELEGRAM_API_BASE}${token}/${method}`;
  let lastError = '';

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json() as { ok: boolean; result?: unknown; description?: string };
      if (data.ok) return data;

      lastError = data.description ?? `HTTP ${res.status}`;
      // Don't retry on client errors (4xx) except 429
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        return data;
      }
    } catch (err) {
      clearTimeout(timeout);
      lastError = err instanceof Error ? err.message : String(err);
    }

    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS * Math.pow(2, attempt)));
    }
  }

  return { ok: false, description: lastError };
}

/**
 * Send a message with optional inline keyboard and MarkdownV2 formatting.
 */
export async function sendMessageWithOptions(
  token: string,
  opts: TelegramMessageOptions,
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const body: Record<string, unknown> = {
    chat_id: opts.chatId,
    text: opts.text,
  };
  if (opts.parseMode) body.parse_mode = opts.parseMode;
  if (opts.replyMarkup) body.reply_markup = opts.replyMarkup;
  if (opts.disablePreview) body.disable_web_page_preview = true;

  const result = await telegramApiCall(token, 'sendMessage', body);
  if (result.ok && result.result) {
    const msg = result.result as { message_id?: number };
    return { ok: true, messageId: msg.message_id };
  }
  return { ok: false, description: result.description };
}

/**
 * Edit an existing message's text (used for progress updates).
 */
export async function editMessageText(
  token: string,
  chatId: number,
  messageId: number,
  text: string,
  parseMode?: 'HTML' | 'MarkdownV2',
  replyMarkup?: InlineKeyboardMarkup,
): Promise<boolean> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    message_id: messageId,
    text,
  };
  if (parseMode) body.parse_mode = parseMode;
  if (replyMarkup) body.reply_markup = replyMarkup;

  const result = await telegramApiCall(token, 'editMessageText', body);
  return result.ok;
}

/**
 * Answer a callback query (removes the loading indicator on the button).
 */
export async function answerCallbackQuery(
  token: string,
  callbackQueryId: string,
  text?: string,
  showAlert?: boolean,
): Promise<boolean> {
  const body: Record<string, unknown> = {
    callback_query_id: callbackQueryId,
  };
  if (text) body.text = text;
  if (showAlert) body.show_alert = true;

  const result = await telegramApiCall(token, 'answerCallbackQuery', body);
  return result.ok;
}

/**
 * Send a photo to a chat. Supports both file paths and URLs.
 */
export async function sendTelegramPhoto(
  token: string,
  chatId: number,
  photo: string,
  caption?: string,
  parseMode?: 'HTML' | 'MarkdownV2',
): Promise<{ ok: boolean; messageId?: number; description?: string }> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo,
  };
  if (caption) body.caption = caption;
  if (parseMode) body.parse_mode = parseMode;

  const result = await telegramApiCall(token, 'sendPhoto', body);
  if (result.ok && result.result) {
    const msg = result.result as { message_id?: number };
    return { ok: true, messageId: msg.message_id };
  }
  return { ok: false, description: result.description };
}

/**
 * Send multiple photos as a media group (carousel).
 * @param photoInfos - array of { photo, caption } objects
 */
export async function sendMediaGroup(
  token: string,
  chatId: number,
  photoInfos: Array<{ photo: string; caption?: string }>,
): Promise<boolean> {
  if (photoInfos.length === 0) return false;
  // Telegram limits media groups to 10 items
  const limited = photoInfos.slice(0, 10);
  const media = limited.map((info) => ({
    type: 'photo',
    media: info.photo,
    ...(info.caption ? { caption: info.caption } : {}),
  }));

  const result = await telegramApiCall(token, 'sendMediaGroup', {
    chat_id: chatId,
    media: JSON.stringify(media),
  });
  return result.ok;
}

/**
 * Delete a message from a chat.
 */
export async function deleteMessage(
  token: string,
  chatId: number,
  messageId: number,
): Promise<boolean> {
  const result = await telegramApiCall(token, 'deleteMessage', {
    chat_id: chatId,
    message_id: messageId,
  });
  return result.ok;
}

/* ------------------------------------------------------------------ */
/*  Callback data parser                                               */
/* ------------------------------------------------------------------ */

/**
 * Parse callback_data string into prefix and value.
 * Format: "prefix:value" or "prefix:value:subvalue"
 */
export function parseCallbackData(data: string): { prefix: string; value: string; parts: string[] } {
  const parts = data.split(':');
  const prefix = parts[0] ?? '';
  const value = parts.slice(1).join(':');
  return { prefix, value, parts };
}

/**
 * Validate callback data origin to prevent spoofing.
 * Checks that the callback came from the expected user.
 */
export function validateCallbackOrigin(
  callbackQuery: CallbackQuery,
  expectedUserId: number,
): boolean {
  return callbackQuery.from?.id === expectedUserId;
}
