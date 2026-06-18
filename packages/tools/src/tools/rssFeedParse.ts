export async function rssFeedParse(params: { url: string; limit?: number }): Promise<string> {
  const { url, limit = 10 } = params;
  if (!url) throw new Error('url is required');

  const response = await fetch(url, { headers: { 'User-Agent': 'TitanBot/1.0', 'Accept': 'application/rss+xml, application/xml, text/xml' } });
  if (!response.ok) throw new Error(`Feed fetch failed: ${response.status}`);

  const xml = await response.text();
  const items = parseRssItems(xml, limit);
  const title = xml.match(/<channel>[\s\S]*?<title>([^<]+)<\/title>/)?.[1] ?? 'Unknown Feed';

  return JSON.stringify({ feedTitle: title, itemCount: items.length, items });
}

function parseRssItems(xml: string, limit: number): Array<{ title: string; link: string; date?: string; description?: string }> {
  const items: Array<{ title: string; link: string; date?: string; description?: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const content = match[1];
    items.push({
      title: content.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ?? '',
      link: content.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() ?? '',
      date: content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim(),
      description: content.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1]?.trim()?.slice(0, 300),
    });
  }

  // Try Atom format
  if (items.length === 0) {
    const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
    while ((match = entryRegex.exec(xml)) !== null && items.length < limit) {
      const content = match[1];
      items.push({
        title: content.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? '',
        link: content.match(/<link[^>]*href=["']([^"']+)["']/)?.[1] ?? '',
        date: content.match(/<updated>([\s\S]*?)<\/updated>/)?.[1]?.trim(),
        description: content.match(/<summary[^>]*>([\s\S]*?)<\/summary>/)?.[1]?.trim()?.slice(0, 300),
      });
    }
  }

  return items;
}
