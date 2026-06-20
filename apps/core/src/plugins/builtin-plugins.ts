import { createHash } from 'node:crypto';

export interface BuiltinPlugin {
  key: string;
  name: string;
  description: string;
  author: string;
  version: string;
  tags: string[];
  category: string;
  code: string;
  tools: Array<{
    name: string;
    description: string;
    schema?: Record<string, { type: string; description?: string }>;
    requiredParams?: string[];
  }>;
}

export const BUILTIN_PLUGINS: BuiltinPlugin[] = [
  {
    key: 'web-fetch',
    name: 'web-fetch',
    description: 'Fetch and parse web content from any URL. Useful for reading articles, APIs, and documentation.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['web', 'http', 'fetch'],
    category: 'Web',
    tools: [
      {
        name: 'fetch_url',
        description: 'Fetch content from a URL and return the response text. Supports JSON and text responses.',
        schema: {
          url: { type: 'string', description: 'The URL to fetch' },
          method: { type: 'string', description: 'HTTP method (GET, POST, etc.)' },
          headers: { type: 'object', description: 'HTTP headers as key-value pairs' },
          body: { type: 'string', description: 'Request body for POST/PUT requests' },
        },
        requiredParams: ['url'],
      },
    ],
    code: `module.exports = {
  fetch_url: async function(params) {
    const { url, method, headers, body } = params;
    const opts = { method: method || 'GET' };
    if (headers) opts.headers = headers;
    if (body) opts.body = body;
    const res = await fetch(url, opts);
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { status: res.status, ok: res.ok, data: parsed };
  }
};`,
  },
  {
    key: 'currency-converter',
    name: 'currency-converter',
    description: 'Convert amounts between different currencies using real-time exchange rates.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['finance', 'currency', 'conversion'],
    category: 'Finance',
    tools: [
      {
        name: 'convert_currency',
        description: 'Convert an amount from one currency to another using current exchange rates.',
        schema: {
          from: { type: 'string', description: 'Source currency code (e.g. USD)' },
          to: { type: 'string', description: 'Target currency code (e.g. EUR)' },
          amount: { type: 'number', description: 'Amount to convert' },
        },
        requiredParams: ['from', 'to', 'amount'],
      },
      {
        name: 'list_currencies',
        description: 'List all supported currency codes.',
      },
    ],
    code: `module.exports = {
  convert_currency: async function(params) {
    const { from, to, amount } = params;
    const res = await fetch('https://open.er-api.com/v6/latest/' + from);
    const data = await res.json();
    if (data.result !== 'success') throw new Error('Failed to fetch rates');
    const rate = data.rates[to];
    if (!rate) throw new Error('Currency ' + to + ' not found');
    return { from, to, amount, converted: amount * rate, rate, updated: data.time_last_update_utc };
  },
  list_currencies: async function() {
    const res = await fetch('https://open.er-api.com/v6/currencies');
    const data = await res.json();
    return { currencies: Object.keys(data.currencies || {}) };
  }
};`,
  },
  {
    key: 'weather',
    name: 'weather',
    description: 'Get current weather information for any city using Open-Meteo API (no API key required).',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['weather', 'environment'],
    category: 'Utilities',
    tools: [
      {
        name: 'get_weather',
        description: 'Get current weather for a city including temperature, wind, and humidity.',
        schema: {
          city: { type: 'string', description: 'City name (e.g. Cairo, London)' },
        },
        requiredParams: ['city'],
      },
    ],
    code: `module.exports = {
  get_weather: async function(params) {
    const { city } = params;
    const geoRes = await fetch('https://geocoding-api.open-meteo.com/v1/search?name=' + encodeURIComponent(city) + '&count=1');
    const geo = await geoRes.json();
    if (!geo.results || !geo.results[0]) throw new Error('City not found: ' + city);
    const loc = geo.results[0];
    const weatherRes = await fetch('https://api.open-meteo.com/v1/forecast?latitude=' + loc.latitude + '&longitude=' + loc.longitude + '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code');
    const weather = await weatherRes.json();
    const codes = { 0: 'Clear sky', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 51: 'Light drizzle', 61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 80: 'Rain showers', 95: 'Thunderstorm' };
    return {
      city: loc.name,
      country: loc.country,
      temperature: weather.current.temperature_2m + ' C',
      humidity: weather.current.relative_humidity_2m + '%',
      wind: weather.current.wind_speed_10m + ' km/h',
      condition: codes[weather.current.weather_code] || 'Unknown',
    };
  }
};`,
  },
  {
    key: 'text-tools',
    name: 'text-tools',
    description: 'Text manipulation tools: word count, character count, slugify, truncate, and more.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['text', 'utility', 'string'],
    category: 'Utilities',
    tools: [
      {
        name: 'word_count',
        description: 'Count words, characters, and lines in a text.',
        schema: { text: { type: 'string', description: 'The text to analyze' } },
        requiredParams: ['text'],
      },
      {
        name: 'slugify',
        description: 'Convert text to a URL-friendly slug.',
        schema: { text: { type: 'string', description: 'Text to slugify' } },
        requiredParams: ['text'],
      },
      {
        name: 'truncate',
        description: 'Truncate text to a maximum length with optional suffix.',
        schema: {
          text: { type: 'string', description: 'Text to truncate' },
          length: { type: 'number', description: 'Maximum length' },
          suffix: { type: 'string', description: 'Suffix to append (default: ...)' },
        },
        requiredParams: ['text', 'length'],
      },
    ],
    code: `module.exports = {
  word_count: async function(params) {
    const { text } = params;
    return {
      words: text.trim().split(/\\s+/).filter(Boolean).length,
      characters: text.length,
      charactersNoSpaces: text.replace(/\\s/g, '').length,
      lines: text.split('\\n').length,
    };
  },
  slugify: async function(params) {
    const { text } = params;
    return { slug: text.toLowerCase().trim().replace(/[^\\w\\s-]/g, '').replace(/[\\s_-]+/g, '-').replace(/^-+|-+$/g, '') };
  },
  truncate: async function(params) {
    const { text, length, suffix } = params;
    const s = suffix || '...';
    if (text.length <= length) return { text };
    return { text: text.slice(0, length - s.length) + s };
  }
};`,
  },
  {
    key: 'datetime-tools',
    name: 'datetime-tools',
    description: 'Date and time utilities: current time, timezone conversion, date formatting, and difference calculation.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['date', 'time', 'timezone'],
    category: 'Utilities',
    tools: [
      {
        name: 'current_time',
        description: 'Get current time in a specific timezone.',
        schema: { timezone: { type: 'string', description: 'IANA timezone (e.g. Africa/Cairo, America/New_York)' } },
      },
      {
        name: 'time_difference',
        description: 'Calculate time difference between two dates.',
        schema: {
          from: { type: 'string', description: 'Start date (ISO format)' },
          to: { type: 'string', description: 'End date (ISO format)' },
        },
        requiredParams: ['from', 'to'],
      },
    ],
    code: `module.exports = {
  current_time: async function(params) {
    const tz = params.timezone || 'UTC';
    const now = new Date();
    return {
      timezone: tz,
      time: now.toLocaleString('en-US', { timeZone: tz }),
      iso: now.toISOString(),
      timestamp: now.getTime(),
    };
  },
  time_difference: async function(params) {
    const { from, to } = params;
    const d1 = new Date(from);
    const d2 = new Date(to);
    const diffMs = Math.abs(d2 - d1);
    return {
      milliseconds: diffMs,
      seconds: Math.floor(diffMs / 1000),
      minutes: Math.floor(diffMs / 60000),
      hours: Math.floor(diffMs / 3600000),
      days: Math.floor(diffMs / 86400000),
    };
  }
};`,
  },
  {
    key: 'crypto-tools',
    name: 'crypto-tools',
    description: 'Cryptographic utilities: generate UUIDs, hash strings, encode/decode base64.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['crypto', 'security', 'encoding'],
    category: 'Security',
    tools: [
      {
        name: 'generate_uuid',
        description: 'Generate one or more random UUIDs.',
        schema: { count: { type: 'number', description: 'Number of UUIDs to generate (default: 1)' } },
      },
      {
        name: 'hash_string',
        description: 'Hash a string using SHA-256.',
        schema: { input: { type: 'string', description: 'String to hash' } },
        requiredParams: ['input'],
      },
      {
        name: 'base64_encode',
        description: 'Encode a string to base64.',
        schema: { input: { type: 'string', description: 'String to encode' } },
        requiredParams: ['input'],
      },
      {
        name: 'base64_decode',
        description: 'Decode a base64 string.',
        schema: { input: { type: 'string', description: 'Base64 string to decode' } },
        requiredParams: ['input'],
      },
    ],
    code: `const crypto = require('node:crypto');
module.exports = {
  generate_uuid: async function(params) {
    const count = params.count || 1;
    const uuids = [];
    for (let i = 0; i < count; i++) uuids.push(crypto.randomUUID());
    return { uuids };
  },
  hash_string: async function(params) {
    return { hash: crypto.createHash('sha256').update(params.input).digest('hex') };
  },
  base64_encode: async function(params) {
    return { encoded: Buffer.from(params.input).toString('base64') };
  },
  base64_decode: async function(params) {
    return { decoded: Buffer.from(params.input, 'base64').toString('utf8') };
  }
};`,
  },
  {
    key: 'json-tools',
    name: 'json-tools',
    description: 'JSON utilities: format, minify, validate, and extract keys from JSON.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['json', 'utility', 'data'],
    category: 'Utilities',
    tools: [
      {
        name: 'format_json',
        description: 'Pretty-print a JSON string with indentation.',
        schema: { input: { type: 'string', description: 'JSON string to format' } },
        requiredParams: ['input'],
      },
      {
        name: 'validate_json',
        description: 'Validate if a string is valid JSON and return parsed result or error.',
        schema: { input: { type: 'string', description: 'JSON string to validate' } },
        requiredParams: ['input'],
      },
    ],
    code: `module.exports = {
  format_json: async function(params) {
    const parsed = JSON.parse(params.input);
    return { formatted: JSON.stringify(parsed, null, 2) };
  },
  validate_json: async function(params) {
    try {
      const parsed = JSON.parse(params.input);
      return { valid: true, parsed };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }
};`,
  },
  {
    key: 'math-tools',
    name: 'math-tools',
    description: 'Mathematical utilities: statistics, percentage calculation, and number formatting.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['math', 'statistics', 'calculation'],
    category: 'Math',
    tools: [
      {
        name: 'statistics',
        description: 'Calculate basic statistics (mean, median, min, max, sum) for a list of numbers.',
        schema: { numbers: { type: 'array', description: 'Array of numbers' } },
        requiredParams: ['numbers'],
      },
      {
        name: 'percentage',
        description: 'Calculate percentage of a value relative to a total.',
        schema: {
          value: { type: 'number', description: 'The value' },
          total: { type: 'number', description: 'The total' },
        },
        requiredParams: ['value', 'total'],
      },
    ],
    code: `module.exports = {
  statistics: async function(params) {
    const nums = params.numbers;
    if (!nums || !nums.length) throw new Error('Numbers array is required');
    const sorted = nums.slice().sort(function(a, b) { return a - b; });
    const sum = nums.reduce(function(a, b) { return a + b; }, 0);
    const mean = sum / nums.length;
    const median = sorted.length % 2 === 0
      ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
      : sorted[Math.floor(sorted.length / 2)];
    return { count: nums.length, sum, mean, median, min: sorted[0], max: sorted[sorted.length - 1] };
  },
  percentage: async function(params) {
    const { value, total } = params;
    if (total === 0) throw new Error('Total cannot be zero');
    return { value, total, percentage: (value / total) * 100 };
  }
};`,
  },
];

export function getBuiltinPlugin(key: string): BuiltinPlugin | undefined {
  return BUILTIN_PLUGINS.find((p) => p.key === key);
}

export function computeChecksum(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
