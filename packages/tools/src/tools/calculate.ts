interface CalculateResult {
  expression: string;
  result: number;
}

export async function calculate(params: { expression: string }): Promise<CalculateResult> {
  const { expression } = params;
  if (!expression) throw new Error('expression is required');

  // Allow only safe math characters
  const safe = expression.replace(/\s/g, '');
  if (!/^[\d+\-*/().%^e\s,a-z]+$/i.test(safe)) {
    throw new Error('Expression contains invalid characters');
  }

  // Replace common math functions
  const normalized = expression
    .replace(/\^/g, '**')
    .replace(/sqrt\(/g, 'Math.sqrt(')
    .replace(/abs\(/g, 'Math.abs(')
    .replace(/ceil\(/g, 'Math.ceil(')
    .replace(/floor\(/g, 'Math.floor(')
    .replace(/round\(/g, 'Math.round(')
    .replace(/log\(/g, 'Math.log(')
    .replace(/log10\(/g, 'Math.log10(')
    .replace(/sin\(/g, 'Math.sin(')
    .replace(/cos\(/g, 'Math.cos(')
    .replace(/tan\(/g, 'Math.tan(')
    .replace(/pi/gi, 'Math.PI')
    .replace(/(?<![a-z])e(?![a-z\d])/gi, 'Math.E');

   
  const result = Function(`"use strict"; return (${normalized})`)() as number;

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error(`Invalid result: ${result}`);
  }

  return { expression, result };
}
