export async function accessibilityCheck(params: { url?: string; html?: string }): Promise<string> {
  let html: string;

  if (params.html) {
    html = params.html;
  } else if (params.url) {
    const res = await fetch(params.url, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    html = await res.text();
  } else {
    throw new Error('url or html required');
  }

  const issues: Array<{ level: 'A' | 'AA' | 'AAA'; rule: string; description: string; count: number }> = [];
  let score = 100;

  // Images without alt
  const imgs = (html.match(/<img/gi) ?? []).length;
  const imgsNoAlt = (html.match(/<img(?![^>]*alt=)[^>]*>/gi) ?? []).length;
  if (imgsNoAlt > 0) { issues.push({ level: 'A', rule: '1.1.1', description: `${imgsNoAlt} images missing alt text`, count: imgsNoAlt }); score -= imgsNoAlt * 3; }

  // Form inputs without labels
  const inputs = (html.match(/<input(?![^>]*type=["'](?:hidden|submit|button)["'])[^>]*>/gi) ?? []).length;
  const labels = (html.match(/<label/gi) ?? []).length;
  if (inputs > labels) { issues.push({ level: 'A', rule: '1.3.1', description: `${inputs - labels} form inputs may lack labels`, count: inputs - labels }); score -= 5; }

  // Missing lang attribute
  if (!html.match(/<html[^>]*lang=/i)) { issues.push({ level: 'A', rule: '3.1.1', description: 'Missing lang attribute on <html>', count: 1 }); score -= 5; }

  // Missing viewport
  if (!html.match(/<meta[^>]*name=["']viewport["']/i)) { issues.push({ level: 'AA', rule: '1.4.4', description: 'Missing viewport meta tag', count: 1 }); score -= 5; }

  // Color contrast (basic check — look for small text)
  if (html.match(/font-size:\s*[0-9]px/i) || html.match(/font-size:\s*1[01]px/i)) { issues.push({ level: 'AA', rule: '1.4.3', description: 'Potentially small text (<12px) detected', count: 1 }); score -= 5; }

  // Skip navigation
  if (!html.match(/skip.{0,10}nav|skip.{0,10}content|main-content/i)) { issues.push({ level: 'A', rule: '2.4.1', description: 'No skip navigation link detected', count: 1 }); score -= 3; }

  // Heading hierarchy
  const headings: number[] = [];
  const hRegex = /<h([1-6])/gi;
  let match;
  while ((match = hRegex.exec(html)) !== null) headings.push(parseInt(match[1]));
  if (headings.length > 1) {
    for (let i = 1; i < headings.length; i++) {
      if (headings[i] - headings[i - 1] > 1) { issues.push({ level: 'AA', rule: '1.3.1', description: `Heading hierarchy skip: h${headings[i - 1]} to h${headings[i]}`, count: 1 }); score -= 3; break; }
    }
  }

  // ARIA roles
  const ariaRoles = (html.match(/role=/gi) ?? []).length;
  const ariaLabels = (html.match(/aria-label/gi) ?? []).length;

  const levelCounts = { A: issues.filter((i) => i.level === 'A').length, AA: issues.filter((i) => i.level === 'AA').length, AAA: issues.filter((i) => i.level === 'AAA').length };
  const compliance = levelCounts.A === 0 ? (levelCounts.AA === 0 ? 'AAA' : 'A') : 'Fails A';

  return JSON.stringify({ score: Math.max(0, score), compliance, issues, stats: { images: imgs, imagesWithoutAlt: imgsNoAlt, formInputs: inputs, labels, headings: headings.length, ariaRoles, ariaLabels }, issueCount: issues.length });
}
