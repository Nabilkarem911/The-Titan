export async function codeAnalyze(params: { code: string; language?: string }): Promise<string> {
  const { code, language = 'auto' } = params;
  if (!code) throw new Error('code is required');

  const lines = code.split('\n');
  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  const comments = lines.filter((l) => l.trim().startsWith('//') || l.trim().startsWith('#') || l.trim().startsWith('/*'));

  const functions = (code.match(/(?:function|def|fn|func)\s+\w+/g) ?? []).length;
  const classes = (code.match(/(?:class|struct|interface|type)\s+\w+/g) ?? []).length;
  const imports = (code.match(/(?:import|require|use|from)\s/g) ?? []).length;
  const todos = (code.match(/(?:TODO|FIXME|HACK|XXX|BUG)/g) ?? []).length;

  // Complexity heuristics
  const branches = (code.match(/\b(?:if|else|switch|case|catch|while|for|&&|\|\||\?)\b/g) ?? []).length;
  const nestingMax = estimateMaxNesting(code);

  // Issues
  const issues: string[] = [];
  if (nestingMax > 4) issues.push(`Deep nesting detected (${nestingMax} levels)`);
  if (functions > 0 && nonEmpty.length / functions > 50) issues.push('Large functions detected (avg >50 lines)');
  if (comments.length === 0 && nonEmpty.length > 30) issues.push('No comments in non-trivial code');
  if (todos > 0) issues.push(`${todos} TODO/FIXME comments found`);
  if (code.includes('eval(')) issues.push('eval() detected — security risk');
  if (code.includes('any')) issues.push('"any" type usage detected');
  if (lines.some((l) => l.length > 120)) issues.push('Lines exceeding 120 characters');

  const complexity = branches < 5 ? 'low' : branches < 15 ? 'medium' : 'high';
  const qualityScore = Math.max(0, 100 - issues.length * 10 - (nestingMax > 3 ? 15 : 0) - (complexity === 'high' ? 10 : 0));

  return JSON.stringify({
    metrics: { totalLines: lines.length, codeLines: nonEmpty.length, commentLines: comments.length, functions, classes, imports, branches, maxNesting: nestingMax },
    complexity,
    qualityScore,
    issues,
    language: language === 'auto' ? detectLanguage(code) : language,
  });
}

function estimateMaxNesting(code: string): number {
  let max = 0;
  let current = 0;
  for (const char of code) {
    if (char === '{') { current++; max = Math.max(max, current); }
    if (char === '}') current--;
  }
  return max;
}

function detectLanguage(code: string): string {
  if (code.includes('interface ') || code.includes(': string') || code.includes(': number')) return 'typescript';
  if (code.includes('def ') && code.includes(':')) return 'python';
  if (code.includes('fn ') && code.includes('->')) return 'rust';
  if (code.includes('func ') && code.includes('package ')) return 'go';
  if (code.includes('function ') || code.includes('=>')) return 'javascript';
  return 'unknown';
}
