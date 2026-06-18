import { getLogger } from '@titan/logging';
import type { ChannelAdapter, ChannelMessage, ChannelResponse, ChannelConfig } from './types.js';
import { WhatsAppAdapter } from './whatsapp.js';
import { SlackAdapter } from './slack.js';
import { DiscordAdapter } from './discord.js';

const log = getLogger().child({ component: 'channel-router' });

export class ChannelRouter {
  private adapters: Map<string, ChannelAdapter> = new Map();

  register(adapter: ChannelAdapter): void {
    this.adapters.set(adapter.name, adapter);
    log.info({ channel: adapter.name }, 'channel adapter registered');
  }

  registerFromConfig(configs: ChannelConfig[]): void {
    for (const config of configs) {
      if (!config.enabled) continue;

      switch (config.type) {
        case 'whatsapp':
          this.register(new WhatsAppAdapter(config));
          break;
        case 'slack':
          this.register(new SlackAdapter(config));
          break;
        case 'discord':
          this.register(new DiscordAdapter(config));
          break;
      }
    }
  }

  parseMessage(channelType: string, rawPayload: unknown): ChannelMessage | null {
    const adapter = this.adapters.get(channelType);
    if (!adapter) {
      log.warn({ channel: channelType }, 'no adapter registered');
      return null;
    }
    return adapter.parseIncoming(rawPayload);
  }

  async sendResponse(channelType: string, to: string, response: ChannelResponse): Promise<boolean> {
    const adapter = this.adapters.get(channelType);
    if (!adapter) {
      log.warn({ channel: channelType }, 'no adapter for response');
      return false;
    }
    return adapter.sendMessage(to, response);
  }

  verifyWebhook(channelType: string, payload: unknown, signature?: string): boolean {
    const adapter = this.adapters.get(channelType);
    if (!adapter?.verifyWebhook) return false;
    return adapter.verifyWebhook(payload, signature);
  }

  listChannels(): string[] {
    return Array.from(this.adapters.keys());
  }

  getAdapter(name: string): ChannelAdapter | undefined {
    return this.adapters.get(name);
  }
}
