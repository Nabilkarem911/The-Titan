interface JsonValidateResult {
  valid: boolean;
  formatted?: string;
  error?: string;
  keys?: string[];
  type?: string;
}

export async function jsonValidate(params: { json: string; format?: boolean }): Promise<JsonValidateResult> {
  const { json, format = false } = params;

  if (!json) throw new Error('json is required');

  try {
    const parsed: unknown = JSON.parse(json);
    const result: JsonValidateResult = { valid: true };

    if (format) {
      result.formatted = JSON.stringify(parsed, null, 2);
    }

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      result.keys = Object.keys(parsed as Record<string, unknown>);
      result.type = 'object';
    } else if (Array.isArray(parsed)) {
      result.type = `array[${(parsed as unknown[]).length}]`;
    } else {
      result.type = typeof parsed;
    }

    return result;
  } catch (err) {
    return {
      valid: false,
      error: (err as Error).message,
    };
  }
}
