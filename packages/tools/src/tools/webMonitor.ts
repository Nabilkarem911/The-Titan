import { createHash } from 'node:crypto';

const cache = new Map<string, { hash: string; content: string; checkedAt: Date }>();

export async function webMonitor(params: { url: string; action?: 'check' | 'diff' | 'status'; selector?: string }): Promise<string> {
  const { url, action = 'check' } = params;
  if (!url) throw new Error('url is required');

  const response = await fetch(url, { headers: { 'User-Agent': 'TitanBot/1.0' }, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const content = await response.text();
  const textContent = content.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const currentHash = createHash('sha256').update(textContent).digest('hex').slice(0, 16);

  const previous = cache.get(url);
  cache.set(url, { hash: currentHash, content: textContent.slice(0, 10000), checkedAt: new Date() });

  switch (action) {
    case 'check': {
      if (!previous) return JSON.stringify({ changed: false, firstCheck: true, hash: currentHash, contentLength: textContent.length });
      const changed = previous.hash !== currentHash;
      return JSON.stringify({ changed, previousHash: previous.hash, currentHash, previousCheck: previous.checkedAt });
    }
    case 'diff': {
      if (!previous) return JSON.stringify({ diff: 'No previous version to compare', firstCheck: true });
      if (previous.hash === currentHash) return JSON.stringify({ diff: 'No changes detected' });
      const oldWords = new Set(previous.content.split(/\s+/));
      const newWords = textContent.split(/\s+/);
      const added = newWords.filter((w) => !oldWords.has(w)).slice(0, 50);
      return JSON.stringify({ changed: true, addedWords: added.length, sampleAdded: added.slice(0, 20).join(' ') });
    }
    case 'status': {
      return JSON.stringify({ url, statusCode: response.status, contentLength: textContent.length, hash: currentHash, cached: !!previous, lastCheck: previous?.checkedAt });
    }
    default: throw new Error(`Unknown action: ${action}`);
  }
}
