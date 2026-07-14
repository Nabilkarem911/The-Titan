import { diffLines, diffWords, createPatch, type Change } from 'diff';

interface TextDiffResult {
  mode: 'lines' | 'words';
  added: number;
  removed: number;
  unchanged: number;
  patch?: string;
  changes: Array<{ type: 'added' | 'removed' | 'unchanged'; value: string }>;
}

export async function textDiff(params: {
  original: string;
  modified: string;
  mode?: 'lines' | 'words';
  patch?: boolean;
}): Promise<TextDiffResult> {
  const { original, modified, mode = 'lines', patch = false } = params;

  const diffs: Change[] = mode === 'words'
    ? diffWords(original, modified)
    : diffLines(original, modified);

  let added = 0;
  let removed = 0;
  let unchanged = 0;

  const changes = diffs.map((part) => {
    if (part.added) { added++; return { type: 'added' as const, value: part.value }; }
    if (part.removed) { removed++; return { type: 'removed' as const, value: part.value }; }
    unchanged++;
    return { type: 'unchanged' as const, value: part.value };
  });

  const result: TextDiffResult = { mode, added, removed, unchanged, changes };

  if (patch) {
    result.patch = createPatch('file', original, modified);
  }

  return result;
}
