import { z } from 'zod';
import { getLogger } from '@titan/logging';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import {
  registerJobSchema,
  type TitanWorker,
  createWorker,
} from '@titan/queue';
import { SwarmOrchestrator, createProviderFromEnv, getGlobalToolRegistry, type ToolResult, type AgentRun, type AgentRunInput } from '@titan/agent-engine';
import { createRunner } from './create-runner.js';
import { storeSwarmTask } from './swarm-store.js';
import { getGlobalMemoryClient } from '@titan/memory';
import { agentRuns, userSecrets, userContext, userProjects } from '@titan/database';
import { executeBash, patchFile, readFileAst, firecrawlScrape, httpRequest, writeFile, readFileRaw, braveSearch, braveAnswers, githubApi, dockerOrchestrate, sendEmail, parseCsvJson, zipUnzip, pdfRead, databaseQuery, telegramSendFile, excelRead, qrGenerate, hashCrypto, randomToken, base64Tool, uuidGenerate, jsonValidate, textDiff, markdownToHtml, weatherGet, currencyConvert, htmlToText, screenshotUrl, youtubeSearch, mapsGeocode, translateText, urlShorten, calculate, timezoneConvert, regexTest, jwtDecode, ipLookup, dnsLookup, textStats, passwordGenerate, colorConvert, fileWatch, manageAgentProfile, pdfCreate, spreadsheetCreate, imageGenerate, imageAnalyze, s3Operations, googleDrive, notionApi, linearApi, rssFeedParse, webMonitor, csvTransform, dataVisualize, slackMessage, smsMessage, textClassify, codeAnalyze, systemMetrics, invoiceGenerate, reportGenerate, jiraApi, seoAnalyze, xmlParse, networkDiagnose, textSummarize, entityExtract, accessibilityCheck, budgetTracker, imageEdit, documentTemplate, slideCreate, gcsOperations, dropboxSync, trelloApi, asanaApi, sitemapCrawl, jsonSchemaValidate, yamlConvert, discordMessage, whatsappMessage, pushNotification, embeddingsGenerate, logSearch, databaseBackup, cronManage, processManager, contractDraft } from '@titan/tools';
import { loadConfig } from '@titan/config';
import { registerDesktopTools } from './desktop-tools.js';
import { startBackgroundScheduler, stopBackgroundScheduler } from './background-scheduler.js';

const cfg = loadConfig();

const log = getLogger().child({ component: 'queue-bootstrap' });

// === Tool Registry (Phase 9-lite) ===
const registry = getGlobalToolRegistry();

registry.register({
  name: 'execute_bash',
  description: 'Execute a bash command on the server. Returns stdout/stderr output.',
  schema: {
    command: { type: 'string', description: 'The bash command to execute' },
    cwd: { type: 'string', description: 'Working directory (optional)' },
    timeoutMs: { type: 'number', description: 'Timeout in milliseconds (optional, default 10000)' },
  },
  requiredParams: ['command'],
  handler: async (params: unknown) => {
    const { command, cwd, timeoutMs } = params as { command: string; cwd?: string; timeoutMs?: number };
    return executeBash({ command, cwd, timeoutMs: timeoutMs ?? 10_000 });
  },
  tags: ['system', 'execution'],
  riskLevel: 'dangerous',
});

registry.register({
  name: 'patch_file',
  description: 'Apply a unified diff patch to a file to modify its content.',
  schema: {
    filePath: { type: 'string', description: 'Absolute path to the file' },
    patch: { type: 'string', description: 'Unified diff patch content' },
  },
  requiredParams: ['filePath', 'patch'],
  handler: async (params: unknown) => {
    const { filePath, patch } = params as { filePath: string; patch: string };
    return patchFile({ filePath, patch });
  },
  tags: ['filesystem', 'code'],
  riskLevel: 'elevated',
});

registry.register({
  name: 'read_file_ast',
  description: 'Read a code file and return its structural outline (functions, classes, exports).',
  schema: {
    filePath: { type: 'string', description: 'Absolute path to the code file' },
  },
  requiredParams: ['filePath'],
  handler: async (params: unknown) => {
    const { filePath } = params as { filePath: string };
    return readFileAst({ filePath });
  },
  tags: ['filesystem', 'code'],
});

registry.register({
  name: 'firecrawl_scrape',
  description: 'Fetch a webpage URL and return its plain text content (web scraping).',
  schema: {
    url: { type: 'string', description: 'The URL to fetch and extract text from' },
    timeoutMs: { type: 'number', description: 'Timeout in milliseconds (optional, default 10000)' },
  },
  requiredParams: ['url'],
  handler: async (params: unknown) => {
    const { url, timeoutMs } = params as { url: string; timeoutMs?: number };
    return firecrawlScrape({ url, timeoutMs: timeoutMs ?? 10_000 });
  },
  tags: ['network', 'web'],
});

registry.register({
  name: 'remember',
  description: 'Save a fact or preference about the user for future conversations.',
  schema: {
    ownerId: { type: 'string', description: 'User or chat ID' },
    key: { type: 'string', description: 'Key name for the fact (e.g. "name", "language")' },
    value: { type: 'string', description: 'Value to store' },
  },
  requiredParams: ['ownerId', 'key', 'value'],
  handler: async (params: unknown) => {
    const { ownerId: rawOwner, key, value } = params as { ownerId: string; key: string; value: string };
    // Identity unification: facts saved under a Telegram chat id are re-pointed
    // to the linked dashboard user so both surfaces see one memory.
    let ownerId = rawOwner;
    if (/^\d+$/.test(rawOwner)) {
      try {
        const linked = await userContext.findOwnerByKey('telegram_id', rawOwner);
        if (linked) ownerId = linked;
      } catch { /* keep raw owner */ }
    }
    await userContext.set(ownerId, key, value);
    return { saved: true, key, value };
  },
  tags: ['memory', 'context'],
});

registry.register({
  name: 'recall',
  description: 'Retrieve all saved facts and preferences about the user.',
  schema: {
    ownerId: { type: 'string', description: 'User or chat ID' },
  },
  requiredParams: ['ownerId'],
  handler: async (params: unknown) => {
    const { ownerId } = params as { ownerId: string };
    const ctx = await userContext.getAll(ownerId);
    return { context: ctx };
  },
  tags: ['memory', 'context'],
});

registry.register({
  name: 'set_secret',
  description: 'Store a sensitive secret (API key, token, password) encrypted.',
  schema: {
    ownerId: { type: 'string', description: 'User or chat ID' },
    key: { type: 'string', description: 'Secret name/key' },
    value: { type: 'string', description: 'Secret value to encrypt and store' },
    description: { type: 'string', description: 'Optional description of the secret' },
  },
  requiredParams: ['ownerId', 'key', 'value'],
  handler: async (params: unknown) => {
    const { ownerId, key, value, description } = params as { ownerId: string; key: string; value: string; description?: string };
    await userSecrets.set(ownerId, key, value, description);
    return { saved: true, key, note: 'Secret stored encrypted. Value will not be displayed.' };
  },
  tags: ['memory', 'secrets'],
});

// ── Skills: expose the synthesized-skills library to the agent ──
import { synthesizedSkills } from '@titan/database';

registry.register({
  name: 'list_skills',
  description: 'List skills Titan has synthesized from past tasks. Skills with code are executable via use_skill; knowledge skills are background info. Use before attempting a complex task — a reusable skill may already exist.',
  schema: {
    limit: { type: 'number', description: 'Max skills to return (default 20)' },
    verifiedOnly: { type: 'boolean', description: 'Only verified/executable skills (default false)' },
  },
  requiredParams: [],
  handler: async (params: unknown) => {
    const { limit, verifiedOnly } = (params ?? {}) as { limit?: number; verifiedOnly?: boolean };
    const rows = await synthesizedSkills.listAll(Math.min(limit ?? 20, 100));
    const mapped = rows.map((r) => ({
      id: r['id'],
      name: r['name'],
      description: r['description'],
      proficiency: r['proficiency'],
      verified: r['verified'] === true,
      hasCode: typeof r['code'] === 'string' && (r['code'] as string).length > 50,
      timesUsed: r['times_used'] ?? null,
    }));
    const skills = verifiedOnly ? mapped.filter((s) => s.verified && s.hasCode) : mapped;
    const all = await synthesizedSkills.count();
    return {
      total: all,
      shown: skills.length,
      executable: mapped.filter((s) => s.verified && s.hasCode).length,
      knowledgeOnly: mapped.filter((s) => !s.hasCode).length,
      skills,
    };
  },
  tags: ['skills', 'memory'],
});

registry.register({
  name: 'use_skill',
  description: 'Retrieve the full implementation (code + decomposition steps) of a synthesized skill by id. Marks the skill as used so proficiency grows.',
  schema: {
    skillId: { type: 'string', description: 'Skill id from list_skills' },
  },
  requiredParams: ['skillId'],
  handler: async (params: unknown) => {
    const { skillId } = params as { skillId: string };
    const skill = await synthesizedSkills.findById(skillId);
    if (!skill) return { success: false, error: `Skill not found: ${skillId}` };
    // Growth on use: bump proficiency by 2 (cap 100)
    const proficiency = Math.min(100, Number(skill['proficiency'] ?? 50) + 2);
    await synthesizedSkills.upsert(skillId, { ...skill, proficiency }, ['proficiency']);
    return {
      success: true,
      name: skill['name'],
      description: skill['description'],
      code: skill['code'],
      proficiency,
    };
  },
  tags: ['skills', 'memory'],
});

