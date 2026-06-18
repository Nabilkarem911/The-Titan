export async function seoAnalyze(params: { url: string }): Promise<string> {
  const { url } = params;
  if (!url) throw new Error('url is required');

  const response = await fetch(url, { headers: { 'User-Agent': 'TitanSEOBot/1.0' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const html = await response.text();
  const issues: string[] = [];
  const good: string[] = [];
  let score = 100;

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!title) { issues.push('Missing <title> tag'); score -= 15; } else if (title.length < 10 || title.length > 70) { issues.push(`Title length: ${title.length} (ideal: 10-70)`); score -= 5; } else { good.push(`Title: "${title}" (${title.length} chars)`); }

  const metaDesc = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1];
  if (!metaDesc) { issues.push('Missing meta description'); score -= 10; } else if (metaDesc.length < 50 || metaDesc.length > 160) { issues.push(`Meta description length: ${metaDesc.length} (ideal: 50-160)`); score -= 5; } else { good.push(`Meta description: ${metaDesc.length} chars`); }

  const h1s = (html.match(/<h1[^>]*>/gi) ?? []).length;
  if (h1s === 0) { issues.push('No <h1> tag found'); score -= 10; } else if (h1s > 1) { issues.push(`Multiple <h1> tags (${h1s})`); score -= 5; } else { good.push('Single <h1> tag'); }

  if (!html.match(/<meta[^>]*name=["']viewport["']/i)) { issues.push('Missing viewport meta (mobile)'); score -= 10; } else { good.push('Viewport meta present'); }
  if (!html.match(/<html[^>]*lang=/i)) { issues.push('Missing lang attribute on <html>'); score -= 5; } else { good.push('Lang attribute present'); }

  const imgCount = (html.match(/<img/gi) ?? []).length;
  const imgNoAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) ?? []).length;
  if (imgNoAlt > 0) { issues.push(`${imgNoAlt}/${imgCount} images missing alt text`); score -= imgNoAlt * 2; }

  if (!html.includes('https://') && !html.includes('rel="canonical"')) { issues.push('No canonical URL'); score -= 5; }
  if (!html.match(/<meta[^>]*property=["']og:/i)) { issues.push('Missing Open Graph tags'); score -= 5; } else { good.push('Open Graph tags present'); }

  return JSON.stringify({ url, score: Math.max(0, score), title, metaDescription: metaDesc?.slice(0, 160), h1Count: h1s, imageCount: imgCount, imagesWithoutAlt: imgNoAlt, issues, good });
}
