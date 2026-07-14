import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'symbol-extractor' });

type SymbolKind = 'function' | 'class' | 'interface' | 'type' | 'enum' | 'variable' | 'export' | 'import';

export interface CodeSymbol {
  name: string;
  kind: SymbolKind;
  filePath: string;
  line: number;
  exported: boolean;
  signature?: string;
  docComment?: string;
}

const PATTERNS: Array<{ kind: SymbolKind; regex: RegExp; nameGroup: number; exported?: boolean }> = [
  // TypeScript/JavaScript
  { kind: 'function', regex: /^export\s+(?:async\s+)?function\s+(\w+)/gm, nameGroup: 1, exported: true },
  { kind: 'function', regex: /^(?:async\s+)?function\s+(\w+)/gm, nameGroup: 1 },
  { kind: 'function', regex: /^export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/gm, nameGroup: 1, exported: true },
  { kind: 'class', regex: /^export\s+class\s+(\w+)/gm, nameGroup: 1, exported: true },
  { kind: 'class', regex: /^class\s+(\w+)/gm, nameGroup: 1 },
  { kind: 'interface', regex: /^export\s+interface\s+(\w+)/gm, nameGroup: 1, exported: true },
  { kind: 'interface', regex: /^interface\s+(\w+)/gm, nameGroup: 1 },
  { kind: 'type', regex: /^export\s+type\s+(\w+)/gm, nameGroup: 1, exported: true },
  { kind: 'type', regex: /^type\s+(\w+)/gm, nameGroup: 1 },
  { kind: 'enum', regex: /^export\s+enum\s+(\w+)/gm, nameGroup: 1, exported: true },
  { kind: 'variable', regex: /^export\s+const\s+(\w+)\s*[=:]/gm, nameGroup: 1, exported: true },
  // Python
  { kind: 'function', regex: /^def\s+(\w+)\s*\(/gm, nameGroup: 1 },
  { kind: 'class', regex: /^class\s+(\w+)/gm, nameGroup: 1 },
  // Rust
  { kind: 'function', regex: /^pub\s+(?:async\s+)?fn\s+(\w+)/gm, nameGroup: 1, exported: true },
  { kind: 'function', regex: /^fn\s+(\w+)/gm, nameGroup: 1 },
  // Go
  { kind: 'function', regex: /^func\s+(\w+)/gm, nameGroup: 1 },
  { kind: 'type', regex: /^type\s+(\w+)\s+struct/gm, nameGroup: 1 },
];

export function extractSymbols(content: string, filePath: string): CodeSymbol[] {
  const symbols: CodeSymbol[] = [];
  const lines = content.split('\n');
  const seen = new Set<string>();

  for (const pattern of PATTERNS) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    let match;

    while ((match = regex.exec(content)) !== null) {
      const name = match[pattern.nameGroup];
      const key = `${name}:${pattern.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const lineIndex = content.substring(0, match.index).split('\n').length;
      const lineContent = lines[lineIndex - 1] ?? '';

      // Look for doc comment above
      let docComment: string | undefined;
      if (lineIndex > 1) {
        const prevLine = lines[lineIndex - 2]?.trim() ?? '';
        if (prevLine.startsWith('/**') || prevLine.startsWith('///') || prevLine.startsWith('#')) {
          docComment = prevLine.replace(/^\/\*\*\s*|\s*\*\/$|^\/\/\/\s*|^#\s*/g, '').trim();
        }
      }

      symbols.push({
        name,
        kind: pattern.kind,
        filePath,
        line: lineIndex,
        exported: pattern.exported ?? false,
        signature: lineContent.trim().slice(0, 200),
        docComment,
      });
    }
  }

  return symbols;
}

export function extractImports(content: string): Array<{ source: string; names: string[] }> {
  const imports: Array<{ source: string; names: string[] }> = [];

  // ES imports (including 'import type')
  const esRegex = /import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = esRegex.exec(content)) !== null) {
    const names = match[1]
      ? match[1].split(',').map((n) => n.trim().split(' as ')[0].trim()).filter(Boolean)
      : [match[2]];
    imports.push({ source: match[3], names });
  }

  // require
  const reqRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|(\w+))\s*=\s*require\(['"]([^'"]+)['"]\)/g;
  while ((match = reqRegex.exec(content)) !== null) {
    const names = match[1]
      ? match[1].split(',').map((n) => n.trim()).filter(Boolean)
      : [match[2]];
    imports.push({ source: match[3], names });
  }

  return imports;
}
