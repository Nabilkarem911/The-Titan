export async function notionApi(params: { action: 'search' | 'create_page' | 'query_db' | 'get_page'; query?: string; databaseId?: string; pageId?: string; title?: string; content?: string; properties?: Record<string, unknown> }): Promise<string> {
  const token = process.env['NOTION_TOKEN'];
  if (!token) throw new Error('NOTION_TOKEN not configured');

  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Notion-Version': '2022-06-28' };
  const base = 'https://api.notion.com/v1';

  switch (params.action) {
    case 'search': {
      const res = await fetch(`${base}/search`, { method: 'POST', headers, body: JSON.stringify({ query: params.query, page_size: 10 }) });
      if (!res.ok) throw new Error(`Notion search failed: ${res.status}`);
      return res.text();
    }
    case 'create_page': {
      if (!params.databaseId) throw new Error('databaseId required');
      const body: Record<string, unknown> = { parent: { database_id: params.databaseId }, properties: params.properties ?? {} };
      if (params.title) { body.properties = { ...(body.properties as Record<string, unknown>), Name: { title: [{ text: { content: params.title } }] } }; }
      if (params.content) { body.children = [{ object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: params.content } }] } }]; }
      const res = await fetch(`${base}/pages`, { method: 'POST', headers, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Notion create failed: ${res.status}`);
      return res.text();
    }
    case 'query_db': {
      if (!params.databaseId) throw new Error('databaseId required');
      const res = await fetch(`${base}/databases/${params.databaseId}/query`, { method: 'POST', headers, body: JSON.stringify({ page_size: 20 }) });
      if (!res.ok) throw new Error(`Notion query failed: ${res.status}`);
      return res.text();
    }
    case 'get_page': {
      if (!params.pageId) throw new Error('pageId required');
      const res = await fetch(`${base}/pages/${params.pageId}`, { headers });
      if (!res.ok) throw new Error(`Notion get failed: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
