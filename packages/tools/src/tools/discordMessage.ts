export async function discordMessage(params: { action: 'send' | 'edit' | 'delete' | 'list_channels'; channelId?: string; messageId?: string; content?: string; guildId?: string }): Promise<string> {
  const token = process.env['DISCORD_BOT_TOKEN'];
  if (!token) throw new Error('DISCORD_BOT_TOKEN not configured');
  const headers = { 'Authorization': `Bot ${token}`, 'Content-Type': 'application/json' };
  const base = 'https://discord.com/api/v10';

  switch (params.action) {
    case 'send': {
      if (!params.channelId || !params.content) throw new Error('channelId and content required');
      const res = await fetch(`${base}/channels/${params.channelId}/messages`, { method: 'POST', headers, body: JSON.stringify({ content: params.content.slice(0, 2000) }) });
      if (!res.ok) throw new Error(`Discord send failed: ${res.status}`);
      return res.text();
    }
    case 'edit': {
      if (!params.channelId || !params.messageId || !params.content) throw new Error('channelId, messageId, content required');
      const res = await fetch(`${base}/channels/${params.channelId}/messages/${params.messageId}`, { method: 'PATCH', headers, body: JSON.stringify({ content: params.content.slice(0, 2000) }) });
      if (!res.ok) throw new Error(`Discord edit failed: ${res.status}`);
      return res.text();
    }
    case 'delete': {
      if (!params.channelId || !params.messageId) throw new Error('channelId and messageId required');
      const res = await fetch(`${base}/channels/${params.channelId}/messages/${params.messageId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Discord delete failed: ${res.status}`);
      return JSON.stringify({ deleted: true });
    }
    case 'list_channels': {
      if (!params.guildId) throw new Error('guildId required');
      const res = await fetch(`${base}/guilds/${params.guildId}/channels`, { headers });
      if (!res.ok) throw new Error(`Discord list failed: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
