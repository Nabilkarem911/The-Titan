export async function slideCreate(params: { slides: Array<{ title: string; bullets?: string[]; notes?: string; image?: string }>; theme?: string; title?: string }): Promise<string> {
  const { slides, theme = 'default', title = 'Presentation' } = params;
  if (!slides?.length) throw new Error('slides array required');

  const colors = theme === 'dark' ? { bg: '#1e1e2e', text: '#cdd6f4', accent: '#89b4fa' } : { bg: '#ffffff', text: '#333333', accent: '#2563eb' };

  const slideHtml = slides.map((s, i) => `
<div style="page-break-after:always;padding:60px;background:${colors.bg};color:${colors.text};min-height:500px;font-family:Arial,sans-serif">
  <h1 style="color:${colors.accent};font-size:2em;margin-bottom:30px">${s.title}</h1>
  ${s.bullets ? `<ul style="font-size:1.3em;line-height:2">${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : ''}
  ${s.notes ? `<p style="color:#888;font-size:0.9em;margin-top:40px;font-style:italic">Notes: ${s.notes}</p>` : ''}
  <p style="position:absolute;bottom:20px;right:40px;color:#666;font-size:0.8em">${i + 1} / ${slides.length}</p>
</div>`).join('\n');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="margin:0">${slideHtml}</body></html>`;
  return JSON.stringify({ html, slideCount: slides.length, theme, title });
}
