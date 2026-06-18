export async function slackMessage(params: { action: 'send' | 'search' | 'list_channels'; channel?: string; text?: string; query?: string; threadTs?: string }): Promise<string> {
  const token = process.env['SLACK_BOT_TOKEN'];
  if (!token) throw new Error('SLACK_BOT_TOKEN not configured');

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  switch (params.action) {
    case 'send': {
      if (!params.channel || !params.text) throw new Error('channel and text required');
      const body: Record<string, unknown> = { channel: params.channel, text: params.text };
      if (params.threadTs) body.thread_ts = params.threadTs;
      const res = await fetch('https://slack.com/api/chat.postMessage', { method: 'POST', headers, body: JSON.stringify(body) });
      return res.text();
    }
    case 'search': {
      if (!params.query) throw new Error('query required');
      const res = await fetch(`https://slack.com/api/search.messages?query=${encodeURIComponent(params.query)}&count=10`, { headers });
      return res.text();
    }
    case 'list_channels': {
      const res = await fetch('https://slack.com/api/conversations.list?types=public_channel,private_channel&limit=50', { headers });
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
