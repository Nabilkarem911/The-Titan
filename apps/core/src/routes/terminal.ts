import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { getLogger } from '@titan/logging';
import { verifyAccessToken } from '@titan/auth';

const log = getLogger().child({ component: 'terminal-ws' });

interface TerminalSession {
  id: string;
  userId: string;
  process: ChildProcessWithoutNullStreams;
  cwd: string;
  ws: import('ws').WebSocket;
}

const sessions = new Map<string, TerminalSession>();

function getWorkspaceRoot(userId: string): string {
  const { join } = require('node:path');
  const base = process.env.WORKSPACE_ROOT ?? join(process.cwd(), 'workspaces');
  return join(base, userId);
}

export const terminalRoutes: FastifyPluginAsync = async (app) => {
  // Upgrade handler for /terminal
  app.server.on('upgrade', async (request: FastifyRequest['raw'], socket, head) => {
    const url = new URL(request.url ?? '/', 'http://localhost');
    if (url.pathname !== '/terminal') return;

    const token = url.searchParams.get('token');
    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    let userId: string;
    try {
      const payload = verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    const { WebSocketServer } = await import('ws');
    const wss = new WebSocketServer({ noServer: true });
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
      handleTerminalConnection(ws, userId);
    });
  });
};

async function handleTerminalConnection(ws: import('ws').WebSocket, userId: string) {
  const { randomUUID } = await import('node:crypto');
  const { mkdir } = await import('node:fs/promises');
  const sessionId = randomUUID();
  const workspaceRoot = getWorkspaceRoot(userId);
  await mkdir(workspaceRoot, { recursive: true });

  const isWindows = process.platform === 'win32';
  const shell = isWindows ? 'powershell.exe' : 'bash';
  const shellArgs = isWindows ? ['-NoProfile', '-Command', '-'] : ['-i'];

  const safeEnv: Record<string, string> = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? process.env.USERPROFILE ?? '',
    TERM: 'xterm-256color',
    FORCE_COLOR: '1',
    LANG: process.env.LANG ?? 'en_US.UTF-8',
    PS1: '\\[\\e[32m\\]titan\\[\\e[0m\\]:\\[\\e[34m\\]\\w\\[\\e[0m\\]$ ',
  };
  if (process.env.SHELL) safeEnv.SHELL = process.env.SHELL;
  if (process.platform === 'win32') {
    safeEnv.SYSTEMROOT = process.env.SYSTEMROOT ?? 'C:\\Windows';
    safeEnv.COMSPEC = process.env.COMSPEC ?? 'C:\\Windows\\system32\\cmd.exe';
    if (process.env.APPDATA) safeEnv.APPDATA = process.env.APPDATA;
    if (process.env.LOCALAPPDATA) safeEnv.LOCALAPPDATA = process.env.LOCALAPPDATA;
    if (process.env.TEMP) safeEnv.TEMP = process.env.TEMP;
    if (process.env.TMP) safeEnv.TMP = process.env.TMP;
  }

  const proc = spawn(shell, shellArgs, {
    cwd: workspaceRoot,
    env: safeEnv,
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  const session: TerminalSession = {
    id: sessionId,
    userId,
    process: proc,
    cwd: workspaceRoot,
    ws,
  };
  sessions.set(sessionId, session);

  log.info({ sessionId, userId, shell }, 'terminal session started');

  // Send stdout to client
  proc.stdout.on('data', (data: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
    }
  });

  // Send stderr to client
  proc.stderr.on('data', (data: Buffer) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data: data.toString('utf-8') }));
    }
  });

  // Process exit
  proc.on('close', (code) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', code }));
    }
    sessions.delete(sessionId);
  });

  proc.on('error', (err) => {
    log.error({ err, sessionId }, 'terminal process error');
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'error', data: err.message }));
    }
  });

  // Handle messages from client
  function handleTerminalMessage(raw: import('ws').RawData) {
    try {
      const msg = JSON.parse(raw.toString('utf-8'));
      if (msg.type === 'input' && msg.data) {
        proc.stdin.write(msg.data);
        return;
      }
      if (msg.type === 'command' && msg.command) {
        proc.stdin.write(msg.command + '\n');
        return;
      }
      if (msg.type === 'resize' && msg.cols && msg.rows) {
        log.debug({ sessionId, cols: msg.cols, rows: msg.rows }, 'terminal resize');
      }
    } catch (err) {
      log.error({ err, sessionId }, 'invalid terminal message');
    }
  }

  ws.on('message', handleTerminalMessage);

  ws.on('close', () => {
    log.info({ sessionId }, 'terminal client disconnected');
    proc.kill('SIGTERM');
    sessions.delete(sessionId);
  });

  ws.on('error', (err) => {
    log.error({ err, sessionId }, 'terminal ws error');
    proc.kill('SIGTERM');
    sessions.delete(sessionId);
  });

  // Send welcome
  ws.send(JSON.stringify({ type: 'output', data: `\r\n\x1b[36mTitan Terminal\x1b[0m — ${isWindows ? 'PowerShell' : 'bash'} in workspace\r\n` }));
}
