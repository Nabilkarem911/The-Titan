export async function gcsOperations(params: { action: 'upload' | 'download' | 'list' | 'delete'; bucket: string; object?: string; content?: string; prefix?: string }): Promise<string> {
  const token = process.env['GCS_ACCESS_TOKEN'] ?? process.env['GOOGLE_ACCESS_TOKEN'];
  if (!token) throw new Error('GCS_ACCESS_TOKEN not configured');

  const base = 'https://storage.googleapis.com/storage/v1';
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  switch (params.action) {
    case 'list': {
      const prefix = params.prefix ? `&prefix=${encodeURIComponent(params.prefix)}` : '';
      const res = await fetch(`${base}/b/${params.bucket}/o?maxResults=50${prefix}`, { headers });
      if (!res.ok) throw new Error(`GCS list failed: ${res.status}`);
      return res.text();
    }
    case 'upload': {
      if (!params.object || !params.content) throw new Error('object and content required');
      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${params.bucket}/o?uploadType=media&name=${encodeURIComponent(params.object)}`;
      const res = await fetch(uploadUrl, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/octet-stream' }, body: params.content });
      if (!res.ok) throw new Error(`GCS upload failed: ${res.status}`);
      return res.text();
    }
    case 'download': {
      if (!params.object) throw new Error('object required');
      const res = await fetch(`${base}/b/${params.bucket}/o/${encodeURIComponent(params.object)}?alt=media`, { headers });
      if (!res.ok) throw new Error(`GCS download failed: ${res.status}`);
      return res.text();
    }
    case 'delete': {
      if (!params.object) throw new Error('object required');
      const res = await fetch(`${base}/b/${params.bucket}/o/${encodeURIComponent(params.object)}`, { method: 'DELETE', headers });
      if (!res.ok) throw new Error(`GCS delete failed: ${res.status}`);
      return JSON.stringify({ deleted: params.object });
    }
    default: throw new Error(`Unknown action: ${params.action}`);
  }
}
