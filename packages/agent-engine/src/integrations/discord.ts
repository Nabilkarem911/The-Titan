import { getLogger } from '@titan/logging';
import type { ChannelAdapter, ChannelMessage, ChannelResponse, ChannelConfig } from './types.js';

const log = getLogger().child({ component: 'discord-adapter' });

export class DiscordAdapter implements ChannelAdapter {
  name = 'discord';
  private config: ChannelConfig;

  constructor(config: ChannelConfig) {
    this.config = config;
  }

  parseIncoming(rawPayload: unknown): ChannelMessage | null {
    try {
      const payload = rawPayload as Record<string, unknown>;

      if (payload.type !== 0 && payload.t !== 'MESSAGE_CREATE') return null;

      const data = (payload.d ?? payload) as Record<string, unknown>;
      const author = data.author as Record<string, unknown> | undefined;

      if (author?.bot) return null;

      return {
        id: String(data.id ?? ''),
        channelType: 'discord',
        senderId: String(author?.id ?? ''),
        senderName: String(author?.username ?? ''),
        content: String(data.content ?? ''),
        metadata: { channelId: data.channel_id, guildId: data.guild_id },
        timestamp: data.timestamp ? new Date(String(data.timestamp)) : new Date(),
      };
    } catch (err) {
      log.warn({ err: err instanceof Error ? err.message : 'Unknown' }, 'failed to parse Discord message');
      return null;
    }
  }

  formatOutgoing(response: ChannelResponse): unknown {
    return { content: response.content.slice(0, 2000) };
  }

  async sendMessage(to: string, response: ChannelResponse): Promise<boolean> {
    if (!this.config.botToken) {
      log.error('Discord not configured — missing botToken');
      return false;
    }

    try {
      const res = await fetch(`https://discord.com/api/v10/channels/${to}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bot ${this.config.botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: response.content.slice(0, 2000) }),
      });

      if (!res.ok) {
        log.error({ status: res.status }, 'Discord send failed');
        return false;
      }
      return true;
    } catch (err) {
      log.error({ err: err instanceof Error ? err.message : 'Unknown' }, 'Discord send error');
      return false;
    }
  }
}
