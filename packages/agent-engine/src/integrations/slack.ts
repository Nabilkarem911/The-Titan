import { getLogger } from '@titan/logging';
import type { ChannelAdapter, ChannelMessage, ChannelResponse, ChannelConfig } from './types.js';

const log = getLogger().child({ component: 'slack-adapter' });

export class SlackAdapter implements ChannelAdapter {
  name = 'slack';
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  parseIncoming(rawPayload: unknown): ChannelMessage | null {
    try {
      const payload = rawPayload as Record<string, unknown>;
      const event = payload.event as Record<string, unknown> | undefined;

      if (!event || event.type !== 'message' || event.bot_id) return null;

      return {
        id: String(event.client_msg_id ?? event.ts ?? ''),
        channelType: 'slack',
        senderId: String(event.user ?? ''),
        content: String(event.text ?? ''),
        metadata: { channel: event.channel, threadTs: event.thread_ts },
        timestamp: new Date(Number(event.ts ?? 0) * 1000),
      };
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'failed to parse Slack message');
      return null;
    }
  }

  formatOutgoing(response: ChannelResponse): unknown {
    return {
      text: response.content,
      ...(response.metadata?.threadTs ? { thread_ts: response.metadata.threadTs } : {}),
    };
  }

  async sendMessage(to: string, response: ChannelResponse): Promise<boolean> {
    if (!this.config.botToken) {
      log.error('Slack not configured — missing botToken');
      return false;
    }

    try {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: to,
          text: response.content,
          ...(response.metadata?.threadTs ? { thread_ts: response.metadata.threadTs } : {}),
        }),
      });

      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) {
        log.error({ error: data.error }, 'Slack send failed');
        return false;
      }
      return true;
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : 'Unknown' }, 'Slack send error');
      return false;
    }
  }

  verifyWebhook(payload: unknown, signature?: string): boolean {
    if (!this.config.webhookSecret || !signature) return false;
    return signature.length > 0;
  }
}
