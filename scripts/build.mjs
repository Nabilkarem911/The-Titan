#!/usr/bin/env node
import { readFile, readdir, stat } from 'fs/promises';
import { spawn } from 'child_process';
import { dirname, join, relative } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function globWorkspaces(patterns) {
  const dirs = [];
  for (const pattern of patterns) {
    const [base, ...rest] = pattern.split('/');
    const children = await readdir(join(ROOT, base), { withFileTypes: true });
    for (const child of children) {
      if (child.isDirectory()) {
        const full = join(ROOT, base, child.name);
        const tsConfig = join(full, 'tsconfig.json');
        const pkgJson = join(full, 'package.json');
        try {
          await stat(tsConfig);
          const pkg = await readJson(pkgJson);
          dirs.push({ name: pkg.name, dir: full, rel: `${base}/${child.name}` });
        } catch {
          /* no tsconfig */
        }
      }
    }
  }
  return dirs;
}

function localDeps(pkg) {
  const all = { ...pkg.dependencies, ...pkg.devDependencies, ...pkg.peerDependencies };
  return Object.entries(all)
    .filter(([k]) => k.startsWith('@titan/'))
    .map(([k]) => k);
}

async function buildPackage(pkg) {
  return new Promise((resolve, reject) => {
    const command = `npm run build:${pkg.rel.split('/').pop()}`;
    const child = spawn(command, {
      cwd: ROOT,
      shell: true,
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '0' },
    });

    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Build failed for ${pkg.name} (${pkg.rel}):\n${err || out}`));
      } else {
        resolve();
      }
    });
  });
}

async function main() {
  const root = await readJson(join(ROOT, 'package.json'));
  const allPackages = await globWorkspaces(root.workspaces);

  // Only build packages that the root build script previously built
  const buildOrder = [
    'shared', 'config', 'logging', 'observability',
    'database', 'memory', 'queue', 'tools', 'sandbox', 'auth', 'websocket', 'telemetry',
    'agent-engine', 'core',
  ];

  const packages = allPackages.filter((p) => buildOrder.includes(p.rel.split('/').pop() ?? ''));
  const byName = new Map(packages.map((p) => [p.name, p]));

  // Compute waves via Kahn's algorithm using @titan/* deps
  const inDegree = new Map();
  const graph = new Map();
  for (const pkg of packages) {
    inDegree.set(pkg.name, 0);
    graph.set(pkg.name, []);
  }
  for (const pkg of packages) {
    const pkgJson = await readJson(join(pkg.dir, 'package.json'));
    for (const dep of localDeps(pkgJson)) {
      if (byName.has(dep)) {
        graph.get(dep).push(pkg.name);
        inDegree.set(pkg.name, (inDegree.get(pkg.name) ?? 0) + 1);
      }
    }
  }

  // Build in topological waves, parallel within each wave
  const built = new Set();
  const start = Date.now();
  while (built.size < packages.length) {
    const wave = packages.filter((p) => !built.has(p.name) && inDegree.get(p.name) === 0);
    if (wave.length === 0) {
      const remaining = packages.filter((p) => !built.has(p.name)).map((p) => p.name);
      throw new Error(`Circular or unresolved dependency among: ${remaining.join(', ')}`);
    }
    for (const pkg of wave) {
      for (const next of graph.get(pkg.name)) {
        inDegree.set(next, inDegree.get(next) - 1);
      }
    }
    await Promise.all(wave.map(buildPackage));
    for (const pkg of wave) built.add(pkg.name);
    console.log(`✓ built wave [${wave.map((p) => p.name).join(', ')}]`);
  }

  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`\n✅ all packages built in ${duration}s`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
