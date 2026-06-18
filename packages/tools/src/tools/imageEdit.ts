export async function imageEdit(params: { action: 'resize' | 'crop' | 'rotate' | 'watermark' | 'convert' | 'info'; url: string; width?: number; height?: number; angle?: number; text?: string; format?: string }): Promise<string> {
  const { action, url, width, height, angle, text, format } = params;
  if (!url) throw new Error('url is required');

  switch (action) {
    case 'info': {
      const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
      return JSON.stringify({ url, contentType: res.headers.get('content-type'), size: res.headers.get('content-length'), status: res.status });
    }
    case 'resize': return JSON.stringify({ action: 'resize', url, width: width ?? 800, height: height ?? 600, note: 'Use sharp or jimp library for actual resize: sharp(buffer).resize(w,h).toBuffer()' });
    case 'crop': return JSON.stringify({ action: 'crop', url, width: width ?? 400, height: height ?? 400, note: 'Use sharp: sharp(buffer).extract({left,top,width,height}).toBuffer()' });
    case 'rotate': return JSON.stringify({ action: 'rotate', url, angle: angle ?? 90, note: 'Use sharp: sharp(buffer).rotate(angle).toBuffer()' });
    case 'watermark': return JSON.stringify({ action: 'watermark', url, text: text ?? 'Titan', note: 'Use sharp composite: sharp(buffer).composite([{input: textSvg}]).toBuffer()' });
    case 'convert': return JSON.stringify({ action: 'convert', url, format: format ?? 'webp', note: 'Use sharp: sharp(buffer).toFormat(format).toBuffer()' });
    default: throw new Error(`Unknown action: ${action}`);
  }
}
