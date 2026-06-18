export async function cronManage(params: { action: 'list' | 'create' | 'delete' | 'toggle'; name?: string; schedule?: string; command?: string; jobId?: string; enabled?: boolean }): Promise<string> {
  // This tool manages Titan's internal cron system via API
  const baseUrl = process.env['TITAN_API_URL'] ?? 'http://localhost:3000';
  const apiKey = process.env['TITAN_API_KEY'] ?? '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  switch (params.action) {
    case 'list': {
      const res = await fetch(`${baseUrl}/api/v1/cron`, { headers });
      if (!res.ok) throw new Error(`Failed to list cron jobs: ${res.status}`);
      return res.text();
    }
    case 'create': {
      if (!params.name || !params.schedule || !params.command) throw new Error('name, schedule, and command required');
      const res = await fetch(`${baseUrl}/api/v1/cron`, {
        method: 'POST', headers,
        body: JSON.stringify({ name: params.name, schedule: params.schedule, command: params.command }),
      });
      if (!res.ok) throw new Error(`Failed to create cron: ${res.status}`);
      return res.text();
    }
    case 'delete': {
      if (!params.jobId) throw new Error('jobId required');
      const res = await fetch(`${baseUrl}/api/v1/cron/${params.jobId}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`Failed to delete cron: ${res.status}`);
      return JSON.stringify({ deleted: params.jobId });
    }
    case 'toggle': {
      if (!params.jobId) throw new Error('jobId required');
      const res = await fetch(`${baseUrl}/api/v1/cron/${params.jobId}`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ enabled: params.enabled ?? true }),
      });
      if (!res.ok) throw new Error(`Failed to toggle cron: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
