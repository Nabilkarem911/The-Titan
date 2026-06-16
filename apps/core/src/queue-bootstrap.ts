import { z } from 'zod';
import { getLogger } from '@titan/logging';
import { QUEUE_NAMES, type QueueName } from '@titan/shared';
import {
  registerJobSchema,
  type TitanWorker,
  createWorker,
} from '@titan/queue';
import { AgentRunner, MockLlmProvider, createProviderFromEnv, getGlobalToolRegistry, type ToolCall, type ToolResult, type AgentRun, type AgentStep } from '@titan/agent-engine';
import { MemoryClient } from '@titan/memory';
import { agentRuns, agentSteps, userSecrets, userContext } from '@titan/database';
import { executeBash, patchFile, readFileAst, firecrawlScrape, httpRequest, writeFile, readFileRaw, braveSearch, braveAnswers, githubApi, dockerOrchestrate, sendEmail, parseCsvJson, zipUnzip, pdfRead, databaseQuery, telegramSendFile, excelRead, qrGenerate, hashCrypto, randomToken, base64Tool, uuidGenerate, jsonValidate, textDiff, markdownToHtml, weatherGet, currencyConvert, htmlToText, screenshotUrl, youtubeSearch, mapsGeocode, translateText, urlShorten, calculate, timezoneConvert, regexTest, jwtDecode, ipLookup, dnsLookup, textStats, passwordGenerate, colorConvert, fileWatch, manageAgentProfile } from '@titan/tools';
import { loadConfig } from '@titan/config';
import { getWsServer } from './ws-instance.js';

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
    const { ownerId, key, value } = params as { ownerId: string; key: string; value: string };
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

const SCHEMAS: Array<[QueueName, z.ZodType<unknown>]> = [
  [QUEUE_NAMES.AGENT_EXECUTE, agentExecuteSchema],
  [QUEUE_NAMES.TOOL_EXECUTE, toolExecuteSchema],
  [QUEUE_NAMES.MEMORY_INDEX, memoryIndexSchema],
  [QUEUE_NAMES.MEMORY_RETRIEVE, memoryRetrieveSchema],
  [QUEUE_NAMES.SANDBOX_EXEC, sandboxExecSchema],
  [QUEUE_NAMES.MONITORING_CHECK, monitoringCheckSchema],
  [QUEUE_NAMES.AUDIT_WRITE, auditWriteSchema],
  [QUEUE_NAMES.WEBHOOK_DELIVER, webhookDeliverSchema],
];

export function registerAllQueueSchemas(): void {
  for (const [q, s] of SCHEMAS) {
    registerJobSchema(q, s);
  }
  log.info({ queues: SCHEMAS.map(([q]) => q) }, 'queue schemas registered');
}

// Processor implementations
const processors: Record<QueueName, (job: any) => Promise<any>> = {
  [QUEUE_NAMES.AGENT_EXECUTE]: async (job) => {
    const { prompt, runId, agentId, workspaceId, userId, apiKeyId, maxSteps, tokenBudget, forbiddenTools } = job.data;
    log.info({ jobId: job.id, runId, agentId, prompt: prompt?.substring(0, 100) }, 'executing agent');

    const memory = new MemoryClient();
    await memory.initialize();

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

    const runner = new AgentRunner({
      llm: createProviderFromEnv() ?? new MockLlmProvider(),
      executeTool: async (call: ToolCall, _runId: string): Promise<ToolResult> => {
        try {
          const data = await executeTool(call.name, call.params);
          return { success: true, data };
        } catch (err) {
          return { success: false, error: err instanceof Error ? err.message : 'Tool execution failed' };
        }
      },
      memory,
      userContextItems: Object.keys(userCtxFacts).length > 0 ? userCtxFacts : undefined,
      persistRun: async (run: AgentRun) => {
        try {
          await agentRuns.updateStatus(runId, run.status, {
            currentStep: run.currentStep,
            tokensUsed: run.tokensUsed,
            finalAnswer: run.finalAnswer ?? undefined,
          });
        } catch (err) {
          log.warn({ err, runId }, 'failed to persist run status');
        }
        getWsServer()?.broadcast('agent.run.updated', {
          runId,
          agentId,
          status: run.status,
          currentStep: run.currentStep,
          tokensUsed: run.tokensUsed,
          finalAnswer: run.finalAnswer ?? null,
        });
      },
      onStep: async (step: AgentStep) => {
        try {
          await agentSteps.create({
            runId,
            stepIndex: step.index,
            status: step.status,
            thought: step.thought,
            actionName: step.action?.name,
            actionParams: step.action?.params,
            observationSuccess: step.observation?.success,
            observationData: step.observation?.data as Record<string, unknown> | undefined,
            observationError: step.observation?.error,
            reflection: step.reflection,
            tokensUsed: step.tokensUsed,
            latencyMs: step.latencyMs,
          });
        } catch (err) {
          log.warn({ err, runId }, 'failed to persist step');
        }
        getWsServer()?.broadcast('agent.step', {
          runId,
          agentId,
          step: {
            index: step.index,
            status: step.status,
            thought: step.thought,
            actionName: step.action?.name,
            actionParams: step.action?.params,
            observationSuccess: step.observation?.success,
            observationData: step.observation?.data,
            observationError: step.observation?.error,
            reflection: step.reflection,
            tokensUsed: step.tokensUsed,
            latencyMs: step.latencyMs,
          },
        });
      },
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
    // Mock: just acknowledge
    return { indexed: true, sourceId };
  },
  [QUEUE_NAMES.MEMORY_RETRIEVE]: async (job) => {
    const { query, limit } = job.data;
    log.info({ jobId: job.id, query, limit }, 'retrieving memory');
    // Mock: return empty results
    return { results: [], query };
  },
  [QUEUE_NAMES.SANDBOX_EXEC]: async (job) => {
    const { sandboxId, command, args } = job.data;
    log.info({ jobId: job.id, sandboxId, command, args }, 'executing in sandbox');
    // Mock: return fake output
    return {
      stdout: `mock output for command: ${command}`,
      stderr: '',
      exitCode: 0,
      sandboxId,
    };
  },
  [QUEUE_NAMES.MONITORING_CHECK]: async (job) => {
    const { target, checkType } = job.data;
    log.info({ jobId: job.id, target, checkType }, 'running monitoring check');
    // Mock: always healthy
    return { status: 'ok', target, checkType, timestamp: new Date().toISOString() };
  },
  [QUEUE_NAMES.AUDIT_WRITE]: async (job) => {
    const { actorId, action } = job.data;
    log.info({ jobId: job.id, actorId, action }, 'writing audit log');
    // We could write to audit here, but we already have audit.writeChained in auth routes.
    // For now, just acknowledge.
    return { written: true, actorId, action };
  },
  [QUEUE_NAMES.WEBHOOK_DELIVER]: async (job) => {
    const { url, method } = job.data;
    log.info({ jobId: job.id, url, method }, 'delivering webhook');
    // Mock: just log
    return { delivered: true, url, method, statusCode: 200 };
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

  const gracefulShutdown = async (signal: string) => {
    log.info({ signal }, 'worker shutting down gracefully');
    await closeAllWorkers();
    process.exit(0);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  log.info('titan worker started');
}