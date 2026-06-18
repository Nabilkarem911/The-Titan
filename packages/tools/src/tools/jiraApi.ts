export async function jiraApi(params: { action: 'create' | 'search' | 'get' | 'update' | 'transition'; domain?: string; projectKey?: string; issueKey?: string; summary?: string; description?: string; issueType?: string; jql?: string; statusId?: string }): Promise<string> {
  const domain = params.domain ?? process.env['JIRA_DOMAIN'];
  const email = process.env['JIRA_EMAIL'];
  const token = process.env['JIRA_API_TOKEN'];
  if (!domain || !email || !token) throw new Error('JIRA_DOMAIN, JIRA_EMAIL, JIRA_API_TOKEN required');

  const headers = { 'Authorization': 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64'), 'Content-Type': 'application/json', 'Accept': 'application/json' };
  const base = `https://${domain}/rest/api/3`;

  switch (params.action) {
    case 'create': {
      if (!params.projectKey || !params.summary) throw new Error('projectKey and summary required');
      const res = await fetch(`${base}/issue`, { method: 'POST', headers, body: JSON.stringify({ fields: { project: { key: params.projectKey }, summary: params.summary, description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description ?? '' }] }] }, issuetype: { name: params.issueType ?? 'Task' } } }) });
      if (!res.ok) throw new Error(`Jira create failed: ${res.status}`);
      return res.text();
    }
    case 'search': {
      const jql = params.jql ?? `project = ${params.projectKey ?? 'ALL'} ORDER BY created DESC`;
      const res = await fetch(`${base}/search?jql=${encodeURIComponent(jql)}&maxResults=20`, { headers });
      if (!res.ok) throw new Error(`Jira search failed: ${res.status}`);
      return res.text();
    }
    case 'get': {
      if (!params.issueKey) throw new Error('issueKey required');
      const res = await fetch(`${base}/issue/${params.issueKey}`, { headers });
      if (!res.ok) throw new Error(`Jira get failed: ${res.status}`);
      return res.text();
    }
    case 'update': {
      if (!params.issueKey) throw new Error('issueKey required');
      const fields: Record<string, unknown> = {};
      if (params.summary) fields.summary = params.summary;
      if (params.description) fields.description = { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: params.description }] }] };
      const res = await fetch(`${base}/issue/${params.issueKey}`, { method: 'PUT', headers, body: JSON.stringify({ fields }) });
      if (!res.ok) throw new Error(`Jira update failed: ${res.status}`);
      return JSON.stringify({ success: true, issueKey: params.issueKey });
    }
    case 'transition': {
      if (!params.issueKey || !params.statusId) throw new Error('issueKey and statusId required');
      const res = await fetch(`${base}/issue/${params.issueKey}/transitions`, { method: 'POST', headers, body: JSON.stringify({ transition: { id: params.statusId } }) });
      if (!res.ok) throw new Error(`Jira transition failed: ${res.status}`);
      return JSON.stringify({ success: true });
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
