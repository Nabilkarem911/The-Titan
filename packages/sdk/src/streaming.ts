import type { StreamEvent } from './types.js';

export type StreamCallback = (event: StreamEvent) => void;

export async function* parseSSEStream(
  response: Response,
): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            yield { type: 'done', data: null };
            return;
          }
          try {
            const parsed = JSON.parse(data) as StreamEvent;
            yield parsed;
          } catch {
            yield { type: 'token', data };
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function collectStream(stream: AsyncGenerator<StreamEvent>): Promise<string> {
  let result = '';
  for await (const event of stream) {
    if (event.type === 'token' && typeof event.data === 'string') {
      result += event.data;
    } else if (event.type === 'done') {
      break;
    }
  }
  return result;
}

export function streamToCallback(
  stream: AsyncGenerator<StreamEvent>,
  callback: StreamCallback,
): Promise<void> {
  return (async () => {
    for await (const event of stream) {
      callback(event);
      if (event.type === 'done' || event.type === 'error') break;
    }
  })();
}
