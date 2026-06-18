export interface ChannelMessage {
  id: string;
  channelType: 'whatsapp' | 'slack' | 'discord' | 'telegram' | 'webhook';
  senderId: string;
  senderName?: string;
  content: string;
  attachments?: Array<{ url: string; type: string; name: string }>;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

export interface ChannelResponse {
  content: string;
  attachments?: Array<{ url: string; type: string }>;
  metadata?: Record<string, unknown>;
}

export interface ChannelAdapter {
  name: string;
  parseIncoming(rawPayload: unknown): ChannelMessage | null;
  formatOutgoing(response: ChannelResponse): unknown;
  sendMessage(to: string, response: ChannelResponse): Promise<boolean>;
  verifyWebhook?(payload: unknown, signature?: string): boolean;
}

export interface ChannelConfig {
  type: ChannelMessage['channelType'];
  enabled: boolean;
  apiKey?: string;
  webhookSecret?: string;
  botToken?: string;
  [key: string]: unknown;
}
