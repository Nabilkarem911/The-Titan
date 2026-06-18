export async function linearApi(params: { action: 'create_issue' | 'list_issues' | 'update_issue' | 'search'; teamId?: string; issueId?: string; title?: string; description?: string; status?: string; query?: string; priority?: number }): Promise<string> {
  const token = process.env['LINEAR_API_KEY'];
  if (!token) throw new Error('LINEAR_API_KEY not configured');

  const headers = { 'Authorization': token, 'Content-Type': 'application/json' };
  const endpoint = 'https://api.linear.app/graphql';

  switch (params.action) {
    case 'create_issue': {
      if (!params.teamId || !params.title) throw new Error('teamId and title required');
      const mutation = `mutation { issueCreate(input: { teamId: "${params.teamId}", title: "${params.title}", description: "${params.description ?? ''}", priority: ${params.priority ?? 0} }) { success issue { id identifier title url } } }`;
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation }) });
      if (!res.ok) throw new Error(`Linear create failed: ${res.status}`);
      return res.text();
    }
    case 'list_issues': {
      const filter = params.teamId ? `filter: { team: { id: { eq: "${params.teamId}" } } }` : '';
      const query = `{ issues(first: 20 ${filter}) { nodes { id identifier title state { name } priority assignee { name } url } } }`;
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query }) });
      if (!res.ok) throw new Error(`Linear list failed: ${res.status}`);
      return res.text();
    }
    case 'update_issue': {
      if (!params.issueId) throw new Error('issueId required');
      const updates: string[] = [];
      if (params.title) updates.push(`title: "${params.title}"`);
      if (params.description) updates.push(`description: "${params.description}"`);
      if (params.priority !== undefined) updates.push(`priority: ${params.priority}`);
      const mutation = `mutation { issueUpdate(id: "${params.issueId}", input: { ${updates.join(', ')} }) { success issue { id title } } }`;
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query: mutation }) });
      if (!res.ok) throw new Error(`Linear update failed: ${res.status}`);
      return res.text();
    }
    case 'search': {
      if (!params.query) throw new Error('query required');
      const query = `{ issueSearch(query: "${params.query}", first: 10) { nodes { id identifier title state { name } url } } }`;
      const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify({ query }) });
      if (!res.ok) throw new Error(`Linear search failed: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
