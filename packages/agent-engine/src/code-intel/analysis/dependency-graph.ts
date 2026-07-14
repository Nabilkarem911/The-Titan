import { getLogger } from '@titan/logging';
import { readFileSync, existsSync } from 'node:fs';
import { extname, basename, sep } from 'node:path';
import { extractSymbols, type CodeSymbol } from '../indexer/symbol-extractor.js';

const log = getLogger().child({ component: 'dependency-graph' });

interface FileNode {
  path: string;
  name: string;
  ext: string;
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  loc: number;
}

interface DependencyEdge {
  from: string;
  to: string;
  type: 'import' | 'function-call' | 'class-extends' | 'type-reference';
}

interface ImpactAnalysis {
  targetFile: string;
  directDependents: string[];
  transitiveDependents: string[];
  affectedSymbols: string[];
  riskLevel: 'low' | 'medium' | 'high';
  totalFilesAffected: number;
}

export class DependencyGraph {
  private files = new Map<string, FileNode>();
  private edges: DependencyEdge[] = [];
  private importMap = new Map<string, Set<string>>(); // file → files it imports
  private reverseImportMap = new Map<string, Set<string>>(); // file → files that import it

  indexFile(filePath: string, content?: string): FileNode {
    const ext = extname(filePath);
    const name = basename(filePath);

    if (!content) {
      if (!existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }
      content = readFileSync(filePath, 'utf-8');
    }

    const symbols = extractSymbols(content, filePath);
    const imports = this.extractImports(content, filePath);
    const exports = symbols.filter((s) => s.exported).map((s) => s.name);
    const loc = content.split('\n').length;

    const node: FileNode = { path: filePath, name, ext, symbols, imports, exports, loc };
    this.files.set(filePath, node);

    // Build import edges
    const importedSet = new Set<string>();
    for (const imp of imports) {
      importedSet.add(imp);
      this.edges.push({ from: filePath, to: imp, type: 'import' });
    }
    this.importMap.set(filePath, importedSet);

    // Update reverse map
    for (const imp of imports) {
      if (!this.reverseImportMap.has(imp)) {
        this.reverseImportMap.set(imp, new Set());
      }
      this.reverseImportMap.get(imp)!.add(filePath);
    }

    return node;
  }

  analyzeImpact(targetFile: string): ImpactAnalysis {
    const direct = this.reverseImportMap.get(targetFile) ?? new Set<string>();
    const transitive = new Set<string>();
    const queue = Array.from(direct);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (transitive.has(current)) continue;
      transitive.add(current);

      const dependents = this.reverseImportMap.get(current) ?? new Set<string>();
      for (const dep of dependents) {
        if (!transitive.has(dep) && !direct.has(dep)) {
          queue.push(dep);
        }
      }
    }

    const targetNode = this.files.get(targetFile);
    const affectedSymbols = targetNode?.symbols.map((s) => s.name) ?? [];

    const totalFiles = direct.size + transitive.size;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (totalFiles > 10) riskLevel = 'high';
    else if (totalFiles > 3) riskLevel = 'medium';

    return {
      targetFile,
      directDependents: Array.from(direct),
      transitiveDependents: Array.from(transitive),
      affectedSymbols,
      riskLevel,
      totalFilesAffected: totalFiles,
    };
  }

  getDependents(filePath: string): string[] {
    return Array.from(this.reverseImportMap.get(filePath) ?? new Set());
  }

  getDependencies(filePath: string): string[] {
    return Array.from(this.importMap.get(filePath) ?? new Set());
  }

  getFile(filePath: string): FileNode | undefined {
    return this.files.get(filePath);
  }

  getAllFiles(): FileNode[] {
    return Array.from(this.files.values());
  }

  stats(): { files: number; edges: number; avgImports: number; avgLoc: number } {
    const totalImports = Array.from(this.importMap.values()).reduce((s, v) => s + v.size, 0);
    const totalLoc = Array.from(this.files.values()).reduce((s, f) => s + f.loc, 0);
    return {
      files: this.files.size,
      edges: this.edges.length,
      avgImports: this.files.size > 0 ? Math.round(totalImports / this.files.size) : 0,
      avgLoc: this.files.size > 0 ? Math.round(totalLoc / this.files.size) : 0,
    };
  }

  findCircularDependencies(): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string) => {
      if (recursionStack.has(node)) {
        const cycleStart = path.indexOf(node);
        if (cycleStart >= 0) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }
      if (visited.has(node)) return;

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const deps = this.importMap.get(node) ?? new Set<string>();
      for (const dep of deps) {
        dfs(dep);
      }

      path.pop();
      recursionStack.delete(node);
    };

    for (const file of this.files.keys()) {
      dfs(file);
    }

    return cycles;
  }

  private extractImports(content: string, filePath: string): string[] {
    const imports: string[] = [];
    const dir = filePath.includes(sep) ? filePath.substring(0, filePath.lastIndexOf(sep)) : '';

    // ES module imports: import ... from '...'
    const esImportRegex = /(?:import\s+.*?\s+from\s+|import\s+|export\s+.*?\s+from\s+)['"`]([^'"`]+)['"`]/g;
    let match: RegExpExecArray | null;
    while ((match = esImportRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], dir);
      if (resolved) imports.push(resolved);
    }

    // CommonJS require
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g;
    while ((match = requireRegex.exec(content)) !== null) {
      const resolved = this.resolveImportPath(match[1], dir);
      if (resolved) imports.push(resolved);
    }

    return [...new Set(imports)];
  }

  private resolveImportPath(importPath: string, fromDir: string): string | null {
    // Skip node_modules and package imports
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return null;
    }

    // Resolve relative paths
    let resolved: string;
    if (importPath.startsWith('.')) {
      resolved = `${fromDir}${sep}${importPath}`;
    } else {
      resolved = importPath;
    }

    // Try extensions
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];
    for (const ext of extensions) {
      const withExt = resolved.endsWith(ext) ? resolved : `${resolved}${ext}`;
      if (existsSync(withExt)) return withExt;
    }

    // Try index files
    for (const ext of extensions) {
      const indexFile = `${resolved}${sep}index${ext}`;
      if (existsSync(indexFile)) return indexFile;
    }

    return null;
  }
}
