const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const cwd = 'D:\\ai\\Titan';
const out = fs.openSync(path.join(cwd, 'apps/core/run.log'), 'w');
const err = fs.openSync(path.join(cwd, 'apps/core/run.err'), 'w');

const p = spawn(process.execPath, ['--enable-source-maps', 'apps/core/dist/server.js'], {
  cwd,
  env: { ...process.env, NODE_ENV: 'development' },
  stdio: ['ignore', out, err],
  detached: true,
});
console.log('PID', p.pid);
p.unref();
