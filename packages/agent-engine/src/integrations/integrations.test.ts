import { describe, it, expect } from 'vitest';
import { WhatsAppAdapter } from './whatsapp.js';
import { SlackAdapter } from './slack.js';
import { DiscordAdapter } from './discord.js';
import { ChannelRouter } from './channel-router.js';

// ── WhatsApp ──

describe('WhatsAppAdapter', () => {
  const adapter = new WhatsAppAdapter({ type: 'whatsapp', enabled: true });

  it('parses incoming WhatsApp message', () => {
    const payload = {
      entry: [{
        changes: [{
          value: {
            messages: [{ id: 'msg1', from: '201234567890', text: { body: 'مرحبا' }, timestamp: '1700000000' }],
          },
        }],
      }],
    };

    const msg = adapter.parseIncoming(payload);
    expect(msg).not.toBeNull();
    expect(msg!.content).toBe('مرحبا');
    expect(msg!.senderId).toBe('201234567890');
    expect(msg!.channelType).toBe('whatsapp');
  });

  it('returns null for empty payload', () => {
    expect(adapter.parseIncoming({})).toBeNull();
  });

  it('formats outgoing message', () => {
    const formatted = adapter.formatOutgoing({ content: 'Hello!' });
    expect(formatted).toEqual({
      messaging_product: 'whatsapp',
      type: 'text',
      text: { body: 'Hello!' },
    });
  });
});

// ── Slack ──

describe('SlackAdapter', () => {
  const adapter = new SlackAdapter({ type: 'slack', enabled: true });

  it('parses incoming Slack message', () => {
    const payload = {
      event: { type: 'message', user: 'U123', text: 'Hello from Slack', client_msg_id: 'msg1', ts: '1700000000.000000', channel: 'C123' },
    };

    const msg = adapter.parseIncoming(payload);
    expect(msg).not.toBeNull();
    expect(msg!.content).toBe('Hello from Slack');
    expect(msg!.channelType).toBe('slack');
  });

  it('ignores bot messages', () => {
    const payload = { event: { type: 'message', bot_id: 'B123', text: 'Bot msg' } };
    expect(adapter.parseIncoming(payload)).toBeNull();
  });

  it('formats outgoing with thread', () => {
    const formatted = adapter.formatOutgoing({ content: 'Reply', metadata: { threadTs: '123.456' } });
    expect(formatted).toEqual({ text: 'Reply', thread_ts: '123.456' });
  });
});

// ── Discord ──

describe('DiscordAdapter', () => {
  const adapter = new DiscordAdapter({ type: 'discord', enabled: true });

  it('parses incoming Discord message', () => {
    const payload = {
      t: 'MESSAGE_CREATE',
      d: { id: 'msg1', content: 'Hello Discord', author: { id: 'U1', username: 'testuser' }, channel_id: 'C1', timestamp: '2024-01-01T00:00:00Z' },
    };

    const msg = adapter.parseIncoming(payload);
    expect(msg).not.toBeNull();
    expect(msg!.content).toBe('Hello Discord');
    expect(msg!.senderName).toBe('testuser');
  });

  it('ignores bot messages', () => {
    const payload = { t: 'MESSAGE_CREATE', d: { content: 'Bot', author: { id: 'B1', bot: true } } };
    expect(adapter.parseIncoming(payload)).toBeNull();
  });

  it('truncates outgoing to 2000 chars', () => {
    const longText = 'x'.repeat(3000);
    const formatted = adapter.formatOutgoing({ content: longText }) as { content: string };
    expect(formatted.content.length).toBe(2000);
  });
});

// ── Channel Router ──

describe('ChannelRouter', () => {
  it('registers and lists channels', () => {
    const router = new ChannelRouter();
    router.register(new WhatsAppAdapter({ type: 'whatsapp', enabled: true }));
    router.register(new SlackAdapter({ type: 'slack', enabled: true }));
    expect(router.listChannels()).toEqual(['whatsapp', 'slack']);
  });

  it('parses messages by channel type', () => {
    const router = new ChannelRouter();
    router.register(new SlackAdapter({ type: 'slack', enabled: true }));

    const msg = router.parseMessage('slack', {
      event: { type: 'message', user: 'U1', text: 'Test', ts: '123' },
    });
    expect(msg?.content).toBe('Test');
  });

  it('returns null for unknown channel', () => {
    const router = new ChannelRouter();
    expect(router.parseMessage('unknown', {})).toBeNull();
  });

  it('registers from config', () => {
    const router = new ChannelRouter();
    router.registerFromConfig([
      { type: 'whatsapp', enabled: true },
      { type: 'slack', enabled: false },
      { type: 'discord', enabled: true },
    ]);
    expect(router.listChannels()).toEqual(['whatsapp', 'discord']);
  });
});
