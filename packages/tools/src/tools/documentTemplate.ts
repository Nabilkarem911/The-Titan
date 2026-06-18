export async function documentTemplate(params: { template: string; variables: Record<string, string>; format?: 'html' | 'markdown' }): Promise<string> {
  const { template, variables, format = 'html' } = params;
  if (!template) throw new Error('template is required');

  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }

  const unreplaced = result.match(/\{\{(\w+)\}\}/g);
  if (unreplaced) {
    return JSON.stringify({ content: result, format, warnings: `Unreplaced variables: ${unreplaced.join(', ')}` });
  }

  return JSON.stringify({ content: result, format, variablesApplied: Object.keys(variables).length });
}
