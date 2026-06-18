import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { readdir, stat, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import { join, resolve, relative } from 'node:path';
import { createReadStream } from 'node:fs';
import { getLogger } from '@titan/logging';
import { requireAuth } from '../plugins/auth.js';

const log = getLogger().child({ component: 'files-routes' });

/** Dangerous file extensions that must not be uploaded. */
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi',
  '.dll', '.so', '.com', '.scr', '.vbs', '.wsf', '.jar',
]);

/** Maximum size per uploaded file (50 MB). */
const MAX_UPLOAD_FILE_SIZE = 50 * 1024 * 1024;

function getWorkspaceRoot(userId: string): string {
  const base = process.env.WORKSPACE_ROOT ?? join(process.cwd(), 'workspaces');
  return join(base, userId);
}

function validatePath(workspaceRoot: string, requestedPath: string): string {
  const resolved = resolve(workspaceRoot, requestedPath.replace(/^\/+/, ''));
  const rel = relative(workspaceRoot, resolved);
  if (rel.startsWith('..') || resolve(resolved) !== resolved.replace(/[/\\]+$/, '')) {
    // Re-resolve to handle edge cases
    const safe = resolve(workspaceRoot, rel);
    const safeRel = relative(workspaceRoot, safe);
    if (safeRel.startsWith('..')) {
      throw new Error('Path traversal blocked');
    }
    return safe;
  }
  return resolved;
}

const MkdirInputSchema = z.object({
  path: z.string().min(1).max(1000),
});

const WriteFileInputSchema = z.object({
  path: z.string().min(1).max(1000),
  content: z.string().max(5 * 1024 * 1024),
});

