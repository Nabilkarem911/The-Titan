export interface RegexTestResult {
  pattern: string;
  flags: string;
  input: string;
  isMatch: boolean;
  matches: string[];
  groups: Record<string, string>;
  matchCount: number;
}

export async function regexTest(params: {
  pattern: string;
  input: string;
  flags?: string;
}): Promise<RegexTestResult> {
  const { pattern, input, flags = '' } = params;

  if (!pattern) throw new Error('pattern is required');
  if (input === undefined) throw new Error('input is required');

  let regex: RegExp;
  try {
    regex = new RegExp(pattern, flags);
  } catch (err) {
    throw new Error(`Invalid regex pattern: ${(err as Error).message}`);
  }

  const allMatches: string[] = [];
  const groups: Record<string, string> = {};

  if (flags.includes('g')) {
    const matches = [...input.matchAll(regex)];
    for (const m of matches) {
      allMatches.push(m[0]);
      if (m.groups) Object.assign(groups, m.groups);
    }
  } else {
    const m = input.match(regex);
    if (m) {
      allMatches.push(...m.slice(0));
      if (m.groups) Object.assign(groups, m.groups);
    }
  }

  return {
    pattern,
    flags,
    input,
    isMatch: allMatches.length > 0,
    matches: allMatches,
    groups,
    matchCount: flags.includes('g') ? allMatches.length : (allMatches.length > 0 ? 1 : 0),
  };
}
