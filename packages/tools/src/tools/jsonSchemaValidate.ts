export async function jsonSchemaValidate(params: { data: unknown; schema: Record<string, unknown> }): Promise<string> {
  const { data, schema } = params;
  if (!schema) throw new Error('schema is required');

  const errors = validateNode(data, schema, '$');
  return JSON.stringify({ valid: errors.length === 0, errors, errorCount: errors.length });
}

function validateNode(data: unknown, schema: Record<string, unknown>, path: string): string[] {
  const errors: string[] = [];

  if (schema.type) {
    const type = schema.type as string;
    if (type === 'string' && typeof data !== 'string') errors.push(`${path}: expected string, got ${typeof data}`);
    if (type === 'number' && typeof data !== 'number') errors.push(`${path}: expected number, got ${typeof data}`);
    if (type === 'integer' && (!Number.isInteger(data))) errors.push(`${path}: expected integer`);
    if (type === 'boolean' && typeof data !== 'boolean') errors.push(`${path}: expected boolean, got ${typeof data}`);
    if (type === 'array' && !Array.isArray(data)) errors.push(`${path}: expected array, got ${typeof data}`);
    if (type === 'object' && (typeof data !== 'object' || data === null || Array.isArray(data))) errors.push(`${path}: expected object`);
    if (type === 'null' && data !== null) errors.push(`${path}: expected null`);
  }

  if (schema.enum && Array.isArray(schema.enum)) {
    if (!(schema.enum as unknown[]).includes(data)) errors.push(`${path}: must be one of ${JSON.stringify(schema.enum)}`);
  }

  if (typeof data === 'string') {
    if (typeof schema.minLength === 'number' && data.length < schema.minLength) errors.push(`${path}: minLength ${schema.minLength}`);
    if (typeof schema.maxLength === 'number' && data.length > schema.maxLength) errors.push(`${path}: maxLength ${schema.maxLength}`);
    if (typeof schema.pattern === 'string' && !new RegExp(schema.pattern).test(data)) errors.push(`${path}: pattern mismatch`);
  }

  if (typeof data === 'number') {
    if (typeof schema.minimum === 'number' && data < schema.minimum) errors.push(`${path}: minimum ${schema.minimum}`);
    if (typeof schema.maximum === 'number' && data > schema.maximum) errors.push(`${path}: maximum ${schema.maximum}`);
  }

  if (Array.isArray(data) && schema.items) {
    for (let i = 0; i < data.length; i++) {
      errors.push(...validateNode(data[i], schema.items as Record<string, unknown>, `${path}[${i}]`));
    }
  }

  if (typeof data === 'object' && data !== null && !Array.isArray(data) && schema.properties) {
    const props = schema.properties as Record<string, Record<string, unknown>>;
    const required = (schema.required ?? []) as string[];
    const obj = data as Record<string, unknown>;

    for (const req of required) {
      if (!(req in obj)) errors.push(`${path}.${req}: required property missing`);
    }

    for (const [key, propSchema] of Object.entries(props)) {
      if (key in obj) {
        errors.push(...validateNode(obj[key], propSchema, `${path}.${key}`));
      }
    }
  }

  return errors;
}
