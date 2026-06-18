export async function googleDrive(params: { action: 'list' | 'upload' | 'download' | 'search'; query?: string; fileId?: string; content?: string; name?: string; mimeType?: string }): Promise<string> {
  const { action, query, fileId, content, name, mimeType } = params;
  const token = process.env['GOOGLE_DRIVE_TOKEN'];

  if (!token) throw new Error('GOOGLE_DRIVE_TOKEN not configured');

  const baseUrl = 'https://www.googleapis.com/drive/v3';
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };

  switch (action) {
    case 'list': {
      const q = query ? `&q=${encodeURIComponent(query)}` : '';
      const response = await fetch(`${baseUrl}/files?pageSize=20&fields=files(id,name,mimeType,size,modifiedTime)${q}`, { headers });
      if (!response.ok) throw new Error(`Drive list failed: ${response.status}`);
      return response.text();
    }
    case 'search': {
      if (!query) throw new Error('query required for search');
      const response = await fetch(`${baseUrl}/files?q=${encodeURIComponent(`name contains '${query}'`)}&fields=files(id,name,mimeType)`, { headers });
      if (!response.ok) throw new Error(`Drive search failed: ${response.status}`);
      return response.text();
    }
    case 'download': {
      if (!fileId) throw new Error('fileId required for download');
      const response = await fetch(`${baseUrl}/files/${fileId}?alt=media`, { headers });
      if (!response.ok) throw new Error(`Drive download failed: ${response.status}`);
      return response.text();
    }
    case 'upload': {
      if (!content || !name) throw new Error('content and name required for upload');
      const metadata = JSON.stringify({ name, mimeType: mimeType ?? 'text/plain' });
      const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'multipart/related; boundary=boundary' },
        body: `--boundary\r\nContent-Type: application/json\r\n\r\n${metadata}\r\n--boundary\r\nContent-Type: ${mimeType ?? 'text/plain'}\r\n\r\n${content}\r\n--boundary--`,
      });
      if (!response.ok) throw new Error(`Drive upload failed: ${response.status}`);
      return response.text();
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
