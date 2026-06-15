import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-telegram-send-file' });

export async function telegramSendFile(input: {
  token: string;
  chatId: number | string;
  filePath: string;
  caption?: string;
  type?: 'document' | 'photo';
}): Promise<{ sent: boolean; fileId?: string }> {
  const { token, chatId, filePath, caption, type = 'document' } = input;
  log.info({ chatId, filePath, type }, 'sending file to telegram');

  const fileContent = await readFile(filePath);
  const fileName = basename(filePath);

  const formData = new FormData();
  formData.append('chat_id', String(chatId));
  if (caption) formData.append('caption', caption);
  formData.append(type, new Blob([fileContent]), fileName);

  const endpoint = type === 'photo' ? 'sendPhoto' : 'sendDocument';
  const res = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Telegram send file failed: ${res.status} ${err}`);
  }

  const data = await res.json() as { ok: boolean; result?: { document?: { file_id: string }; photo?: Array<{ file_id: string }> } };
  const fileId = data.result?.document?.file_id ?? data.result?.photo?.[0]?.file_id;

  log.info({ chatId, fileId }, 'file sent to telegram');
  return { sent: true, fileId };
}
