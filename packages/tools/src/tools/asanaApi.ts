export async function asanaApi(params: { action: 'list_tasks' | 'create_task' | 'update_task' | 'search'; projectId?: string; taskId?: string; name?: string; notes?: string; query?: string; workspaceId?: string }): Promise<string> {
  const token = process.env['ASANA_ACCESS_TOKEN'];
  if (!token) throw new Error('ASANA_ACCESS_TOKEN not configured');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
  const base = 'https://app.asana.com/api/1.0';

  switch (params.action) {
    case 'list_tasks': {
      if (!params.projectId) throw new Error('projectId required');
      const res = await fetch(`${base}/projects/${params.projectId}/tasks?opt_fields=name,completed,due_on,assignee.name`, { headers });
      if (!res.ok) throw new Error(`Asana failed: ${res.status}`);
      return res.text();
    }
    case 'create_task': {
      if (!params.projectId || !params.name) throw new Error('projectId and name required');
      const res = await fetch(`${base}/tasks`, { method: 'POST', headers, body: JSON.stringify({ data: { projects: [params.projectId], name: params.name, notes: params.notes ?? '' } }) });
      if (!res.ok) throw new Error(`Asana failed: ${res.status}`);
      return res.text();
    }
    case 'update_task': {
      if (!params.taskId) throw new Error('taskId required');
      const data: Record<string, unknown> = {};
      if (params.name) data.name = params.name;
      if (params.notes) data.notes = params.notes;
      const res = await fetch(`${base}/tasks/${params.taskId}`, { method: 'PUT', headers, body: JSON.stringify({ data }) });
      if (!res.ok) throw new Error(`Asana failed: ${res.status}`);
      return res.text();
    }
    case 'search': {
      if (!params.workspaceId || !params.query) throw new Error('workspaceId and query required');
      const res = await fetch(`${base}/workspaces/${params.workspaceId}/tasks/search?text=${encodeURIComponent(params.query)}`, { headers });
      if (!res.ok) throw new Error(`Asana failed: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
