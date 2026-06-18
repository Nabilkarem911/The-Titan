export async function reportGenerate(params: { title: string; sections: Array<{ heading: string; content: string; data?: Array<{ label: string; value: number }> }>; author?: string; format?: 'html' | 'markdown' }): Promise<string> {
  const { title, sections, author, format = 'html' } = params;
  if (!title || !sections.length) throw new Error('title and sections required');

  if (format === 'markdown') return generateMarkdown(title, sections, author);
  return generateHtml(title, sections, author);
}

function generateMarkdown(title: string, sections: Array<{ heading: string; content: string; data?: Array<{ label: string; value: number }> }>, author?: string): string {
  const lines: string[] = [`# ${title}`, ''];
  if (author) lines.push(`*Author: ${author} | Date: ${new Date().toISOString().split('T')[0]}*`, '');
  lines.push('---', '');

  for (const section of sections) {
    lines.push(`## ${section.heading}`, '', section.content, '');
    if (section.data?.length) {
      lines.push('| Item | Value |', '|------|-------|');
      for (const d of section.data) lines.push(`| ${d.label} | ${d.value} |`);
      lines.push('');
    }
  }

  return lines.join('\n');
}

function generateHtml(title: string, sections: Array<{ heading: string; content: string; data?: Array<{ label: string; value: number }> }>, author?: string): string {
  const sectionHtml = sections.map((s) => {
    let html = `<h2>${s.heading}</h2><p>${s.content.replace(/\n/g, '<br>')}</p>`;
    if (s.data?.length) {
      html += '<table><thead><tr><th>Item</th><th>Value</th></tr></thead><tbody>';
      html += s.data.map((d) => `<tr><td>${d.label}</td><td>${d.value}</td></tr>`).join('');
      html += '</tbody></table>';
    }
    return html;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#333;line-height:1.6}h1{color:#1e40af;border-bottom:2px solid #3b82f6;padding-bottom:10px}h2{color:#1e40af;margin-top:30px}table{width:100%;border-collapse:collapse;margin:15px 0}th{background:#eff6ff;padding:8px;text-align:left;border:1px solid #bfdbfe}td{padding:8px;border:1px solid #e5e7eb}.meta{color:#6b7280;font-style:italic;margin-bottom:20px}</style>
</head><body><h1>${title}</h1>
${author ? `<p class="meta">Author: ${author} | Date: ${new Date().toISOString().split('T')[0]}</p>` : ''}
${sectionHtml}</body></html>`;
}
