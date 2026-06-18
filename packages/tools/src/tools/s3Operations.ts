export async function s3Operations(params: { action: 'upload' | 'download' | 'list' | 'delete'; bucket: string; key?: string; content?: string; prefix?: string }): Promise<string> {
  const { action, bucket, key, content, prefix } = params;
  const region = process.env['AWS_REGION'] ?? 'us-east-1';
  const accessKey = process.env['AWS_ACCESS_KEY_ID'];
  const secretKey = process.env['AWS_SECRET_ACCESS_KEY'];

  if (!accessKey || !secretKey) throw new Error('AWS credentials not configured (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');

  const baseUrl = `https://${bucket}.s3.${region}.amazonaws.com`;

  switch (action) {
    case 'list': {
      const url = prefix ? `${baseUrl}?list-type=2&prefix=${encodeURIComponent(prefix)}` : `${baseUrl}?list-type=2`;
      const response = await fetch(url, { headers: buildAwsHeaders('GET', bucket, '/', region, accessKey, secretKey) });
      if (!response.ok) throw new Error(`S3 list failed: ${response.status}`);
      return response.text();
    }
    case 'upload': {
      if (!key || !content) throw new Error('key and content required for upload');
      const response = await fetch(`${baseUrl}/${key}`, {
        method: 'PUT',
        headers: { ...buildAwsHeaders('PUT', bucket, `/${key}`, region, accessKey, secretKey), 'Content-Type': 'application/octet-stream' },
        body: content,
      });
      if (!response.ok) throw new Error(`S3 upload failed: ${response.status}`);
      return JSON.stringify({ success: true, bucket, key, url: `${baseUrl}/${key}` });
    }
    case 'download': {
      if (!key) throw new Error('key required for download');
      const response = await fetch(`${baseUrl}/${key}`, { headers: buildAwsHeaders('GET', bucket, `/${key}`, region, accessKey, secretKey) });
      if (!response.ok) throw new Error(`S3 download failed: ${response.status}`);
      return response.text();
    }
    case 'delete': {
      if (!key) throw new Error('key required for delete');
      const response = await fetch(`${baseUrl}/${key}`, {
        method: 'DELETE',
        headers: buildAwsHeaders('DELETE', bucket, `/${key}`, region, accessKey, secretKey),
      });
      if (!response.ok) throw new Error(`S3 delete failed: ${response.status}`);
      return JSON.stringify({ success: true, deleted: key });
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

function buildAwsHeaders(_method: string, _bucket: string, _path: string, _region: string, accessKey: string, _secretKey: string): Record<string, string> {
  // Simplified — production should use AWS SDK v3 or proper SigV4
  return { 'x-amz-date': new Date().toISOString().replace(/[:-]|\.\d{3}/g, ''), 'Authorization': `AWS ${accessKey}:simplified` };
}
