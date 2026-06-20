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

  {
    key: 'qr-generator',
    name: 'qr-generator',
    description: 'Generate QR codes for any text or URL. Returns a QR code image URL.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['qr', 'image', 'generator'],
    category: 'Media',
    tools: [
      {
        name: 'generate_qr',
        description: 'Generate a QR code for text or a URL and return the image URL.',
        schema: {
          data: { type: 'string', description: 'Text or URL to encode in the QR code' },
          size: { type: 'number', description: 'Image size in pixels (default: 200)' },
        },
        requiredParams: ['data'],
      },
    ],
    code: `module.exports = {
  generate_qr: async function(params) {
    const { data, size } = params;
    const s = size || 200;
    const url = 'https://api.qrserver.com/v1/create-qr-code/?size=' + s + 'x' + s + '&data=' + encodeURIComponent(data);
    return { qrUrl: url, data: data, size: s };
  }
};`,
  },
  {
    key: 'url-shortener',
    name: 'url-shortener',
    description: 'Shorten long URLs using is.gd free URL shortener service (no API key required).',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['url', 'web', 'shortener'],
    category: 'Web',
    tools: [
      {
        name: 'shorten_url',
        description: 'Shorten a long URL and return the short version.',
        schema: { url: { type: 'string', description: 'The long URL to shorten' } },
        requiredParams: ['url'],
      },
    ],
    code: `module.exports = {
  shorten_url: async function(params) {
    const { url } = params;
    const res = await fetch('https://is.gd/create.php?format=json&url=' + encodeURIComponent(url));
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return { shortUrl: data.shorturl, originalUrl: url };
  }
};`,
  },
  {
    key: 'ip-lookup',
    name: 'ip-lookup',
    description: 'Look up geolocation and network information for any IP address.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['ip', 'network', 'geo'],
    category: 'Network',
    tools: [
      {
        name: 'lookup_ip',
        description: 'Get geolocation, ISP, and country info for an IP address. Leave empty for your own IP.',
        schema: { ip: { type: 'string', description: 'IP address to look up (optional, defaults to caller IP)' } },
      },
    ],
    code: `module.exports = {
  lookup_ip: async function(params) {
    const ip = params.ip || '';
    const url = ip ? 'http://ip-api.com/json/' + ip : 'http://ip-api.com/json/';
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === 'fail') throw new Error(data.message || 'Lookup failed');
    return {
      ip: data.query,
      country: data.country,
      countryCode: data.countryCode,
      region: data.regionName,
      city: data.city,
      lat: data.lat,
      lon: data.lon,
      timezone: data.timezone,
      isp: data.isp,
      org: data.org,
    };
  }
};`,
  },
  {
    key: 'translator',
    name: 'translator',
    description: 'Translate text between languages using Google Translate (free, no API key needed).',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['translate', 'language', 'i18n'],
    category: 'Language',
    tools: [
      {
        name: 'translate',
        description: 'Translate text from one language to another.',
        schema: {
          text: { type: 'string', description: 'Text to translate' },
          from: { type: 'string', description: 'Source language code (e.g. en, ar, fr). Use "auto" for auto-detect.' },
          to: { type: 'string', description: 'Target language code (e.g. en, ar, fr)' },
        },
        requiredParams: ['text', 'to'],
      },
    ],
    code: `module.exports = {
  translate: async function(params) {
    const { text, from, to } = params;
    const src = from || 'auto';
    const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + src + '&tl=' + to + '&dt=t&q=' + encodeURIComponent(text);
    const res = await fetch(url);
    const data = await res.json();
    const translated = (data[0] || []).map(function(t) { return t[0] || ''; }).join('');
    const detected = data[2] || src;
    return { translated: translated, from: detected, to: to, original: text };
  }
};`,
  },
  {
    key: 'rss-reader',
    name: 'rss-reader',
    description: 'Parse RSS/Atom feeds and return feed title and recent items.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['rss', 'feed', 'news'],
    category: 'Web',
    tools: [
      {
        name: 'read_feed',
        description: 'Fetch and parse an RSS/Atom feed URL, returning title and recent items.',
        schema: {
          url: { type: 'string', description: 'RSS/Atom feed URL' },
          limit: { type: 'number', description: 'Max items to return (default: 10)' },
        },
        requiredParams: ['url'],
      },
    ],
    code: `module.exports = {
  read_feed: async function(params) {
    const { url, limit } = params;
    const res = await fetch(url);
    const text = await res.text();
    var items = [];
    var title = '';
    var titleMatch = text.match(/<title>([^<]+)<\\/title>/);
    if (titleMatch) title = titleMatch[1].trim();
    var itemRegex = /<item>([\\s\\S]*?)<\\/item>/g;
    var entryRegex = /<entry>([\\s\\S]*?)<\\/entry>/g;
    var regex = itemRegex;
    var match;
    var max = limit || 10;
    while ((match = regex.exec(text)) !== null && items.length < max) {
      var block = match[1];
      var t = (block.match(/<title>([^<]+)<\\/title>/) || [])[1] || '';
      var l = (block.match(/<link>([^<]+)<\\/link>/) || [])[1] || '';
      var d = (block.match(/<description>([\\s\\S]*?)<\\/description>/) || [])[1] || '';
      var p = (block.match(/<pubDate>([^<]+)<\\/pubDate>/) || [])[1] || '';
      items.push({ title: t.trim(), link: l.trim(), description: d.trim().replace(/<[^>]+>/g, '').slice(0, 200), pubDate: p.trim() });
    }
    if (items.length === 0) {
      regex = entryRegex;
      while ((match = regex.exec(text)) !== null && items.length < max) {
        var block = match[1];
        var t = (block.match(/<title>([^<]+)<\\/title>/) || [])[1] || '';
        var l = (block.match(/href="([^"]+)"/) || [])[1] || '';
        var d = (block.match(/<summary>([\\s\\S]*?)<\\/summary>/) || [])[1] || '';
        var p = (block.match(/<published>([^<]+)<\\/published>/) || [])[1] || '';
        items.push({ title: t.trim(), link: l.trim(), description: d.trim().replace(/<[^>]+>/g, '').slice(0, 200), pubDate: p.trim() });
      }
    }
    return { feedTitle: title, items: items, count: items.length };
  }
};`,
  },
  {
    key: 'regex-tester',
    name: 'regex-tester',
    description: 'Test regular expressions against text. Returns matches, groups, and match count.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['regex', 'text', 'testing'],
    category: 'Utilities',
    tools: [
      {
        name: 'test_regex',
        description: 'Test a regular expression against text and return all matches.',
        schema: {
          pattern: { type: 'string', description: 'Regular expression pattern (without slashes)' },
          text: { type: 'string', description: 'Text to test against' },
          flags: { type: 'string', description: 'Regex flags (e.g. gi, g, i). Default: g' },
        },
        requiredParams: ['pattern', 'text'],
      },
    ],
    code: `module.exports = {
  test_regex: async function(params) {
    const { pattern, text, flags } = params;
    const f = flags || 'g';
    const regex = new RegExp(pattern, f);
    const matches = [];
    var match;
    while ((match = regex.exec(text)) !== null) {
      matches.push({ match: match[0], index: match.index, groups: match.slice(1) });
      if (!regex.global) break;
    }
    return { pattern: pattern, flags: f, matchCount: matches.length, matches: matches };
  }
};`,
  },
  {
    key: 'color-tools',
    name: 'color-tools',
    description: 'Color conversion and utilities: HEX to RGB, RGB to HSL, generate palettes.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['color', 'design', 'conversion'],
    category: 'Design',
    tools: [
      {
        name: 'hex_to_rgb',
        description: 'Convert a HEX color code to RGB values.',
        schema: { hex: { type: 'string', description: 'HEX color (e.g. #FF5733 or FF5733)' } },
        requiredParams: ['hex'],
      },
      {
        name: 'rgb_to_hsl',
        description: 'Convert RGB values to HSL (hue, saturation, lightness).',
        schema: {
          r: { type: 'number', description: 'Red (0-255)' },
          g: { type: 'number', description: 'Green (0-255)' },
          b: { type: 'number', description: 'Blue (0-255)' },
        },
        requiredParams: ['r', 'g', 'b'],
      },
      {
        name: 'generate_palette',
        description: 'Generate a color palette from a base HEX color.',
        schema: { hex: { type: 'string', description: 'Base HEX color' } },
        requiredParams: ['hex'],
      },
    ],
    code: `module.exports = {
  hex_to_rgb: async function(params) {
    var h = params.hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    return { r: r, g: g, b: b, rgb: 'rgb(' + r + ', ' + g + ', ' + b + ')' };
  },
  rgb_to_hsl: async function(params) {
    var r = params.r / 255, g = params.g / 255, b = params.b / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h /= 6;
    }
    return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100), hsl: 'hsl(' + Math.round(h*360) + ', ' + Math.round(s*100) + '%, ' + Math.round(l*100) + '%)' };
  },
  generate_palette: async function(params) {
    var h = params.hex.replace('#', '');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var r = parseInt(h.slice(0, 2), 16);
    var g = parseInt(h.slice(2, 4), 16);
    var b = parseInt(h.slice(4, 6), 16);
    function shift(amt) {
      var nr = Math.max(0, Math.min(255, r + amt));
      var ng = Math.max(0, Math.min(255, g + amt));
      var nb = Math.max(0, Math.min(255, b + amt));
      return '#' + nr.toString(16).padStart(2,'0') + ng.toString(16).padStart(2,'0') + nb.toString(16).padStart(2,'0');
    }
    return { base: '#' + h, lighter: shift(40), light: shift(20), dark: shift(-20), darker: shift(-40) };
  }
};`,
  },
  {
    key: 'markdown-converter',
    name: 'markdown-converter',
    description: 'Convert Markdown text to HTML. Supports headings, bold, italic, links, lists, and code blocks.',
    author: 'Titan Built-in',
    version: '1.0.0',
    tags: ['markdown', 'html', 'conversion'],
    category: 'Utilities',
    tools: [
      {
        name: 'md_to_html',
        description: 'Convert Markdown text to HTML.',
        schema: { markdown: { type: 'string', description: 'Markdown text to convert' } },
        requiredParams: ['markdown'],
      },
    ],
    code: `module.exports = {
  md_to_html: async function(params) {
    var md = params.markdown;
    var html = md
      .replace(/^### (.*$)/gm, '<h3>$1</h3>')
      .replace(/^## (.*$)/gm, '<h2>$1</h2>')
      .replace(/^# (.*$)/gm, '<h1>$1</h1>')
      .replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>')
      .replace(/\\*(.+?)\\*/g, '<em>$1</em>')
      .replace(/\`(.+?)\`/g, '<code>$1</code>')
      .replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2">$1</a>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/(<li>.*<\\/li>)/s, '<ul>$1</ul>')
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
      .replace(/\\n\\n/g, '</p><p>')
      .replace(/^/, '<p>')
      .replace(/$/, '</p>');
    return { html: html };
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
