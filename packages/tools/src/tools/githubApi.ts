import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'tool-github-api' });
const GITHUB_API = 'https://api.github.com';

export async function githubApi(input: {
  endpoint: string;
  method?: string;
  body?: Record<string, unknown>;
  token: string;
}): Promise<{ status: number; data: unknown }> {
  const { endpoint, method = 'GET', body, token } = input;
  const url = endpoint.startsWith('http') ? endpoint : `${GITHUB_API}${endpoint}`;
  log.info({ url, method }, 'github api request');

  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  log.info({ url, status: res.status }, 'github api complete');
  return { status: res.status, data };
}
