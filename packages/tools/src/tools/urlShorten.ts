export interface UrlShortenResult {
  originalUrl: string;
  shortUrl: string;
  provider: string;
}

export async function urlShorten(params: { url: string }): Promise<UrlShortenResult> {
  const { url } = params;

  if (!url) throw new Error('url is required');

  // Use TinyURL — no API key needed
  const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);

  if (!res.ok) throw new Error(`URL shortening failed: ${res.status}`);

  const shortUrl = await res.text();

  if (!shortUrl.startsWith('http')) {
    throw new Error(`Invalid response from TinyURL: ${shortUrl}`);
  }

  return { originalUrl: url, shortUrl: shortUrl.trim(), provider: 'TinyURL' };
}
