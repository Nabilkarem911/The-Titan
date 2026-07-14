interface Base64Result {
  input: string;
  output: string;
  operation: 'encode' | 'decode';
}

export async function base64Tool(params: {
  text: string;
  operation: 'encode' | 'decode';
}): Promise<Base64Result> {
  const { text, operation } = params;

  if (!text) throw new Error('text is required');
  if (!operation) throw new Error('operation must be "encode" or "decode"');

  let output: string;
  if (operation === 'encode') {
    output = Buffer.from(text, 'utf-8').toString('base64');
  } else {
    try {
      output = Buffer.from(text, 'base64').toString('utf-8');
    } catch {
      throw new Error('Invalid Base64 string');
    }
  }

  return { input: text, output, operation };
}