registry.register({
  name: 'list_secrets',
  description: 'List the names of stored secrets (not their values) for the user.',
  schema: {
    ownerId: { type: 'string', description: 'User or chat ID' },
  },
  requiredParams: ['ownerId'],
  handler: async (params: unknown) => {
    const { ownerId } = params as { ownerId: string };
    const list = await userSecrets.list(ownerId);
    return { secrets: list.map((s) => ({ key: s.key, description: s.description })) };
  },
  tags: ['memory', 'secrets'],
});

registry.register({
  name: 'set_project',
  description: 'Save or update a project for the user. Set isDefault=true to make it the active project.',
  schema: {
    ownerId: { type: 'string', description: 'User or chat ID' },
    name: { type: 'string', description: 'Project name (e.g. "The-Titan", "client-site")' },
    path: { type: 'string', description: 'Absolute path on server (optional)' },
    repoUrl: { type: 'string', description: 'Git repository URL (optional)' },
    branch: { type: 'string', description: 'Git branch (default: main)' },
    description: { type: 'string', description: 'Short description (optional)' },
    isDefault: { type: 'boolean', description: 'Make this the active/default project (default: false)' },
  },
  requiredParams: ['ownerId', 'name'],
  handler: async (params: unknown) => {
    const { ownerId, name, path, repoUrl, branch, description, isDefault } = params as {
      ownerId: string;
      name: string;
      path?: string;
      repoUrl?: string;
      branch?: string;
      description?: string;
      isDefault?: boolean;
    };
    const project = await userProjects.set(ownerId, name, { path, repoUrl, branch, description, isDefault });
    return { saved: true, project: { name: project.name, path: project.path, repoUrl: project.repoUrl, branch: project.branch, isDefault: project.isDefault } };
  },
  tags: ['memory', 'projects'],
});

registry.register({
  name: 'get_project',
  description: 'Retrieve a specific project or the default/active project for the user.',
  schema: {
    ownerId: { type: 'string', description: 'User or chat ID' },
    name: { type: 'string', description: 'Project name (optional — if omitted, returns default project)' },
  },
  requiredParams: ['ownerId'],
  handler: async (params: unknown) => {
    const { ownerId, name } = params as { ownerId: string; name?: string };
    if (name) {
      const project = await userProjects.get(ownerId, name);
      return project ? { project } : { error: `Project "${name}" not found.` };
    }
    const project = await userProjects.getDefault(ownerId);
    if (project) return { project };
    const all = await userProjects.list(ownerId);
    return { projects: all.map((p: { name: string; path: string | null; repoUrl: string | null; isDefault: boolean }) => ({ name: p.name, path: p.path, repoUrl: p.repoUrl, isDefault: p.isDefault })) };
  },
  tags: ['memory', 'projects'],
});

registry.register({
  name: 'http_request',
  description: 'Make an HTTP request to any URL or API endpoint. Supports GET, POST, PUT, DELETE, PATCH.',
  schema: {
    url: { type: 'string', description: 'The full URL to request' },
    method: { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET)' },
    body: { type: 'string', description: 'Request body as string (optional, for POST/PUT)' },
    timeoutMs: { type: 'number', description: 'Timeout in ms (optional)' },
  },
  requiredParams: ['url'],
  handler: async (params: unknown) => {
    const p = params as { url: string; method?: string; headers?: Record<string, string>; body?: string; timeoutMs?: number };
    return httpRequest(p);
  },
  tags: ['network', 'api'],
});

registry.register({
  name: 'write_file',
  description: 'Write content to a file on the server filesystem. Creates parent directories automatically.',
  schema: {
    filePath: { type: 'string', description: 'Absolute path to write the file to' },
    content: { type: 'string', description: 'Text content to write into the file' },
  },
  requiredParams: ['filePath', 'content'],
  handler: async (params: unknown) => {
    const p = params as { filePath: string; content: string; createDirs?: boolean };
    return writeFile(p);
  },
  tags: ['filesystem'],
});

registry.register({
  name: 'read_file_content',
  description: 'Read the full text content of a file from the server filesystem.',
  schema: {
    filePath: { type: 'string', description: 'Absolute path to the file to read' },
    maxBytes: { type: 'number', description: 'Max characters to return (optional, default 200000)' },
  },
  requiredParams: ['filePath'],
  handler: async (params: unknown) => {
    const p = params as { filePath: string; maxBytes?: number };
    return readFileRaw(p);
  },
  tags: ['filesystem'],
});

