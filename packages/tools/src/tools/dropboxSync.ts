export async function dropboxSync(params: { action: 'list' | 'upload' | 'download' | 'search'; path?: string; content?: string; query?: string }): Promise<string> {
  const token = process.env['DROPBOX_ACCESS_TOKEN'];
  if (!token) throw new Error('DROPBOX_ACCESS_TOKEN not configured');
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  switch (params.action) {
    case 'list': {
      const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', { method: 'POST', headers, body: JSON.stringify({ path: params.path ?? '', limit: 50 }) });
      if (!res.ok) throw new Error(`Dropbox list failed: ${res.status}`);
      return res.text();
    }
    case 'upload': {
      if (!params.path || !params.content) throw new Error('path and content required');
      const res = await fetch('https://content.dropboxapi.com/2/files/upload', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/octet-stream', 'Dropbox-API-Arg': JSON.stringify({ path: params.path, mode: 'overwrite' }) }, body: params.content });
      if (!res.ok) throw new Error(`Dropbox upload failed: ${res.status}`);
      return res.text();
    }
    case 'download': {
      if (!params.path) throw new Error('path required');
      const res = await fetch('https://content.dropboxapi.com/2/files/download', { method: 'POST', headers: { 'Authorization': `Bearer ${token}`, 'Dropbox-API-Arg': JSON.stringify({ path: params.path }) } });
      if (!res.ok) throw new Error(`Dropbox download failed: ${res.status}`);
      return res.text();
    }
    case 'search': {
      if (!params.query) throw new Error('query required');
      const res = await fetch('https://api.dropboxapi.com/2/files/search_v2', { method: 'POST', headers, body: JSON.stringify({ query: params.query }) });
      if (!res.ok) throw new Error(`Dropbox search failed: ${res.status}`);
      return res.text();
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
