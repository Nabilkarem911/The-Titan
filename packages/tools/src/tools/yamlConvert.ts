export async function yamlConvert(params: { input: string; from: 'yaml' | 'json' | 'toml'; to: 'yaml' | 'json' | 'toml' }): Promise<string> {
  const { input, from, to } = params;
  if (!input) throw new Error('input is required');

  let data: unknown;

  switch (from) {
    case 'json': data = JSON.parse(input); break;
    case 'yaml': data = parseSimpleYaml(input); break;
    case 'toml': data = parseSimpleToml(input); break;
    default: throw new Error(`Unknown source format: ${from}`);
  }

  switch (to) {
    case 'json': return JSON.stringify(data, null, 2);
    case 'yaml': return toSimpleYaml(data);
    case 'toml': return toSimpleToml(data);
    default: throw new Error(`Unknown target format: ${to}`);
  }
}

function parseSimpleYaml(yaml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const line of yaml.split('\n')) {
    const match = line.match(/^(\w[\w.-]*)\s*:\s*(.+)$/);
    if (match) {
      let value: unknown = match[2].trim();
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (value === 'null') value = null;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);
      else value = String(value).replace(/^["']|["']$/g, '');
      result[match[1]] = value;
    }
  }
  return result;
}

function toSimpleYaml(data: unknown, indent = 0): string {
  if (typeof data !== 'object' || data === null) return String(data);
  const prefix = '  '.repeat(indent);
  const lines: string[] = [];
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`${prefix}${key}:`);
      lines.push(toSimpleYaml(value, indent + 1));
    } else if (Array.isArray(value)) {
      lines.push(`${prefix}${key}:`);
      for (const item of value) lines.push(`${prefix}  - ${item}`);
    } else {
      lines.push(`${prefix}${key}: ${value}`);
    }
  }
  return lines.join('\n');
}

function parseSimpleToml(toml: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let section = result;
  for (const line of toml.split('\n')) {
    const sectionMatch = line.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      section = {};
      result[sectionMatch[1]] = section;
      continue;
    }
    const kvMatch = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (kvMatch) {
      let value: unknown = kvMatch[2].trim();
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (!isNaN(Number(value)) && value !== '') value = Number(value);
      else value = String(value).replace(/^"|"$/g, '');
      section[kvMatch[1]] = value;
    }
  }
  return result;
}

function toSimpleToml(data: unknown): string {
  if (typeof data !== 'object' || data === null) return String(data);
  const lines: string[] = [];
  const obj = data as Record<string, unknown>;
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      lines.push(`\n[${key}]`);
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        lines.push(`${k} = ${typeof v === 'string' ? `"${v}"` : v}`);
      }
    } else {
      lines.push(`${key} = ${typeof value === 'string' ? `"${value}"` : value}`);
    }
  }
  return lines.join('\n');
}