if (cfg.BRAVE_SEARCH_API_KEY) {
  registry.register({
    name: 'brave_search',
    description: 'Search the web using Brave Search API. Returns titles, URLs, and descriptions.',
    schema: {
      query: { type: 'string', description: 'Search query' },
      count: { type: 'number', description: 'Number of results (optional, default 10)' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const { query, count } = params as { query: string; count?: number };
      return braveSearch({ query, count, apiKey: cfg.BRAVE_SEARCH_API_KEY });
    },
    tags: ['network', 'web', 'search'],
  });
}

if (cfg.BRAVE_ANSWERS_API_KEY) {
  registry.register({
    name: 'brave_answers',
    description: 'Get an AI-generated summary answer for a query using Brave Answers API.',
    schema: {
      query: { type: 'string', description: 'The question or query to get a summarized answer for' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const { query } = params as { query: string };
      return braveAnswers({ query, apiKey: cfg.BRAVE_ANSWERS_API_KEY });
    },
    tags: ['network', 'web', 'search'],
  });
}

if (cfg.GITHUB_TOKEN) {
  registry.register({
    name: 'github_api',
    description: 'Call the GitHub REST API. Use endpoint like /repos/owner/repo/issues. Supports GET, POST, PATCH, DELETE.',
    schema: {
      endpoint: { type: 'string', description: 'GitHub API endpoint, e.g. /repos/owner/repo/issues' },
      method: { type: 'string', description: 'HTTP method: GET, POST, PATCH, DELETE (default: GET)' },
    },
    requiredParams: ['endpoint'],
    handler: async (params: unknown) => {
      const { endpoint, method, body } = params as { endpoint: string; method?: string; body?: Record<string, unknown> };
      return githubApi({ endpoint, method, body, token: cfg.GITHUB_TOKEN });
    },
    tags: ['network', 'api', 'github'],
  });
}

registry.register({
  name: 'docker_manage',
  description: 'Manage Docker containers: list, run, stop, remove, logs, exec.',
  schema: {
    action: { type: 'string', description: 'Action: list, run, stop, remove, logs, exec', enum: ['list', 'run', 'stop', 'remove', 'logs', 'exec'] },
    containerName: { type: 'string', description: 'Container name or ID (required for stop/remove/logs/exec)' },
    image: { type: 'string', description: 'Docker image (required for run)' },
    command: { type: 'string', description: 'Command to run (for run or exec actions)' },
  },
  requiredParams: ['action'],
  handler: async (params: unknown) => {
    return dockerOrchestrate(params as Parameters<typeof dockerOrchestrate>[0]);
  },
  tags: ['docker', 'infrastructure'],
});

registry.register({
  name: 'send_email',
  description: 'Send an email via SMTP.',
  schema: {
    smtpHost: { type: 'string', description: 'SMTP server hostname' },
    smtpUser: { type: 'string', description: 'SMTP username/email' },
    smtpPass: { type: 'string', description: 'SMTP password' },
    from: { type: 'string', description: 'Sender email address' },
    to: { type: 'string', description: 'Recipient email address (or comma-separated)' },
    subject: { type: 'string', description: 'Email subject' },
    text: { type: 'string', description: 'Plain text email body' },
    html: { type: 'string', description: 'HTML email body (optional)' },
  },
  requiredParams: ['smtpHost', 'smtpUser', 'smtpPass', 'from', 'to', 'subject'],
  handler: async (params: unknown) => {
    return sendEmail(params as Parameters<typeof sendEmail>[0]);
  },
  tags: ['communication', 'email'],
});

registry.register({
  name: 'parse_csv_json',
  description: 'Parse and query CSV or JSON data.',
  schema: {
    content: { type: 'string', description: 'Raw CSV or JSON string content' },
    format: { type: 'string', description: 'Data format: csv, json, or auto', enum: ['csv', 'json', 'auto'] },
    query: { type: 'string', description: 'Optional text filter to search rows' },
    limit: { type: 'number', description: 'Max rows to return (optional, default 100)' },
  },
  requiredParams: ['content', 'format'],
  handler: async (params: unknown) => {
    return parseCsvJson(params as Parameters<typeof parseCsvJson>[0]);
  },
  tags: ['data', 'parsing'],
});

registry.register({
  name: 'zip_unzip',
  description: 'Zip or unzip files/directories, or list contents of a zip archive.',
  schema: {
    action: { type: 'string', description: 'Action: zip, unzip, or list', enum: ['zip', 'unzip', 'list'] },
    sourcePath: { type: 'string', description: 'Path to the source file or directory' },
    destPath: { type: 'string', description: 'Destination path (optional)' },
  },
  requiredParams: ['action', 'sourcePath'],
  handler: async (params: unknown) => {
    return zipUnzip(params as Parameters<typeof zipUnzip>[0]);
  },
  tags: ['filesystem', 'archive'],
});

registry.register({
  name: 'pdf_read',
  description: 'Extract text content from a PDF file (requires poppler-utils on server).',
  schema: {
    filePath: { type: 'string', description: 'Absolute path to the PDF file' },
    page: { type: 'number', description: 'Specific page number to extract (optional, extracts all if omitted)' },
    maxChars: { type: 'number', description: 'Max characters to return (optional, default 100000)' },
  },
  requiredParams: ['filePath'],
  handler: async (params: unknown) => {
    return pdfRead(params as Parameters<typeof pdfRead>[0]);
  },
  tags: ['filesystem', 'documents'],
});

registry.register({
  name: 'database_query',
  description: 'Run a read-only SELECT query against the Titan PostgreSQL database. Only SELECT is allowed.',
  schema: {
    sql: { type: 'string', description: 'SQL SELECT query to execute' },
    limit: { type: 'number', description: 'Max rows to return (optional, default 200)' },
  },
  requiredParams: ['sql'],
  handler: async (params: unknown) => {
    return databaseQuery(params as Parameters<typeof databaseQuery>[0]);
  },
  tags: ['database', 'data'],
});

if (cfg.TELEGRAM_BOT_TOKEN) {
  registry.register({
    name: 'telegram_send_file',
    description: 'Send a file or image to a Telegram chat.',
    schema: {
      chatId: { type: 'string', description: 'Telegram chat ID to send to' },
      filePath: { type: 'string', description: 'Absolute path to the file to send' },
      caption: { type: 'string', description: 'Optional caption for the file' },
      type: { type: 'string', description: 'Type: document or photo', enum: ['document', 'photo'] },
    },
    requiredParams: ['chatId', 'filePath'],
    handler: async (params: unknown) => {
      const p = params as { chatId: number | string; filePath: string; caption?: string; type?: 'document' | 'photo' };
      return telegramSendFile({ ...p, token: cfg.TELEGRAM_BOT_TOKEN });
    },
    tags: ['communication', 'telegram'],
  });
}

registry.register({
  name: 'excel_read',
  description: 'Read and parse an Excel (.xlsx) file. Returns sheet names and data rows.',
  schema: {
    path: { type: 'string', description: 'Absolute path to the .xlsx file' },
    sheet: { type: 'string', description: 'Specific sheet name to read (optional, reads all if omitted)' },
  },
  requiredParams: ['path'],
  handler: async (params: unknown) => excelRead(params as Parameters<typeof excelRead>[0]),
  tags: ['files', 'data'],
});

registry.register({
  name: 'qr_generate',
  description: 'Generate a QR code for any text or URL. Returns a base64 data URL image.',
  schema: {
    text: { type: 'string', description: 'The text or URL to encode in the QR code' },
    size: { type: 'number', description: 'Image size in pixels (default 300)' },
  },
  requiredParams: ['text'],
  handler: async (params: unknown) => qrGenerate(params as Parameters<typeof qrGenerate>[0]),
  tags: ['utility', 'image'],
});

registry.register({
  name: 'hash_crypto',
  description: 'Hash a string using MD5, SHA1, SHA256, or SHA512. Optionally use HMAC with a secret.',
  schema: {
    text: { type: 'string', description: 'Text to hash' },
    algorithm: { type: 'string', description: 'Hash algorithm', enum: ['md5', 'sha1', 'sha256', 'sha512'] },
    hmacSecret: { type: 'string', description: 'Optional HMAC secret key' },
  },
  requiredParams: ['text', 'algorithm'],
  handler: async (params: unknown) => hashCrypto(params as Parameters<typeof hashCrypto>[0]),
  tags: ['security', 'crypto'],
});

registry.register({
  name: 'random_token',
  description: 'Generate a cryptographically secure random hex token.',
  schema: {
    bytes: { type: 'number', description: 'Number of random bytes (default 32, result is 2x hex chars)' },
  },
  requiredParams: [],
  handler: async (params: unknown) => randomToken(params as Parameters<typeof randomToken>[0]),
  tags: ['security', 'utility'],
});

registry.register({
  name: 'base64',
  description: 'Encode or decode a string using Base64.',
  schema: {
    text: { type: 'string', description: 'Text to encode or decode' },
    operation: { type: 'string', description: 'Operation to perform', enum: ['encode', 'decode'] },
  },
  requiredParams: ['text', 'operation'],
  handler: async (params: unknown) => base64Tool(params as Parameters<typeof base64Tool>[0]),
  tags: ['utility', 'encoding'],
});

registry.register({
  name: 'uuid_generate',
  description: 'Generate one or more UUIDs (v4).',
  schema: {
    count: { type: 'number', description: 'Number of UUIDs to generate (default 1, max 100)' },
  },
  requiredParams: [],
  handler: async (params: unknown) => uuidGenerate(params as Parameters<typeof uuidGenerate>[0]),
  tags: ['utility'],
});

registry.register({
  name: 'json_validate',
  description: 'Validate and optionally format a JSON string. Returns validity, type info, and top-level keys.',
  schema: {
    json: { type: 'string', description: 'The JSON string to validate' },
    format: { type: 'boolean', description: 'Whether to return a pretty-printed version (default false)' },
  },
  requiredParams: ['json'],
  handler: async (params: unknown) => jsonValidate(params as Parameters<typeof jsonValidate>[0]),
  tags: ['data', 'utility'],
});

registry.register({
  name: 'text_diff',
  description: 'Compare two texts and show the differences (added/removed lines or words).',
  schema: {
    original: { type: 'string', description: 'Original text' },
    modified: { type: 'string', description: 'Modified text to compare against original' },
    mode: { type: 'string', description: 'Comparison mode: lines or words (default lines)', enum: ['lines', 'words'] },
    patch: { type: 'boolean', description: 'Include unified diff patch output (default false)' },
  },
  requiredParams: ['original', 'modified'],
  handler: async (params: unknown) => textDiff(params as Parameters<typeof textDiff>[0]),
  tags: ['utility', 'text'],
});

registry.register({
  name: 'markdown_to_html',
  description: 'Convert Markdown text to HTML.',
  schema: {
    markdown: { type: 'string', description: 'Markdown text to convert' },
  },
  requiredParams: ['markdown'],
  handler: async (params: unknown) => markdownToHtml(params as Parameters<typeof markdownToHtml>[0]),
  tags: ['utility', 'text'],
});

registry.register({
  name: 'weather_get',
  description: 'Get current weather for any city or location. Returns temperature, humidity, wind speed, and description.',
  schema: {
    location: { type: 'string', description: 'City name or location (e.g. "Cairo", "London, UK")' },
    units: { type: 'string', description: 'Temperature units: metric (Celsius) or imperial (Fahrenheit)', enum: ['metric', 'imperial'] },
  },
  requiredParams: ['location'],
  handler: async (params: unknown) => weatherGet(params as Parameters<typeof weatherGet>[0]),
  tags: ['weather', 'utility'],
  cacheTtlMs: 10 * 60 * 1000,
  rateLimit: { maxCalls: 20, windowMs: 60_000 },
});

registry.register({
  name: 'currency_convert',
  description: 'Convert an amount from one currency to another. Returns the converted amount and exchange rate.',
  schema: {
    from: { type: 'string', description: 'Source currency code (e.g. USD, EUR, EGP)' },
    to: { type: 'string', description: 'Target currency code (e.g. USD, EUR, EGP)' },
    amount: { type: 'number', description: 'Amount to convert (default 1)' },
  },
  requiredParams: ['from', 'to'],
  handler: async (params: unknown) => currencyConvert(params as Parameters<typeof currencyConvert>[0]),
  tags: ['finance', 'utility'],
  cacheTtlMs: 15 * 60 * 1000,
  rateLimit: { maxCalls: 30, windowMs: 60_000 },
});

registry.register({
  name: 'html_to_text',
  description: 'Extract plain text from HTML. Removes all tags and decodes HTML entities.',
  schema: {
    html: { type: 'string', description: 'HTML content to convert to plain text' },
    preserveNewlines: { type: 'boolean', description: 'Preserve paragraph/line breaks as newlines (default true)' },
  },
  requiredParams: ['html'],
  handler: async (params: unknown) => htmlToText(params as Parameters<typeof htmlToText>[0]),
  tags: ['utility', 'text'],
});

registry.register({
  name: 'screenshot_url',
  description: 'Take a screenshot of any webpage and return it as a base64 image.',
  schema: {
    url: { type: 'string', description: 'The URL of the webpage to screenshot' },
    width: { type: 'number', description: 'Viewport width in pixels (default 1280)' },
    height: { type: 'number', description: 'Viewport height in pixels (default 800)' },
    fullPage: { type: 'boolean', description: 'Capture the full page height (default false)' },
  },
  requiredParams: ['url'],
  handler: async (params: unknown) => screenshotUrl(params as Parameters<typeof screenshotUrl>[0]),
  tags: ['browser', 'utility'],
});

registry.register({
  name: 'youtube_search',
  description: 'Search YouTube for videos. Returns video titles, descriptions, channels, and URLs.',
  schema: {
    query: { type: 'string', description: 'Search query' },
    maxResults: { type: 'number', description: 'Maximum number of results to return (default 5, max 25)' },
  },
  requiredParams: ['query'],
  handler: async (params: unknown) => youtubeSearch(params as Parameters<typeof youtubeSearch>[0]),
  tags: ['video', 'search'],
  cacheTtlMs: 5 * 60 * 1000,
  rateLimit: { maxCalls: 10, windowMs: 60_000 },
});

registry.register({
  name: 'maps_geocode',
  description: 'Convert a text address to coordinates (geocode) or coordinates to address (reverse geocode) using Google Maps.',
  schema: {
    address: { type: 'string', description: 'Text address to geocode (e.g. "Cairo, Egypt")' },
    lat: { type: 'number', description: 'Latitude for reverse geocoding' },
    lng: { type: 'number', description: 'Longitude for reverse geocoding' },
  },
  requiredParams: [],
  handler: async (params: unknown) => mapsGeocode(params as Parameters<typeof mapsGeocode>[0]),
  tags: ['maps', 'location'],
});

registry.register({
  name: 'translate_text',
  description: 'Translate text to any language. Works without an API key using MyMemory fallback (5000 chars/day free).',
  schema: {
    text: { type: 'string', description: 'Text to translate' },
    targetLang: { type: 'string', description: 'Target language code (e.g. ar, en, fr, de, es, zh)' },
    sourceLang: { type: 'string', description: 'Source language code (default: auto-detect)' },
  },
  requiredParams: ['text', 'targetLang'],
  handler: async (params: unknown) => translateText(params as Parameters<typeof translateText>[0]),
  tags: ['language', 'utility'],
});

registry.register({
  name: 'url_shorten',
  description: 'Shorten any URL using TinyURL. No API key required.',
  schema: {
    url: { type: 'string', description: 'The long URL to shorten' },
  },
  requiredParams: ['url'],
  handler: async (params: unknown) => urlShorten(params as Parameters<typeof urlShorten>[0]),
  tags: ['utility', 'url'],
});

registry.register({
  name: 'calculate',
  description: 'Evaluate a mathematical expression. Supports +, -, *, /, **, sqrt, abs, sin, cos, tan, log, pi, and more.',
  schema: {
    expression: { type: 'string', description: 'Math expression to evaluate (e.g. "2 + 2", "sqrt(144)", "pi * 5^2")' },
  },
  requiredParams: ['expression'],
  handler: async (params: unknown) => calculate(params as Parameters<typeof calculate>[0]),
  tags: ['math', 'utility'],
});

registry.register({
  name: 'timezone_convert',
  description: 'Convert a date/time from one timezone to another.',
  schema: {
    time: { type: 'string', description: 'ISO date-time string to convert (default: current time)' },
    fromTimezone: { type: 'string', description: 'Source timezone (e.g. "America/New_York", "UTC", "Asia/Cairo")' },
    toTimezone: { type: 'string', description: 'Target timezone (e.g. "Europe/London", "Asia/Tokyo")' },
  },
  requiredParams: ['fromTimezone', 'toTimezone'],
  handler: async (params: unknown) => timezoneConvert(params as Parameters<typeof timezoneConvert>[0]),
  tags: ['time', 'utility'],
});

registry.register({
  name: 'regex_test',
  description: 'Test a regular expression against a string. Returns matches, groups, and match count.',
  schema: {
    pattern: { type: 'string', description: 'Regular expression pattern (without delimiters)' },
    input: { type: 'string', description: 'String to test the pattern against' },
    flags: { type: 'string', description: 'Regex flags (e.g. "g" for global, "i" for case-insensitive, "gi" for both)' },
  },
  requiredParams: ['pattern', 'input'],
  handler: async (params: unknown) => regexTest(params as Parameters<typeof regexTest>[0]),
  tags: ['text', 'utility'],
});

registry.register({
  name: 'jwt_decode',
  description: 'Decode and inspect a JWT token. Returns header, payload, expiry status, issuer, and subject.',
  schema: {
    token: { type: 'string', description: 'The JWT token string to decode' },
  },
  requiredParams: ['token'],
  handler: async (params: unknown) => jwtDecode(params as Parameters<typeof jwtDecode>[0]),
  tags: ['security', 'auth'],
});

registry.register({
  name: 'ip_lookup',
  description: 'Look up geolocation and ISP information for an IP address. Leave ip empty to look up the server IP.',
  schema: {
    ip: { type: 'string', description: 'IP address to look up (e.g. "8.8.8.8"). Leave empty for server IP.' },
  },
  requiredParams: [],
  handler: async (params: unknown) => ipLookup(params as Parameters<typeof ipLookup>[0]),
  tags: ['network', 'utility'],
  cacheTtlMs: 30 * 60 * 1000,
  rateLimit: { maxCalls: 20, windowMs: 60_000 },
});

registry.register({
  name: 'dns_lookup',
  description: 'Look up DNS records for a domain. Supports A, AAAA, MX, TXT, NS, CNAME, SOA, or ALL records.',
  schema: {
    domain: { type: 'string', description: 'Domain name to look up (e.g. "google.com")' },
    type: { type: 'string', description: 'DNS record type', enum: ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME', 'SOA', 'ALL'] },
  },
  requiredParams: ['domain'],
  handler: async (params: unknown) => dnsLookup(params as Parameters<typeof dnsLookup>[0]),
  tags: ['network', 'utility'],
  cacheTtlMs: 5 * 60 * 1000,
  rateLimit: { maxCalls: 30, windowMs: 60_000 },
});

registry.register({
  name: 'text_stats',
  description: 'Analyze text and return statistics: word count, sentence count, reading time, most common words, and more.',
  schema: {
    text: { type: 'string', description: 'The text to analyze' },
  },
  requiredParams: ['text'],
  handler: async (params: unknown) => textStats(params as Parameters<typeof textStats>[0]),
  tags: ['text', 'utility'],
});

registry.register({
  name: 'password_generate',
  description: 'Generate cryptographically secure random passwords with configurable length and character sets.',
  schema: {
    length: { type: 'number', description: 'Password length (default 16, max 128)' },
    includeUppercase: { type: 'boolean', description: 'Include uppercase letters (default true)' },
    includeLowercase: { type: 'boolean', description: 'Include lowercase letters (default true)' },
    includeNumbers: { type: 'boolean', description: 'Include numbers (default true)' },
    includeSymbols: { type: 'boolean', description: 'Include symbols (default true)' },
    count: { type: 'number', description: 'Number of passwords to generate (default 1, max 20)' },
  },
  requiredParams: [],
  handler: async (params: unknown) => passwordGenerate(params as Parameters<typeof passwordGenerate>[0]),
  tags: ['security', 'utility'],
});

registry.register({
  name: 'color_convert',
  description: 'Convert a color between HEX, RGB, HSL, and HSV formats.',
  schema: {
    color: { type: 'string', description: 'Color in any format: HEX (#fff or #ffffff), RGB (rgb(r,g,b)), or HSL (hsl(h,s%,l%))' },
  },
  requiredParams: ['color'],
  handler: async (params: unknown) => colorConvert(params as Parameters<typeof colorConvert>[0]),
  tags: ['design', 'utility'],
});

registry.register({
  name: 'file_watch',
  description: 'Watch a file or directory for changes. Waits until a change event occurs or timeout is reached.',
  schema: {
    path: { type: 'string', description: 'Absolute or relative path to the file or directory to watch' },
    timeoutMs: { type: 'number', description: 'Maximum time to wait for a change in milliseconds (default 10000)' },
  },
  requiredParams: ['path'],
  handler: async (params: unknown) => fileWatch(params as Parameters<typeof fileWatch>[0]),
  tags: ['files', 'utility'],
});

registry.register({
  name: 'manage_agent_profile',
  description: 'Create, update, delete, list, or get agent profiles. Use this to create specialized agents with custom system prompts and tool permissions.',
  schema: {
    action: { type: 'string', description: 'Action to perform', enum: ['create', 'update', 'delete', 'list', 'get'] },
    name: { type: 'string', description: 'Name of the agent (for create/update)' },
    slug: { type: 'string', description: 'URL-friendly identifier (lowercase, dashes only, e.g. "web-researcher")' },
    description: { type: 'string', description: 'Short description of what the agent does' },
    systemPrompt: { type: 'string', description: 'System prompt that defines the agent personality and behavior' },
    allowedTools: { type: 'string', description: 'JSON array of tool names the agent can use (e.g. ["brave_search", "http_request"])' },
    forbiddenTools: { type: 'string', description: 'JSON array of tool names the agent cannot use' },
    maxSteps: { type: 'number', description: 'Maximum number of reasoning steps (1-50, default 10)' },
    id: { type: 'string', description: 'Agent profile ID (for update/delete/get)' },
  },
  requiredParams: ['action'],
  handler: async (params: unknown) => {
    const p = params as Record<string, unknown>;
    // Parse JSON arrays if provided as strings
    let allowedTools = p.allowedTools;
    let forbiddenTools = p.forbiddenTools;
    if (typeof allowedTools === 'string') {
      try { allowedTools = JSON.parse(allowedTools); } catch { allowedTools = []; }
    }
    if (typeof forbiddenTools === 'string') {
      try { forbiddenTools = JSON.parse(forbiddenTools); } catch { forbiddenTools = []; }
    }
    return manageAgentProfile({
      action: p.action as 'create' | 'update' | 'delete' | 'list' | 'get',
      ownerId: (p.ownerId as string) ?? '00000000-0000-0000-0000-000000000001',
      id: p.id as string | undefined,
      name: p.name as string | undefined,
      slug: p.slug as string | undefined,
      description: p.description as string | undefined,
      systemPrompt: p.systemPrompt as string | undefined,
      model: p.model as string | undefined,
      allowedTools: allowedTools as string[] | undefined,
      forbiddenTools: forbiddenTools as string[] | undefined,
      maxSteps: p.maxSteps as number | undefined,
      temperature: p.temperature as number | undefined,
      workspaceId: p.workspaceId as string | undefined,
      isPublic: p.isPublic as boolean | undefined,
    });
  },
  tags: ['agents', 'management'],
});

// === V3 Tools (45 additional tools) ===

registry.register({
  name: 'pdf_create',
  description: 'Create a PDF document from HTML content. Returns the PDF as base64.',
  schema: { html: { type: 'string', description: 'HTML content for the PDF' }, title: { type: 'string', description: 'PDF title (optional)' } },
  requiredParams: ['html'],
  handler: async (p: unknown) => pdfCreate(p as { html: string; title?: string }),
  tags: ['document', 'pdf'],
});

registry.register({
  name: 'spreadsheet_create',
  description: 'Create a spreadsheet (CSV/TSV) from 2D array data with optional headers.',
  schema: { data: { type: 'string', description: '2D array of cell values' }, headers: { type: 'string', description: 'Column headers (optional)' }, format: { type: 'string', description: 'csv or tsv (default csv)' } },
  requiredParams: ['data'],
  handler: async (p: unknown) => spreadsheetCreate(p as { data: unknown[][]; headers?: string[]; format?: 'csv' | 'tsv'; title?: string }),
  tags: ['document', 'spreadsheet'],
});

registry.register({
  name: 'image_generate',
  description: 'Generate an image from a text description using AI. Returns base64 image.',
  schema: { prompt: { type: 'string', description: 'Text description of the image to generate' }, size: { type: 'string', description: 'Image size (optional)' } },
  requiredParams: ['prompt'],
  handler: async (p: unknown) => imageGenerate(p as { prompt: string; size?: string }),
  tags: ['ai', 'image'],
});

registry.register({
  name: 'image_analyze',
  description: 'Analyze an image and extract information (objects, text, colors, etc.).',
  schema: { image: { type: 'string', description: 'Image URL or base64 data' }, prompt: { type: 'string', description: 'What to analyze in the image' } },
  requiredParams: ['image'],
  handler: async (p: unknown) => imageAnalyze(p as { url: string; question?: string }),
  tags: ['ai', 'image', 'analysis'],
});

registry.register({
  name: 's3_operations',
  description: 'Upload, download, list, or delete files on AWS S3.',
  schema: { action: { type: 'string', description: 'upload, download, list, or delete' }, bucket: { type: 'string', description: 'S3 bucket name' }, key: { type: 'string', description: 'Object key (optional)' } },
  requiredParams: ['action', 'bucket'],
  handler: async (p: unknown) => s3Operations(p as { action: 'upload' | 'download' | 'list' | 'delete'; bucket: string; key?: string; content?: string; prefix?: string }),
  tags: ['cloud', 'aws', 'storage'],
});

registry.register({
  name: 'google_drive',
  description: 'Interact with Google Drive: list, upload, download, or search files.',
  schema: { action: { type: 'string', description: 'list, upload, download, search' }, query: { type: 'string', description: 'Search query (optional)' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => googleDrive(p as { action: 'list' | 'upload' | 'download' | 'search'; query?: string; fileId?: string; content?: string; name?: string; mimeType?: string }),
  tags: ['cloud', 'google', 'storage'],
});

registry.register({
  name: 'notion_api',
  description: 'Interact with Notion: search, create pages, query databases.',
  schema: { action: { type: 'string', description: 'search, create_page, query_db, get_page' }, query: { type: 'string', description: 'Search query (optional)' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => notionApi(p as { action: 'search' | 'create_page' | 'query_db' | 'get_page'; query?: string; databaseId?: string; pageId?: string; title?: string; content?: string; properties?: Record<string, unknown> }),
  tags: ['productivity', 'notion'],
});

registry.register({
  name: 'linear_api',
  description: 'Interact with Linear: create, list, update, or search issues.',
  schema: { action: { type: 'string', description: 'create_issue, list_issues, update_issue, search' }, title: { type: 'string', description: 'Issue title (for create)' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => linearApi(p as { action: 'create_issue' | 'list_issues' | 'update_issue' | 'search'; teamId?: string; issueId?: string; title?: string; description?: string; status?: string; query?: string; priority?: number }),
  tags: ['productivity', 'linear', 'issues'],
});

registry.register({
  name: 'rss_feed_parse',
  description: 'Parse an RSS/Atom feed and return entries.',
  schema: { url: { type: 'string', description: 'RSS feed URL' }, limit: { type: 'number', description: 'Max entries (default 10)' } },
  requiredParams: ['url'],
  handler: async (p: unknown) => rssFeedParse(p as { url: string; limit?: number }),
  tags: ['web', 'rss', 'feed'],
});

registry.register({
  name: 'web_monitor',
  description: 'Monitor a webpage for changes. Check, diff, or get status.',
  schema: { url: { type: 'string', description: 'URL to monitor' }, action: { type: 'string', description: 'check, diff, or status (default check)' } },
  requiredParams: ['url'],
  handler: async (p: unknown) => webMonitor(p as { url: string; action?: 'check' | 'diff' | 'status'; selector?: string }),
  tags: ['web', 'monitor'],
});

registry.register({
  name: 'csv_transform',
  description: 'Transform CSV data: filter, sort, aggregate, or convert.',
  schema: { csv: { type: 'string', description: 'CSV content' }, transform: { type: 'string', description: 'Transform operation' } },
  requiredParams: ['csv'],
  handler: async (p: unknown) => csvTransform(p as { csv: string; action: 'filter' | 'sort' | 'select' | 'aggregate' | 'pivot'; column?: string; value?: string; columns?: string[]; direction?: 'asc' | 'desc'; groupBy?: string; aggregation?: 'count' | 'sum' | 'avg' | 'min' | 'max' }),
  tags: ['data', 'csv'],
});

registry.register({
  name: 'data_visualize',
  description: 'Create data visualizations (charts, graphs) from data.',
  schema: { data: { type: 'string', description: 'Data to visualize' }, type: { type: 'string', description: 'Chart type (bar, line, pie, etc.)' } },
  requiredParams: ['data'],
  handler: async (p: unknown) => dataVisualize(p as { data: Array<{ label: string; value: number }>; type?: 'bar' | 'pie' | 'line' | 'table'; title?: string; width?: number }),
  tags: ['data', 'visualization', 'charts'],
});

registry.register({
  name: 'slack_message',
  description: 'Send, search, or list channels in Slack.',
  schema: { action: { type: 'string', description: 'send, search, list_channels' }, channel: { type: 'string', description: 'Channel name (for send)' }, text: { type: 'string', description: 'Message text (for send)' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => slackMessage(p as { action: 'send' | 'search' | 'list_channels'; channel?: string; text?: string; query?: string; threadTs?: string }),
  tags: ['communication', 'slack'],
});

registry.register({
  name: 'sms_message',
  description: 'Send an SMS message via Twilio.',
  schema: { to: { type: 'string', description: 'Phone number' }, body: { type: 'string', description: 'Message body' } },
  requiredParams: ['to', 'body'],
  handler: async (p: unknown) => smsMessage(p as { to: string; body: string; from?: string }),
  tags: ['communication', 'sms', 'twilio'],
});

registry.register({
  name: 'text_classify',
  description: 'Classify text by sentiment, topic, intent, language, or custom categories.',
  schema: { text: { type: 'string', description: 'Text to classify' }, type: { type: 'string', description: 'sentiment, topic, intent, language, custom' } },
  requiredParams: ['text'],
  handler: async (p: unknown) => textClassify(p as { text: string; categories?: string[]; type?: 'sentiment' | 'topic' | 'intent' | 'language' | 'custom' }),
  tags: ['ai', 'text', 'classification'],
});

registry.register({
  name: 'code_analyze',
  description: 'Analyze source code for quality, complexity, and potential issues.',
  schema: { code: { type: 'string', description: 'Source code to analyze' }, language: { type: 'string', description: 'Programming language (optional)' } },
  requiredParams: ['code'],
  handler: async (p: unknown) => codeAnalyze(p as { code: string; language?: string }),
  tags: ['code', 'analysis'],
});

registry.register({
  name: 'system_metrics',
  description: 'Get system metrics: CPU, memory, and system information.',
  schema: { type: { type: 'string', description: 'all, cpu, memory, or system (default all)' } },
  requiredParams: [],
  handler: async (p: unknown) => systemMetrics(p as { type?: 'all' | 'cpu' | 'memory' | 'system' }),
  tags: ['system', 'metrics'],
});

registry.register({
  name: 'invoice_generate',
  description: 'Generate an invoice PDF from line items and customer data.',
  schema: { items: { type: 'string', description: 'Array of line items' }, customer: { type: 'string', description: 'Customer info' } },
  requiredParams: ['items'],
  handler: async (p: unknown) => invoiceGenerate(p as { from: { name: string; email?: string; address?: string }; to: { name: string; email?: string; address?: string }; items: Array<{ description: string; quantity: number; unitPrice: number }>; tax?: number; currency?: string; notes?: string; dueDate?: string }),
  tags: ['business', 'invoice'],
});

registry.register({
  name: 'report_generate',
  description: 'Generate a formatted report from sections with headings and data.',
  schema: { title: { type: 'string', description: 'Report title' }, sections: { type: 'string', description: 'Array of sections' } },
  requiredParams: ['title', 'sections'],
  handler: async (p: unknown) => reportGenerate(p as { title: string; sections: Array<{ heading: string; content: string; data?: Array<{ label: string; value: number }> }>; author?: string; format?: 'html' | 'markdown' }),
  tags: ['business', 'report'],
});

registry.register({
  name: 'jira_api',
  description: 'Interact with Jira: create, search, get, update, or transition issues.',
  schema: { action: { type: 'string', description: 'create, search, get, update, transition' }, projectKey: { type: 'string', description: 'Jira project key' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => jiraApi(p as { action: 'create' | 'search' | 'get' | 'update' | 'transition'; domain?: string; projectKey?: string; issueKey?: string; summary?: string; description?: string; issueType?: string; jql?: string; statusId?: string }),
  tags: ['productivity', 'jira', 'issues'],
});

registry.register({
  name: 'seo_analyze',
  description: 'Analyze a webpage for SEO metrics (meta tags, headings, links, etc.).',
  schema: { url: { type: 'string', description: 'URL to analyze' } },
  requiredParams: ['url'],
  handler: async (p: unknown) => seoAnalyze(p as { url: string }),
  tags: ['web', 'seo', 'analysis'],
});

registry.register({
  name: 'xml_parse',
  description: 'Parse XML and optionally extract data via XPath or convert to JSON.',
  schema: { xml: { type: 'string', description: 'XML content' }, action: { type: 'string', description: 'parse, to_json, or extract (default parse)' } },
  requiredParams: ['xml'],
  handler: async (p: unknown) => xmlParse(p as { xml: string; xpath?: string; action?: 'parse' | 'to_json' | 'extract' }),
  tags: ['data', 'xml'],
});

registry.register({
  name: 'network_diagnose',
  description: 'Diagnose network issues: ping, port check, headers, or full analysis.',
  schema: { target: { type: 'string', description: 'Hostname or IP to diagnose' }, action: { type: 'string', description: 'ping, port_check, headers, full (default full)' } },
  requiredParams: ['target'],
  handler: async (p: unknown) => networkDiagnose(p as { target: string; action?: 'ping' | 'port_check' | 'headers' | 'full' }),
  tags: ['network', 'diagnostics'],
});

registry.register({
  name: 'text_summarize',
  description: 'Summarize text into bullets, paragraph, or TL;DR format.',
  schema: { text: { type: 'string', description: 'Text to summarize' }, style: { type: 'string', description: 'bullets, paragraph, tldr (default paragraph)' } },
  requiredParams: ['text'],
  handler: async (p: unknown) => textSummarize(p as { text: string; maxLength?: number; style?: 'bullets' | 'paragraph' | 'tldr' }),
  tags: ['ai', 'text', 'summary'],
});

registry.register({
  name: 'entity_extract',
  description: 'Extract named entities (people, orgs, dates, locations) from text.',
  schema: { text: { type: 'string', description: 'Text to extract entities from' } },
  requiredParams: ['text'],
  handler: async (p: unknown) => entityExtract(p as { text: string }),
  tags: ['ai', 'text', 'ner'],
});

registry.register({
  name: 'accessibility_check',
  description: 'Check a webpage for accessibility issues (WCAG compliance).',
  schema: { url: { type: 'string', description: 'URL to check' } },
  requiredParams: ['url'],
  handler: async (p: unknown) => accessibilityCheck(p as { url: string }),
  tags: ['web', 'accessibility', 'a11y'],
});

registry.register({
  name: 'budget_tracker',
  description: 'Track budget: add expenses, get summary, or set limits.',
  schema: { action: { type: 'string', description: 'add, summary, limits' }, amount: { type: 'number', description: 'Amount (for add)' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => budgetTracker(p as { action: 'add' | 'summary' | 'forecast'; entries?: Array<{ description: string; amount: number; type: 'income' | 'expense'; category: string; date?: string }>; months?: number }),
  tags: ['finance', 'budget'],
});

registry.register({
  name: 'image_edit',
  description: 'Edit an image: resize, crop, rotate, filter, or add text overlay.',
  schema: { image: { type: 'string', description: 'Image URL or base64' }, action: { type: 'string', description: 'resize, crop, rotate, filter, overlay' } },
  requiredParams: ['image', 'action'],
  handler: async (p: unknown) => imageEdit(p as { action: 'resize' | 'crop' | 'rotate' | 'watermark' | 'convert' | 'info'; url: string; width?: number; height?: number; angle?: number; text?: string; format?: string }),
  tags: ['image', 'edit'],
});

registry.register({
  name: 'document_template',
  description: 'Generate a document from a template with variable substitution.',
  schema: { template: { type: 'string', description: 'Template content with {{variables}}' }, variables: { type: 'string', description: 'JSON object of variable values' } },
  requiredParams: ['template'],
  handler: async (p: unknown) => documentTemplate(p as { template: string; variables: Record<string, string>; format?: 'html' | 'markdown' }),
  tags: ['document', 'template'],
});

registry.register({
  name: 'slide_create',
  description: 'Create a presentation (slides) from an array of slide objects.',
  schema: { slides: { type: 'string', description: 'Array of slide objects' }, theme: { type: 'string', description: 'Theme name (optional)' } },
  requiredParams: ['slides'],
  handler: async (p: unknown) => slideCreate(p as { slides: Array<{ title: string; bullets?: string[]; notes?: string; image?: string }>; theme?: string; title?: string }),
  tags: ['document', 'presentation', 'slides'],
});

registry.register({
  name: 'gcs_operations',
  description: 'Upload, download, list, or delete files on Google Cloud Storage.',
  schema: { action: { type: 'string', description: 'upload, download, list, delete' }, bucket: { type: 'string', description: 'GCS bucket name' } },
  requiredParams: ['action', 'bucket'],
  handler: async (p: unknown) => gcsOperations(p as { action: 'upload' | 'download' | 'list' | 'delete'; bucket: string; object?: string; content?: string; prefix?: string }),
  tags: ['cloud', 'gcp', 'storage'],
});

registry.register({
  name: 'dropbox_sync',
  description: 'Sync files with Dropbox: upload, download, list, or share.',
  schema: { action: { type: 'string', description: 'upload, download, list, share' }, path: { type: 'string', description: 'Dropbox path' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => dropboxSync(p as { action: 'list' | 'upload' | 'download' | 'search'; path?: string; content?: string; query?: string }),
  tags: ['cloud', 'dropbox', 'storage'],
});

registry.register({
  name: 'trello_api',
  description: 'Interact with Trello: list boards, list cards, create or move cards.',
  schema: { action: { type: 'string', description: 'list_boards, list_cards, create_card, move_card' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => trelloApi(p as { action: 'list_boards' | 'list_cards' | 'create_card' | 'move_card'; boardId?: string; listId?: string; cardId?: string; name?: string; description?: string }),
  tags: ['productivity', 'trello'],
});

registry.register({
  name: 'asana_api',
  description: 'Interact with Asana: list projects, create tasks, update tasks.',
  schema: { action: { type: 'string', description: 'list_projects, create_task, update_task, list_tasks' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => asanaApi(p as { action: 'list_tasks' | 'create_task' | 'update_task' | 'search'; projectId?: string; taskId?: string; name?: string; notes?: string; query?: string; workspaceId?: string }),
  tags: ['productivity', 'asana'],
});

registry.register({
  name: 'sitemap_crawl',
  description: 'Crawl a sitemap.xml and return all URLs.',
  schema: { url: { type: 'string', description: 'Website URL or sitemap URL' }, limit: { type: 'number', description: 'Max URLs (default 50)' } },
  requiredParams: ['url'],
  handler: async (p: unknown) => sitemapCrawl(p as { url: string; limit?: number }),
  tags: ['web', 'sitemap', 'crawl'],
});

registry.register({
  name: 'json_schema_validate',
  description: 'Validate data against a JSON Schema.',
  schema: { data: { type: 'string', description: 'Data to validate' }, schema: { type: 'string', description: 'JSON Schema object' } },
  requiredParams: ['data', 'schema'],
  handler: async (p: unknown) => jsonSchemaValidate(p as { data: unknown; schema: Record<string, unknown> }),
  tags: ['data', 'json', 'validation'],
});

registry.register({
  name: 'yaml_convert',
  description: 'Convert between YAML, JSON, and TOML formats.',
  schema: { input: { type: 'string', description: 'Input content' }, from: { type: 'string', description: 'yaml, json, or toml' }, to: { type: 'string', description: 'yaml, json, or toml' } },
  requiredParams: ['input', 'from', 'to'],
  handler: async (p: unknown) => yamlConvert(p as { input: string; from: 'yaml' | 'json' | 'toml'; to: 'yaml' | 'json' | 'toml' }),
  tags: ['data', 'yaml', 'convert'],
});

registry.register({
  name: 'discord_message',
  description: 'Send a message to a Discord channel via webhook.',
  schema: { webhookUrl: { type: 'string', description: 'Discord webhook URL' }, content: { type: 'string', description: 'Message content' } },
  requiredParams: ['webhookUrl', 'content'],
  handler: async (p: unknown) => discordMessage(p as { action: 'send' | 'edit' | 'delete' | 'list_channels'; channelId?: string; messageId?: string; content?: string; guildId?: string }),
  tags: ['communication', 'discord'],
});

registry.register({
  name: 'whatsapp_message',
  description: 'Send a WhatsApp message via WhatsApp Business API.',
  schema: { to: { type: 'string', description: 'Phone number' }, message: { type: 'string', description: 'Message text' } },
  requiredParams: ['to', 'message'],
  handler: async (p: unknown) => whatsappMessage(p as { to: string; message: string; type?: 'text' | 'template' | 'image'; imageUrl?: string; templateName?: string }),
  tags: ['communication', 'whatsapp'],
});

registry.register({
  name: 'push_notification',
  description: 'Send a push notification via Firebase or Expo.',
  schema: { token: { type: 'string', description: 'Device token' }, title: { type: 'string', description: 'Notification title' }, body: { type: 'string', description: 'Notification body' } },
  requiredParams: ['token', 'title', 'body'],
  handler: async (p: unknown) => pushNotification(p as { token: string; title: string; body: string; data?: Record<string, string>; provider?: 'firebase' | 'expo' }),
  tags: ['communication', 'push', 'notification'],
});

registry.register({
  name: 'embeddings_generate',
  description: 'Generate vector embeddings for text using an embedding model.',
  schema: { text: { type: 'string', description: 'Text to embed' }, model: { type: 'string', description: 'Embedding model (optional)' } },
  requiredParams: ['text'],
  handler: async (p: unknown) => embeddingsGenerate(p as { texts: string[]; model?: string }),
  tags: ['ai', 'embeddings', 'vector'],
});

registry.register({
  name: 'log_search',
  description: 'Search log files for a query with optional level and time filter.',
  schema: { query: { type: 'string', description: 'Search query' }, path: { type: 'string', description: 'Log directory (default /var/log)' } },
  requiredParams: ['query'],
  handler: async (p: unknown) => logSearch(p as { query: string; path?: string; level?: string; limit?: number; since?: string }),
  tags: ['system', 'logs', 'search'],
});

registry.register({
  name: 'database_backup',
  description: 'Create or restore a database backup.',
  schema: { action: { type: 'string', description: 'create or restore' }, path: { type: 'string', description: 'Backup file path' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => databaseBackup(p as { action: 'backup' | 'list' | 'info'; database?: string; outputPath?: string }),
  tags: ['database', 'backup'],
});

registry.register({
  name: 'cron_manage',
  description: 'Manage cron jobs: list, create, delete, or update.',
  schema: { action: { type: 'string', description: 'list, create, delete, update' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => cronManage(p as { action: 'list' | 'create' | 'delete' | 'toggle'; name?: string; schedule?: string; command?: string; jobId?: string; enabled?: boolean }),
  tags: ['system', 'cron', 'scheduling'],
});

registry.register({
  name: 'process_manager',
  description: 'Manage system processes: list, info, or find by name.',
  schema: { action: { type: 'string', description: 'list, info, find' }, name: { type: 'string', description: 'Process name (for find)' } },
  requiredParams: ['action'],
  handler: async (p: unknown) => processManager(p as { action: 'list' | 'info' | 'find'; name?: string; pid?: number }),
  tags: ['system', 'process'],
});

registry.register({
  name: 'contract_draft',
  description: 'Generate a legal contract draft from parameters.',
  schema: { type: { type: 'string', description: 'Contract type (NDA, MSA, SOW, etc.)' }, parties: { type: 'string', description: 'Array of party names' } },
  requiredParams: ['type'],
  handler: async (p: unknown) => contractDraft(p as { type: 'nda' | 'freelance' | 'saas' | 'employment' | 'custom'; parties: { partyA: string; partyB: string }; terms?: Record<string, string>; customClauses?: string[] }),
  tags: ['legal', 'contract'],
});

// === Desktop Agent Tools === (additive — registered if bridge is enabled)
if (cfg.DESKTOP_BRIDGE_ENABLED) {
  registerDesktopTools(registry);
}

log.info({ toolCount: registry.size() }, 'all tools registered in ToolRegistry');

async function executeTool(name: string, params: unknown): Promise<ToolResult> {
  return registry.execute(name, params);
}

const agentExecuteSchema = z.object({
  runId: z.string().uuid(),
  agentId: z.string(),
  prompt: z.string().min(1).max(1_000_000),
  workspaceId: z.string().uuid().optional(),
  apiKeyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
}).passthrough();

const toolExecuteSchema = z.object({
  toolName: z.string().min(1).max(200),
  input: z.unknown(),
  workspaceId: z.string().uuid().optional(),
  apiKeyId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
}).passthrough();

const memoryIndexSchema = z.object({
  sourceId: z.string().uuid(),
  content: z.string().min(1).max(10_000_000),
  workspaceId: z.string().uuid().optional(),
}).passthrough();

const memoryRetrieveSchema = z.object({
  query: z.string().min(1).max(10_000),
  workspaceId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
}).passthrough();

const sandboxExecSchema = z.object({
  sandboxId: z.string().uuid(),
  command: z.string().min(1).max(10_000),
  args: z.array(z.string()).max(256).optional(),
  workspaceId: z.string().uuid().optional(),
}).passthrough();

const monitoringCheckSchema = z.object({
  target: z.string().min(1).max(2000),
  checkType: z.enum(['http', 'tcp', 'ping', 'custom']),
}).passthrough();

const auditWriteSchema = z.object({
  actorId: z.string().uuid().nullable(),
  action: z.string().min(1).max(200),
  resource: z.string().max(200).nullable().optional(),
  resourceId: z.string().max(200).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).passthrough();

const webhookDeliverSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']).default('POST'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  workspaceId: z.string().uuid().optional(),
}).passthrough();

const swarmExecuteSchema = z.object({
  taskId: z.string().uuid(),
  description: z.string().min(1).max(500),
  prompt: z.string().min(1).max(10_000),
  agents: z.array(z.object({
    id: z.string(),
    role: z.string(),
    name: z.string(),
    description: z.string(),
    systemPrompt: z.string().optional(),
    allowedTools: z.array(z.string()).optional(),
    maxSteps: z.number().int().optional(),
    priority: z.number().int().optional(),
  })).min(1).max(10),
  userId: z.string(),
  workspaceId: z.string().uuid().optional(),
  apiKeyId: z.string().uuid().optional(),
}).passthrough();

const SCHEMAS: Array<[QueueName, z.ZodType<unknown>]> = [
  [QUEUE_NAMES.AGENT_EXECUTE, agentExecuteSchema],
  [QUEUE_NAMES.TOOL_EXECUTE, toolExecuteSchema],
  [QUEUE_NAMES.MEMORY_INDEX, memoryIndexSchema],
  [QUEUE_NAMES.MEMORY_RETRIEVE, memoryRetrieveSchema],
  [QUEUE_NAMES.SANDBOX_EXEC, sandboxExecSchema],
  [QUEUE_NAMES.MONITORING_CHECK, monitoringCheckSchema],
  [QUEUE_NAMES.AUDIT_WRITE, auditWriteSchema],
  [QUEUE_NAMES.WEBHOOK_DELIVER, webhookDeliverSchema],
  [QUEUE_NAMES.SWARM_EXECUTE, swarmExecuteSchema],
];

export function registerAllQueueSchemas(): void {
  for (const [q, s] of SCHEMAS) {
    registerJobSchema(q, s);
  }
  log.info({ queues: SCHEMAS.map(([q]) => q) }, 'queue schemas registered');
}

// Processor implementations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const processors: Record<QueueName, (job: any) => Promise<any>> = {
  [QUEUE_NAMES.AGENT_EXECUTE]: async (job) => {
    const { prompt, runId, agentId, workspaceId, userId, apiKeyId, maxSteps, tokenBudget, forbiddenTools } = job.data;
    log.info({ jobId: job.id, runId, agentId, prompt: prompt?.substring(0, 100) }, 'executing agent');

    const memory = await getGlobalMemoryClient();

    // Load user context before creating runner
    let userCtxFacts: Record<string, string> = {};
    const ownerId = userId ?? agentId ?? 'default';
    try {
      userCtxFacts = await userContext.getAll(ownerId);
      if (Object.keys(userCtxFacts).length > 0) {
        log.info({ runId, ownerId, facts: Object.keys(userCtxFacts).length }, 'user context loaded for agent');
      }
    } catch (err) {
      log.warn({ err, runId }, 'failed to load user context for agent');
    }

    const runner = createRunner({
      runId,
      agentId: agentId ?? 'default-agent',
      executeTool: (name, params) => executeTool(name, params),
      memory,
      userContextItems: Object.keys(userCtxFacts).length > 0 ? userCtxFacts : undefined,
    });

    const result = await runner.run({
      runId,
      agentId: agentId ?? 'default-agent',
      prompt: prompt ?? '',
      userId,
      workspaceId,
      apiKeyId,
      maxSteps,
      tokenBudget,
      forbiddenTools,
    });

    return {
      runId: result.id,
      status: result.status,
      finalAnswer: result.finalAnswer,
      steps: result.steps.length,
      tokensUsed: result.tokensUsed,
    };
  },
  [QUEUE_NAMES.TOOL_EXECUTE]: async (job) => {
    const { toolName, input } = job.data;
    log.info({ jobId: job.id, toolName }, 'tool:execute');
    const result = await executeTool(toolName, input);
    return result;
  },
  [QUEUE_NAMES.MEMORY_INDEX]: async (job) => {
    const { sourceId, content, workspaceId } = job.data;
    log.info({ jobId: job.id, sourceId, contentLength: content?.length, workspaceId }, 'indexing memory');
    const memory = await getGlobalMemoryClient();
    try {
      const collection = workspaceId ? `ws:${workspaceId}` : 'default';
      await memory.upsert(collection, [
        { id: sourceId, content, metadata: { workspaceId, indexedAt: new Date().toISOString() }, timestamp: new Date() },
      ]);
      return { indexed: true, sourceId, collection };
    } catch (err) {
      log.error({ err, sourceId }, 'memory indexing failed');
      throw err;
    }
  },
  [QUEUE_NAMES.MEMORY_RETRIEVE]: async (job) => {
    const { query, limit, workspaceId } = job.data;
    log.info({ jobId: job.id, query, limit }, 'retrieving memory');
    const memory = await getGlobalMemoryClient();
    try {
      const collection = workspaceId ? `ws:${workspaceId}` : 'default';
      const results = await memory.search(collection, query, { limit: limit ?? 10 });
      return { results, query };
    } catch (err) {
      log.error({ err, query }, 'memory retrieval failed');
      throw err;
    }
  },
  [QUEUE_NAMES.SANDBOX_EXEC]: async (job) => {
    const { sandboxId, command, args } = job.data;
    log.info({ jobId: job.id, sandboxId, command, args }, 'executing in sandbox');
    const { SandboxPool } = await import('@titan/sandbox');
    const pool = new SandboxPool();
    await pool.initialize();
    try {
      const fullCommand = args && args.length > 0 ? `${command} ${args.join(' ')}` : command;
      const result = await pool.execute(fullCommand);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        sandboxId,
        durationMs: result.durationMs,
        oomKilled: result.oomKilled,
      };
    } finally {
      await pool.shutdown();
    }
  },
  [QUEUE_NAMES.MONITORING_CHECK]: async (job) => {
    const { target, checkType } = job.data;
    log.info({ jobId: job.id, target, checkType }, 'running monitoring check');
    const start = Date.now();
    try {
      if (checkType === 'http') {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
          const res = await fetch(target, { method: 'GET', signal: controller.signal });
          clearTimeout(timer);
          return { status: res.ok ? 'ok' : 'degraded', target, checkType, statusCode: res.status, latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
        } catch (err) {
          clearTimeout(timer);
          return { status: 'down', target, checkType, error: (err as Error).message, latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
        }
      } else if (checkType === 'tcp') {
        const net = await import('node:net');
        const [host, portStr] = target.split(':');
        const port = parseInt(portStr ?? '80', 10);
        return new Promise((resolve) => {
          const socket = net.createConnection({ host, port, timeout: 10_000 });
          socket.on('connect', () => { socket.destroy(); resolve({ status: 'ok', target, checkType, latencyMs: Date.now() - start, timestamp: new Date().toISOString() }); });
          socket.on('error', (err) => { socket.destroy(); resolve({ status: 'down', target, checkType, error: err.message, latencyMs: Date.now() - start, timestamp: new Date().toISOString() }); });
          socket.on('timeout', () => { socket.destroy(); resolve({ status: 'down', target, checkType, error: 'Connection timeout', latencyMs: Date.now() - start, timestamp: new Date().toISOString() }); });
        });
      } else if (checkType === 'ping') {
        // Use execute_bash for ping
        const result = await executeBash({ command: process.platform === 'win32' ? `ping -n 1 -w 5000 ${target}` : `ping -c 1 -W 5 ${target}`, timeoutMs: 10_000 });
        return { status: result.exitCode === 0 ? 'ok' : 'down', target, checkType, latencyMs: Date.now() - start, output: result.stdout.slice(0, 500), timestamp: new Date().toISOString() };
      }
      return { status: 'ok', target, checkType, latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
    } catch (err) {
      return { status: 'down', target, checkType, error: (err as Error).message, latencyMs: Date.now() - start, timestamp: new Date().toISOString() };
    }
  },
  [QUEUE_NAMES.AUDIT_WRITE]: async (job) => {
    const { actorId, action, resource, resourceId, metadata } = job.data;
    log.info({ jobId: job.id, actorId, action }, 'writing audit log');
    const { query } = await import('@titan/database');
    try {
      await query(
        `INSERT INTO audit_log (actor_id, action, resource, resource_id, metadata) VALUES ($1, $2, $3, $4, $5)`,
        [actorId, action, resource ?? null, resourceId ?? null, metadata ? JSON.stringify(metadata) : null],
      );
      return { written: true, actorId, action };
    } catch (err) {
      log.error({ err, actorId, action }, 'audit write failed');
      throw err;
    }
  },
  [QUEUE_NAMES.SWARM_EXECUTE]: async (job) => {
    const { taskId, description, prompt, agents, userId, workspaceId, apiKeyId } = job.data;
    log.info({ jobId: job.id, taskId, agentsCount: agents.length }, 'swarm:execute');

    const provider = createProviderFromEnv();
    if (!provider) throw new Error('LLM provider not configured for swarm execution');
    const registry = getGlobalToolRegistry();

    const deps = {
      createAgentRun: async (runInput: AgentRunInput): Promise<AgentRun> => {
        const dbRun = await agentRuns.create({
          agentId: runInput.agentId,
          prompt: runInput.prompt,
          userId: runInput.userId ?? userId,
          workspaceId,
          apiKeyId,
          maxSteps: runInput.maxSteps ?? 10,
        });
        const memory = await getGlobalMemoryClient();
        const runner = createRunner({
          runId: dbRun.id,
          agentId: runInput.agentId,
          executeTool: (name, params) => registry.execute(name, params),
          memory,
          llm: provider,
          broadcastWs: false,
        });
        return runner.run({ runId: dbRun.id, agentId: runInput.agentId, prompt: runInput.prompt, userId: runInput.userId ?? userId, workspaceId, maxSteps: runInput.maxSteps ?? 10 });
      },
      getAgentRun: async (runId: string): Promise<AgentRun | null> => {
        const run = await agentRuns.findById(runId);
        if (!run) return null;
        return { id: run.id, agentId: run.agentId, prompt: run.prompt, status: run.status as AgentRun['status'], maxSteps: run.maxSteps, currentStep: run.currentStep, tokensUsed: run.tokensUsed, forbiddenTools: undefined, steps: [], createdAt: run.createdAt, updatedAt: run.updatedAt };
      },
    };

    const orchestrator = new SwarmOrchestrator(deps);
    const task = await orchestrator.createTask({ description, prompt, agents: agents.map((a: Record<string, unknown>) => ({ ...a, maxSteps: (a.maxSteps as number) ?? 10, priority: (a.priority as number) ?? 0 })) });
    storeSwarmTask(task);

    try {
      await orchestrator.plan(task, provider as { complete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }> });
      storeSwarmTask(task);
      await orchestrator.execute(task);
      storeSwarmTask(task);
      const result = await orchestrator.synthesize(task, provider as { complete: (messages: Array<{ role: string; content: string }>) => Promise<{ content: string }> });
      storeSwarmTask(task);
      return { taskId: result.taskId, status: result.status, finalAnswer: result.finalAnswer, subTasks: result.subTaskResults, completedAt: result.completedAt.toISOString() };
    } catch (err) {
      task.status = 'failed';
      storeSwarmTask(task);
      throw err;
    }
  },
  [QUEUE_NAMES.WEBHOOK_DELIVER]: async (job) => {
    const { url, method, headers, body } = job.data;
    log.info({ jobId: job.id, url, method }, 'delivering webhook');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 30_000);
    try {
      const res = await fetch(url, {
        method: method ?? 'POST',
        headers: { 'Content-Type': 'application/json', ...(headers ?? {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      clearTimeout(timer);
      const responseText = await res.text().catch(() => '');
      if (!res.ok) {
        log.warn({ url, statusCode: res.status, responseText: responseText.slice(0, 500) }, 'webhook delivery got non-2xx response');
      }
      return { delivered: res.ok, url, method: method ?? 'POST', statusCode: res.status, responseBody: responseText.slice(0, 1000) };
    } catch (err) {
      clearTimeout(timer);
      log.error({ err, url }, 'webhook delivery failed');
      throw err;
    }
  },
};

const workers: TitanWorker[] = [];

export function registerAllWorkers(): void {
  for (const [q] of SCHEMAS) {
    const processor = processors[q];
    const w = createWorker({
      queueName: q,
      processor,
      enableValidation: true,
      enableDLQ: true,
    });
    workers.push(w);
  }
  log.info({ workers: workers.length }, 'queue workers instantiated');
}

export async function closeAllWorkers(): Promise<void> {
  for (const w of workers) {
    try { await w.close(); } catch (err) { log.error({ err }, 'worker close failed'); }
  }
  workers.length = 0;
}

// Self-executing entry point for worker container
if (import.meta.url === `file://${process.argv[1]}`) {
  registerAllWorkers();
  startBackgroundScheduler();

  const gracefulShutdown = async (signal: string) => {
    log.info({ signal }, 'worker shutting down gracefully');
    stopBackgroundScheduler();
    await closeAllWorkers();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  log.info('titan worker started');
}