export const fileRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('onRequest', requireAuth);

  // List directory contents
  app.get('/api/v1/files', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const queryPath = (req.query as { path?: string }).path ?? '/';
    const workspaceRoot = getWorkspaceRoot(userId);

    try {
      await mkdir(workspaceRoot, { recursive: true });
    } catch (err) {
      log.warn({ err, workspaceRoot }, 'failed to create workspace directory');
      return reply.status(500).send({ error: 'Failed to initialize workspace directory' });
    }

    const targetDir = queryPath === '/' ? workspaceRoot : validatePath(workspaceRoot, queryPath);

    try {
      const entries = await readdir(targetDir, { withFileTypes: true });
      const items = await Promise.all(
        entries
          .filter((e) => !e.name.startsWith('.'))
          .map(async (entry) => {
            const fullPath = join(targetDir, entry.name);
            try {
              const st = await stat(fullPath);
              return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' as const : 'file' as const,
                size: st.size,
                modifiedAt: st.mtime.toISOString(),
              };
            } catch {
              return {
                name: entry.name,
                type: entry.isDirectory() ? 'directory' as const : 'file' as const,
                size: 0,
                modifiedAt: new Date().toISOString(),
              };
            }
          })
      );
      return { items };
    } catch (err) {
      log.warn({ err, targetDir }, 'failed to list directory');
      return { items: [] };
    }
  });

  // Create directory
  app.post('/api/v1/files/mkdir', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { path: dirPath } = MkdirInputSchema.parse(req.body);
    const workspaceRoot = getWorkspaceRoot(userId);
    const targetDir = validatePath(workspaceRoot, dirPath);

    await mkdir(targetDir, { recursive: true });
    return { success: true, path: dirPath };
  });

  // Upload files
  app.post('/api/v1/files/upload', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const workspaceRoot = getWorkspaceRoot(userId);
    try { await mkdir(workspaceRoot, { recursive: true }); } catch (err) {
      log.warn({ err, workspaceRoot }, 'failed to create workspace directory for upload');
      return reply.status(500).send({ error: 'Failed to initialize workspace' });
    }

    try {
      const parts = (req as unknown as { parts: () => AsyncIterable<{ type: string; fieldname: string; filename?: string; file?: AsyncIterable<Buffer>; value?: string }> }).parts();
      let targetPath = workspaceRoot;

      for await (const part of parts) {
        if (part.type === 'field' && part.fieldname === 'path') {
          const pathVal = part.value ?? '/';
          targetPath = pathVal === '/' ? workspaceRoot : validatePath(workspaceRoot, pathVal);
          await mkdir(targetPath, { recursive: true });
        }
        if (part.type === 'file' && part.filename && part.file) {
          const safeName = part.filename.replace(/[/\\]/g, '_').replace(/\.\./g, '_');

          // Block dangerous file extensions
          const ext = safeName.includes('.') ? ('.' + safeName.split('.').pop()!.toLowerCase()) : '';
          if (BLOCKED_EXTENSIONS.has(ext)) {
            // Drain the stream so the multipart parser doesn't stall
            for await (const _ of part.file) { /* discard */ }
            log.warn({ userId, filename: safeName, ext }, 'blocked upload of dangerous file type');
            continue;
          }

          const filePath = join(targetPath, safeName);
          const chunks: Buffer[] = [];
          let totalSize = 0;
          for await (const chunk of part.file) {
            totalSize += chunk.length;
            if (totalSize > MAX_UPLOAD_FILE_SIZE) {
              log.warn({ userId, filename: safeName, totalSize }, 'upload exceeded max file size');
              break;
            }
            chunks.push(chunk);
          }
          if (totalSize > MAX_UPLOAD_FILE_SIZE) {
            continue; // skip writing oversized file
          }
          await writeFile(filePath, Buffer.concat(chunks));
          log.info({ userId, filePath }, 'file uploaded');
        }
      }
      return { success: true };
    } catch (err) {
      log.error({ err }, 'upload failed');
      return reply.status(500).send({ error: 'Upload failed' });
    }
  });

  // Download single file
  app.get('/api/v1/files/download', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const queryPath = (req.query as { path?: string }).path ?? '/';
    const workspaceRoot = getWorkspaceRoot(userId);
    const targetFile = validatePath(workspaceRoot, queryPath);

    try {
      const st = await stat(targetFile);
      if (!st.isFile()) {
        return reply.status(400).send({ error: 'Not a file' });
      }
      const fileName = targetFile.split(/[/\\]/).pop() ?? 'file';
      reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
      reply.header('Content-Type', 'application/octet-stream');
      reply.header('Content-Length', st.size.toString());
      return reply.send(createReadStream(targetFile));
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  // Download directory as ZIP
  app.get('/api/v1/files/download-zip', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const queryPath = (req.query as { path?: string }).path ?? '/';
    const workspaceRoot = getWorkspaceRoot(userId);
    const targetDir = queryPath === '/' ? workspaceRoot : validatePath(workspaceRoot, queryPath);

    try {
      const st = await stat(targetDir);
      if (!st.isDirectory()) {
        return reply.status(400).send({ error: 'Not a directory' });
      }
    } catch {
      return reply.status(404).send({ error: 'Directory not found' });
    }

    // Create a tar.gz-like response using exec
    // Simple approach: list all files and send as JSON with contents for now
    // In production, use archiver or similar. For MVP, we'll use a simpler approach.
    try {
      const { execFile } = await import('node:child_process');
      const { promisify } = await import('node:util');
      const execFileAsync = promisify(execFile);
      const isWindows = process.platform === 'win32';
      const tmpZip = join(process.env.TEMP ?? '/tmp', `titan-${Date.now()}.zip`);

      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', 'attachment; filename="workspace.zip"');

      if (isWindows) {
        await execFileAsync('powershell', [
          '-NoProfile', '-Command',
          `Compress-Archive -Path (Join-Path ${JSON.stringify(targetDir)} '*') -DestinationPath ${JSON.stringify(tmpZip)} -Force`,
        ], { timeout: 30000 });
      } else {
        await execFileAsync('zip', ['-r', tmpZip, '.'], { cwd: targetDir, timeout: 30000 });
      }

      const stream = createReadStream(tmpZip);
      stream.on('end', () => { rm(tmpZip, { force: true }).catch(() => {}); });
      return reply.send(stream);
    } catch (err) {
      log.error({ err }, 'zip creation failed');
      return reply.status(500).send({ error: 'Failed to create zip' });
    }
  });

  // Delete file or directory
  app.delete('/api/v1/files', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const queryPath = (req.query as { path?: string }).path ?? '';
    if (!queryPath || queryPath === '/') {
      return reply.status(400).send({ error: 'Cannot delete workspace root' });
    }
    const workspaceRoot = getWorkspaceRoot(userId);
    const target = validatePath(workspaceRoot, queryPath);

    try {
      await rm(target, { recursive: true, force: true });
      log.info({ userId, target }, 'file/dir deleted');
      return { success: true };
    } catch (err) {
      log.error({ err, target }, 'delete failed');
      return reply.status(500).send({ error: 'Delete failed' });
    }
  });

  // Read file content (for code editor)
  app.get('/api/v1/files/content', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const queryPath = (req.query as { path?: string }).path ?? '';
    if (!queryPath) return reply.status(400).send({ error: 'Path required' });
    const workspaceRoot = getWorkspaceRoot(userId);
    const targetFile = validatePath(workspaceRoot, queryPath);

    try {
      const st = await stat(targetFile);
      if (!st.isFile()) return reply.status(400).send({ error: 'Not a file' });
      if (st.size > 5 * 1024 * 1024) return reply.status(400).send({ error: 'File too large (max 5MB)' });
      const content = await readFile(targetFile, 'utf-8');
      return { content, size: st.size, path: queryPath };
    } catch {
      return reply.status(404).send({ error: 'File not found' });
    }
  });

  // Write file content (for code editor)
  app.put('/api/v1/files/content', async (req, reply) => {
    const userId = (req as unknown as { auth: { userId: string } }).auth.userId;
    const { path: filePath, content } = WriteFileInputSchema.parse(req.body);
    const workspaceRoot = getWorkspaceRoot(userId);
    const targetFile = validatePath(workspaceRoot, filePath);

    const dir = targetFile.substring(0, targetFile.lastIndexOf('/') > 0 ? targetFile.lastIndexOf('/') : targetFile.lastIndexOf('\\'));
    await mkdir(dir, { recursive: true });
    await writeFile(targetFile, content, 'utf-8');
    log.info({ userId, filePath }, 'file written via editor');
    return { success: true, path: filePath };
  });
};
