import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

export interface ProjectInfo {
  name: string;
  path: string;
  type: 'node' | 'python' | 'rust' | 'go' | 'java' | 'unknown';
  framework?: string;
  packageManager?: string;
  hasGit: boolean;
  mainFiles: string[];
}

const FRAMEWORK_DETECTORS: Array<{ file: string; framework?: string; type: ProjectInfo['type'] }> = [
  { file: 'next.config.js', framework: 'Next.js', type: 'node' },
  { file: 'next.config.ts', framework: 'Next.js', type: 'node' },
  { file: 'nuxt.config.ts', framework: 'Nuxt', type: 'node' },
  { file: 'svelte.config.js', framework: 'SvelteKit', type: 'node' },
  { file: 'astro.config.mjs', framework: 'Astro', type: 'node' },
  { file: 'vite.config.ts', framework: 'Vite', type: 'node' },
  { file: 'angular.json', framework: 'Angular', type: 'node' },
  { file: 'remix.config.js', framework: 'Remix', type: 'node' },
  { file: 'requirements.txt', framework: undefined, type: 'python' },
  { file: 'pyproject.toml', framework: undefined, type: 'python' },
  { file: 'Cargo.toml', framework: undefined, type: 'rust' },
  { file: 'go.mod', framework: undefined, type: 'go' },
  { file: 'pom.xml', framework: 'Maven', type: 'java' },
  { file: 'build.gradle', framework: 'Gradle', type: 'java' },
];

export function detectProject(dir: string): ProjectInfo {
  const name = basename(dir);
  const hasGit = existsSync(join(dir, '.git'));
  const mainFiles: string[] = [];

  let type: ProjectInfo['type'] = 'unknown';
  let framework: string | undefined;
  let packageManager: string | undefined;

  // Check for specific frameworks first
  for (const detector of FRAMEWORK_DETECTORS) {
    if (existsSync(join(dir, detector.file))) {
      type = detector.type;
      if (detector.framework) framework = detector.framework;
      mainFiles.push(detector.file);
      break;
    }
  }

  // Node.js detection
  if (existsSync(join(dir, 'package.json'))) {
    if (type === 'unknown') type = 'node';
    mainFiles.push('package.json');

    try {
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8'));
      if (!framework) {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['fastify']) framework = 'Fastify';
        else if (deps['express']) framework = 'Express';
        else if (deps['react']) framework = framework ?? 'React';
        else if (deps['vue']) framework = 'Vue';
      }
    } catch { /* ignore */ }

    if (existsSync(join(dir, 'pnpm-lock.yaml'))) packageManager = 'pnpm';
    else if (existsSync(join(dir, 'yarn.lock'))) packageManager = 'yarn';
    else if (existsSync(join(dir, 'bun.lockb'))) packageManager = 'bun';
    else packageManager = 'npm';
  }

  // Collect important files
  try {
    const files = readdirSync(dir);
    for (const f of files) {
      if (f.match(/^(README|CLAUDE|\.env\.example|Dockerfile|docker-compose)/i)) {
        mainFiles.push(f);
      }
    }
  } catch { /* ignore */ }

  return { name, path: dir, type, framework, packageManager, hasGit, mainFiles };
}

export function getProjectSummary(info: ProjectInfo): string {
  const parts = [`Project: ${info.name}`];
  if (info.type !== 'unknown') parts.push(`Type: ${info.type}`);
  if (info.framework) parts.push(`Framework: ${info.framework}`);
  if (info.packageManager) parts.push(`Package Manager: ${info.packageManager}`);
  if (info.hasGit) parts.push('Git: yes');
  return parts.join(' | ');
}
