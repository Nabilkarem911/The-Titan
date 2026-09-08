export async function networkDiagnose(params: { target: string; action?: 'ping' | 'port_check' | 'headers' | 'full' }): Promise<string> {
  const { target, action = 'full' } = params;
  if (!target) throw new Error('target is required');

  const results: Record<string, unknown> = {};

  if (action === 'full' || action === 'headers') {
    try {
      const url = target.startsWith('http') ? target : `https://${target}`;
      const start = performance.now();
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000), redirect: 'follow' });
      const latency = Math.round(performance.now() - start);
      const headers: Record<string, string> = {};
      res.headers.forEach((v, k) => { headers[k] = v; });
      results.http = { status: res.status, latencyMs: latency, headers, redirected: res.redirected, url: res.url };
    } catch (err) {
      results.http = { error: err instanceof Error ? err.message : 'Failed', reachable: false };
    }
  }

  if (action === 'full' || action === 'port_check') {
    const host = target.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
    const ports = [80, 443, 8080, 3000, 5432, 6379, 22];
    const portResults: Record<number, boolean> = {};

    for (const port of ports) {
      try {
        await fetch(`http://${host}:${port}`, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
        portResults[port] = true;
      } catch {
        portResults[port] = false;
      }
    }
    results.ports = portResults;
  }

  if (action === 'full' || action === 'ping') {
    try {
      const url = target.startsWith('http') ? target : `https://${target}`;
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const start = performance.now();
        await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
        times.push(Math.round(performance.now() - start));
      }
      results.ping = { avgMs: Math.round(times.reduce((s, t) => s + t, 0) / times.length), minMs: Math.min(...times), maxMs: Math.max(...times), samples: times.length };
    } catch (err) {
      results.ping = { error: err instanceof Error ? err.message : 'Unreachable' };
    }
  }

  return JSON.stringify({ target, ...results });
}
