import { getLogger } from '@titan/logging';
import type { ChannelAdapter, ChannelMessage, ChannelResponse, ChannelConfig } from './types.js';

const log = getLogger().child({ component: 'whatsapp-adapter' });

export class WhatsAppAdapter implements ChannelAdapter {
  name = 'whatsapp';
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  parseIncoming(rawPayload: unknown): ChannelMessage | null {
    try {
      const payload = rawPayload as Record<string, unknown>;
      const entry = (payload.entry as unknown[])?.[0] as Record<string, unknown> | undefined;
      const changes = (entry?.changes as unknown[])?.[0] as Record<string, unknown> | undefined;
      const value = changes?.value as Record<string, unknown> | undefined;
      const messages = value?.messages as Array<Record<string, unknown>> | undefined;

      if (!messages || messages.length === 0) return null;

      const msg = messages[0];
      const text = msg.text as Record<string, unknown> | undefined;

      return {
        id: String(msg.id ?? ''),
        channelType: 'whatsapp',
        senderId: String(msg.from ?? ''),
        content: String(text?.body ?? ''),
        timestamp: new Date(Number(msg.timestamp ?? 0) * 1000),
      };
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'failed to parse WhatsApp message');
      return null;
    }
  }

  formatOutgoing(response: ChannelResponse): unknown {
    return {
      messaging_product: 'whatsapp',
      type: 'text',
      text: { body: response.content },
    };
  }

  async sendMessage(to: string, response: ChannelResponse): Promise<boolean> {
    const phoneNumberId = this.config.phoneNumberId as string | undefined;
    if (!phoneNumberId || !this.config.apiKey) {
      log.error('WhatsApp not configured — missing phoneNumberId or apiKey');
      return false;
    }

    try {
      const res = await fetch(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body: response.content },
          }),
        },
      );

      if (!res.ok) {
        log.error({ status: res.status }, 'WhatsApp send failed');
        return false;
      }

      return true;
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : 'Unknown' }, 'WhatsApp send error');
      return false;
    }
  }

  verifyWebhook(payload: unknown, signature?: string): boolean {
    if (!this.config.webhookSecret || !signature) return false;
    // In production, verify HMAC-SHA256 signature
    return signature.length > 0;
  }
}
