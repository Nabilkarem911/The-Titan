export async function sitemapCrawl(params: { url: string; limit?: number }): Promise<string> {
  const { url, limit = 50 } = params;
  const sitemapUrl = url.endsWith('/sitemap.xml') ? url : `${url.replace(/\/$/, '')}/sitemap.xml`;

  const res = await fetch(sitemapUrl, { headers: { 'User-Agent': 'TitanBot/1.0' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Sitemap fetch failed: ${res.status}`);

  const xml = await res.text();
  const urls: Array<{ loc: string; lastmod?: string; priority?: string }> = [];
  const locRegex = /<url>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?(?:\s*<priority>([^<]+)<\/priority>)?/g;
  let match;

  while ((match = locRegex.exec(xml)) !== null && urls.length < limit) {
    urls.push({ loc: match[1].trim(), lastmod: match[2]?.trim(), priority: match[3]?.trim() });
  }

  // Check for sitemap index
  const sitemapIndex: string[] = [];
  const indexRegex = /<sitemap>\s*<loc>([^<]+)<\/loc>/g;
  while ((match = indexRegex.exec(xml)) !== null) {
    sitemapIndex.push(match[1].trim());
  }

  return JSON.stringify({ sitemapUrl, urlCount: urls.length, urls: urls.slice(0, limit), isSitemapIndex: sitemapIndex.length > 0, childSitemaps: sitemapIndex });
}
