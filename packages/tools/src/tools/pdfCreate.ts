export async function pdfCreate(params: { html: string; title?: string }): Promise<string> {
  // Uses the built-in approach: generate HTML → convert
  // In production, integrate with puppeteer or pdfkit
  const { html, title } = params;
  if (!html) throw new Error('html content is required');

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title ?? 'Document'}</title>
<style>body{font-family:Arial,sans-serif;margin:40px;line-height:1.6}h1{color:#333}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}</style>
</head><body>${html}</body></html>`;

  return JSON.stringify({ success: true, html: fullHtml, title: title ?? 'Document', note: 'HTML ready for PDF conversion. Use puppeteer.pdf() or wkhtmltopdf to generate final PDF.' });
}
