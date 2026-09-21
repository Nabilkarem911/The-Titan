import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-http-request' });

export async function httpRequest(input: {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  const { url, method = 'GET', headers = {}, body, timeoutMs = 15_000 } = input;
  log.info({ url, method }, 'http request');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ?? undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await res.text();
    const resHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => { resHeaders[k] = v; });

    log.info({ url, status: res.status }, 'http request complete');
    return { status: res.status, headers: resHeaders, // ⚠️ كان 200,000 حرف = ~60 ألف توكن للطلب الواحد ✗
    body: text.substring(0, 10_000) };
  } catch (err) {
    clearTimeout(timer);
    throw new Error(`HTTP request failed: ${err instanceof Error ? err.message : 'Unknown'}`, { cause: err });
  }
}
