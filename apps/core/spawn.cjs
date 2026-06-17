const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const cwd = path.resolve(__dirname, '../..');
const logDir = path.join(cwd, 'logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

const out = fs.openSync(path.join(logDir, 'core.out.log'), 'a');
const err = fs.openSync(path.join(logDir, 'core.err.log'), 'a');

const entryPoint = path.join('apps', 'core', 'dist', 'index.js');

const child = spawn(process.execPath, ['--enable-source-maps', entryPoint], {
  cwd,
  env: { ...process.env, NODE_ENV: process.env.NODE_ENV || 'development' },
  stdio: ['ignore', out, err],
  detached: true,
});

console.log(`Titan Core started with PID ${child.pid}`);
console.log(`Logs: ${logDir}`);

child.on('error', (e) => {
  console.error('Failed to start Titan Core:', e.message);
  process.exit(1);
});

child.unref();
