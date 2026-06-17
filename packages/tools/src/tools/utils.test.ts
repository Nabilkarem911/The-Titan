import { describe, it, expect } from 'vitest';
import { base64Tool } from './base64Tool.js';
import { calculate } from './calculate.js';
import { jsonValidate } from './jsonValidate.js';
import { textDiff } from './textDiff.js';
import { textStats } from './textStats.js';
import { uuidGenerate } from './uuidGenerate.js';
import { hashCrypto, randomToken } from './hashCrypto.js';
import { regexTest } from './regexTest.js';
import { passwordGenerate } from './passwordGenerate.js';
import { colorConvert } from './colorConvert.js';
import { markdownToHtml } from './markdownToHtml.js';
import { htmlToText } from './htmlToText.js';
import { jwtDecode } from './jwtDecode.js';
import { timezoneConvert } from './timezoneConvert.js';

/* ------------------------------------------------------------------ */
/*  base64Tool                                                         */
/* ------------------------------------------------------------------ */
describe('base64Tool', () => {
  it('encodes a string to base64', async () => {
    const result = await base64Tool({ text: 'Hello World', operation: 'encode' });
    expect(result.output).toBe(Buffer.from('Hello World').toString('base64'));
    expect(result.operation).toBe('encode');
  });

  it('decodes a base64 string', async () => {
    const encoded = Buffer.from('Hello World').toString('base64');
    const result = await base64Tool({ text: encoded, operation: 'decode' });
    expect(result.output).toBe('Hello World');
    expect(result.operation).toBe('decode');
  });

  it('round-trips encode then decode', async () => {
    const original = 'unicode: éàü مرحبا';
    const enc = await base64Tool({ text: original, operation: 'encode' });
    const dec = await base64Tool({ text: enc.output, operation: 'decode' });
    expect(dec.output).toBe(original);
  });

  it('throws on empty text', async () => {
    await expect(base64Tool({ text: '', operation: 'encode' })).rejects.toThrow('text is required');
  });
});

/* ------------------------------------------------------------------ */
/*  calculate                                                          */
/* ------------------------------------------------------------------ */
describe('calculate', () => {
  it('evaluates basic arithmetic', async () => {
    const result = await calculate({ expression: '2 + 3 * 4' });
    expect(result.result).toBe(14);
  });

  it('handles parentheses', async () => {
    const result = await calculate({ expression: '(2 + 3) * 4' });
    expect(result.result).toBe(20);
  });

  it('handles exponentiation with ^', async () => {
    const result = await calculate({ expression: '2^10' });
    expect(result.result).toBe(1024);
  });

  it('evaluates sqrt()', async () => {
    const result = await calculate({ expression: 'sqrt(144)' });
    expect(result.result).toBe(12);
  });

  it('evaluates abs()', async () => {
    const result = await calculate({ expression: 'abs(-42)' });
    expect(result.result).toBe(42);
  });

  it('evaluates floor() and ceil()', async () => {
    const f = await calculate({ expression: 'floor(3.7)' });
    expect(f.result).toBe(3);
    const c = await calculate({ expression: 'ceil(3.1)' });
    expect(c.result).toBe(4);
  });

  it('throws on empty expression', async () => {
    await expect(calculate({ expression: '' })).rejects.toThrow('expression is required');
  });

  it('throws on division by zero (Infinity)', async () => {
    await expect(calculate({ expression: '1 / 0' })).rejects.toThrow('Invalid result');
  });
});

/* ------------------------------------------------------------------ */
/*  jsonValidate                                                       */
/* ------------------------------------------------------------------ */
describe('jsonValidate', () => {
  it('validates correct JSON object', async () => {
    const result = await jsonValidate({ json: '{"a": 1, "b": 2}' });
    expect(result.valid).toBe(true);
    expect(result.type).toBe('object');
    expect(result.keys).toEqual(['a', 'b']);
  });

  it('validates JSON array', async () => {
    const result = await jsonValidate({ json: '[1, 2, 3]' });
    expect(result.valid).toBe(true);
    expect(result.type).toBe('array[3]');
  });

  it('validates primitive JSON', async () => {
    const result = await jsonValidate({ json: '"hello"' });
    expect(result.valid).toBe(true);
    expect(result.type).toBe('string');
  });

  it('formats JSON when requested', async () => {
    const result = await jsonValidate({ json: '{"a":1}', format: true });
    expect(result.formatted).toBe('{\n  "a": 1\n}');
  });

  it('returns error for invalid JSON', async () => {
    const result = await jsonValidate({ json: '{invalid}' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('throws on empty input', async () => {
    await expect(jsonValidate({ json: '' })).rejects.toThrow('json is required');
  });
});

/* ------------------------------------------------------------------ */
/*  textDiff                                                           */
/* ------------------------------------------------------------------ */
describe('textDiff', () => {
  it('detects added lines', async () => {
    const result = await textDiff({ original: 'line1\n', modified: 'line1\nline2\n' });
    expect(result.mode).toBe('lines');
    expect(result.added).toBeGreaterThan(0);
  });

  it('detects removed lines', async () => {
    const result = await textDiff({ original: 'line1\nline2\n', modified: 'line1\n' });
    expect(result.removed).toBeGreaterThan(0);
  });

  it('reports no changes for identical strings', async () => {
    const result = await textDiff({ original: 'same\n', modified: 'same\n' });
    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.unchanged).toBeGreaterThan(0);
  });

  it('supports word mode', async () => {
    const result = await textDiff({ original: 'hello world', modified: 'hello earth', mode: 'words' });
    expect(result.mode).toBe('words');
    expect(result.added).toBeGreaterThan(0);
    expect(result.removed).toBeGreaterThan(0);
  });

  it('generates a unified patch when requested', async () => {
    const result = await textDiff({ original: 'a\n', modified: 'b\n', patch: true });
    expect(result.patch).toBeDefined();
    expect(result.patch).toContain('@@');
  });
});

/* ------------------------------------------------------------------ */
/*  textStats                                                          */
/* ------------------------------------------------------------------ */
describe('textStats', () => {
  const sample = 'The quick brown fox jumps over the lazy dog. The dog barked loudly.';

  it('counts characters', async () => {
    const result = await textStats({ text: sample });
    expect(result.characters).toBe(sample.length);
  });

  it('counts characters without spaces', async () => {
    const result = await textStats({ text: sample });
    expect(result.charactersNoSpaces).toBe(sample.replace(/\s/g, '').length);
  });

  it('counts words', async () => {
    const result = await textStats({ text: sample });
    expect(result.words).toBe(13);
  });

  it('counts sentences', async () => {
    const result = await textStats({ text: sample });
    expect(result.sentences).toBe(2);
  });

  it('counts lines', async () => {
    const result = await textStats({ text: 'a\nb\nc' });
    expect(result.lines).toBe(3);
  });

  it('counts paragraphs', async () => {
    const result = await textStats({ text: 'Para one.\n\nPara two.\n\nPara three.' });
    expect(result.paragraphs).toBe(3);
  });

  it('returns reading time', async () => {
    const result = await textStats({ text: sample });
    expect(result.readingTimeMinutes).toBeGreaterThanOrEqual(1);
  });

  it('finds the longest word', async () => {
    const result = await textStats({ text: 'hi extraordinary world' });
    expect(result.longestWord).toBe('extraordinary');
  });

  it('returns most common words excluding stop words', async () => {
    const result = await textStats({ text: 'code code code test test hello' });
    expect(result.mostCommonWords[0]?.word).toBe('code');
    expect(result.mostCommonWords[0]?.count).toBe(3);
  });

  it('throws on empty text', async () => {
    await expect(textStats({ text: '' })).rejects.toThrow('text is required');
  });
});

/* ------------------------------------------------------------------ */
/*  uuidGenerate                                                       */
/* ------------------------------------------------------------------ */
describe('uuidGenerate', () => {
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it('generates a single valid v4 UUID by default', async () => {
    const result = await uuidGenerate({});
    expect(result.count).toBe(1);
    expect(result.uuids).toHaveLength(1);
    expect(result.uuids[0]).toMatch(UUID_RE);
  });

  it('generates the requested number of UUIDs', async () => {
    const result = await uuidGenerate({ count: 5 });
    expect(result.count).toBe(5);
    expect(result.uuids).toHaveLength(5);
    result.uuids.forEach((id) => expect(id).toMatch(UUID_RE));
  });

  it('generates unique UUIDs', async () => {
    const result = await uuidGenerate({ count: 10 });
    const unique = new Set(result.uuids);
    expect(unique.size).toBe(10);
  });

  it('caps at 100', async () => {
    const result = await uuidGenerate({ count: 200 });
    expect(result.count).toBe(100);
    expect(result.uuids).toHaveLength(100);
  });
});

/* ------------------------------------------------------------------ */
/*  hashCrypto & randomToken                                           */
/* ------------------------------------------------------------------ */
describe('hashCrypto', () => {
  it('hashes with md5', async () => {
    const result = await hashCrypto({ text: 'hello', algorithm: 'md5' });
    expect(result.hash).toBe('5d41402abc4b2a76b9719d911017c592');
    expect(result.algorithm).toBe('md5');
  });

  it('hashes with sha1', async () => {
    const result = await hashCrypto({ text: 'hello', algorithm: 'sha1' });
    expect(result.hash).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
  });

  it('hashes with sha256', async () => {
    const result = await hashCrypto({ text: 'hello', algorithm: 'sha256' });
    expect(result.hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
  });

  it('hashes with sha512', async () => {
    const result = await hashCrypto({ text: 'hello', algorithm: 'sha512' });
    expect(result.hash).toHaveLength(128);
  });

  it('produces HMAC when secret provided', async () => {
    const plain = await hashCrypto({ text: 'hello', algorithm: 'sha256' });
    const hmac = await hashCrypto({ text: 'hello', algorithm: 'sha256', hmacSecret: 'secret' });
    expect(hmac.hash).not.toBe(plain.hash);
    expect(hmac.hash).toHaveLength(64);
  });

  it('throws on empty text', async () => {
    await expect(hashCrypto({ text: '', algorithm: 'sha256' })).rejects.toThrow('text is required');
  });
});

describe('randomToken', () => {
  it('generates hex token of default 32 bytes (64 hex chars)', async () => {
    const result = await randomToken({});
    expect(result.token).toHaveLength(64);
    expect(result.token).toMatch(/^[0-9a-f]+$/);
  });

  it('respects custom byte length', async () => {
    const result = await randomToken({ bytes: 16 });
    expect(result.token).toHaveLength(32);
  });
});

/* ------------------------------------------------------------------ */
/*  regexTest                                                          */
/* ------------------------------------------------------------------ */
describe('regexTest', () => {
  it('matches a simple pattern', async () => {
    const result = await regexTest({ pattern: '\\d+', input: 'abc 123 def' });
    expect(result.isMatch).toBe(true);
    expect(result.matches).toContain('123');
  });

  it('returns all matches with global flag', async () => {
    const result = await regexTest({ pattern: '\\d+', input: 'a1 b22 c333', flags: 'g' });
    expect(result.matches).toEqual(['1', '22', '333']);
    expect(result.matchCount).toBe(3);
  });

  it('returns named groups', async () => {
    const result = await regexTest({
      pattern: '(?<year>\\d{4})-(?<month>\\d{2})',
      input: '2024-06-15',
    });
    expect(result.groups).toEqual({ year: '2024', month: '06' });
  });

  it('reports no match', async () => {
    const result = await regexTest({ pattern: 'xyz', input: 'abc' });
    expect(result.isMatch).toBe(false);
    expect(result.matchCount).toBe(0);
  });

  it('supports case-insensitive flag', async () => {
    const result = await regexTest({ pattern: 'hello', input: 'HELLO', flags: 'i' });
    expect(result.isMatch).toBe(true);
  });

  it('throws on invalid regex', async () => {
    await expect(regexTest({ pattern: '[invalid', input: 'test' })).rejects.toThrow('Invalid regex pattern');
  });

  it('throws on empty pattern', async () => {
    await expect(regexTest({ pattern: '', input: 'test' })).rejects.toThrow('pattern is required');
  });
});

/* ------------------------------------------------------------------ */
/*  passwordGenerate                                                   */
/* ------------------------------------------------------------------ */
describe('passwordGenerate', () => {
  it('generates a password of default length 16', async () => {
    const result = await passwordGenerate({});
    expect(result.passwords).toHaveLength(1);
    expect(result.passwords[0]!.password).toHaveLength(16);
    expect(result.passwords[0]!.length).toBe(16);
  });

  it('generates password of requested length', async () => {
    const result = await passwordGenerate({ length: 32 });
    expect(result.passwords[0]!.password).toHaveLength(32);
  });

  it('generates multiple passwords', async () => {
    const result = await passwordGenerate({ count: 5 });
    expect(result.passwords).toHaveLength(5);
    // all should be unique
    const unique = new Set(result.passwords.map((p) => p.password));
    expect(unique.size).toBe(5);
  });

  it('respects character set options (numbers only)', async () => {
    const result = await passwordGenerate({
      length: 20,
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: true,
      includeSymbols: false,
    });
    expect(result.passwords[0]!.password).toMatch(/^\d+$/);
  });

  it('respects character set options (lowercase only)', async () => {
    const result = await passwordGenerate({
      length: 20,
      includeUppercase: false,
      includeLowercase: true,
      includeNumbers: false,
      includeSymbols: false,
    });
    expect(result.passwords[0]!.password).toMatch(/^[a-z]+$/);
  });

  it('reports entropy and strength', async () => {
    const result = await passwordGenerate({ length: 32 });
    expect(result.passwords[0]!.entropy).toBeGreaterThan(0);
    expect(['weak', 'medium', 'strong', 'very-strong']).toContain(result.passwords[0]!.strength);
  });

  it('throws on length below 4', async () => {
    await expect(passwordGenerate({ length: 2 })).rejects.toThrow('length must be between 4 and 128');
  });

  it('throws on length above 128', async () => {
    await expect(passwordGenerate({ length: 200 })).rejects.toThrow('length must be between 4 and 128');
  });

  it('throws when no character set is enabled', async () => {
    await expect(passwordGenerate({
      includeUppercase: false,
      includeLowercase: false,
      includeNumbers: false,
      includeSymbols: false,
    })).rejects.toThrow('At least one character set must be enabled');
  });

  it('caps at 20 passwords', async () => {
    const result = await passwordGenerate({ count: 50 });
    expect(result.passwords).toHaveLength(20);
  });
});

/* ------------------------------------------------------------------ */
/*  colorConvert                                                       */
/* ------------------------------------------------------------------ */
describe('colorConvert', () => {
  it('converts hex #ff0000 (red)', async () => {
    const result = await colorConvert({ color: '#ff0000' });
    expect(result.rgb).toEqual({ r: 255, g: 0, b: 0 });
    expect(result.hex).toBe('#ff0000');
    expect(result.hsl.h).toBe(0);
    expect(result.hsl.s).toBe(100);
    expect(result.hsl.l).toBe(50);
  });

  it('converts 3-char hex shorthand', async () => {
    const result = await colorConvert({ color: '#fff' });
    expect(result.rgb).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('converts hex without hash prefix', async () => {
    const result = await colorConvert({ color: '00ff00' });
    expect(result.rgb).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('converts rgb() format', async () => {
    const result = await colorConvert({ color: 'rgb(0, 0, 255)' });
    expect(result.rgb).toEqual({ r: 0, g: 0, b: 255 });
    expect(result.hex).toBe('#0000ff');
  });

  it('converts hsl() format', async () => {
    const result = await colorConvert({ color: 'hsl(0, 100%, 50%)' });
    expect(result.rgb).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('computes HSV correctly for black', async () => {
    const result = await colorConvert({ color: '#000000' });
    expect(result.hsv).toEqual({ h: 0, s: 0, v: 0 });
  });

  it('throws on empty color', async () => {
    await expect(colorConvert({ color: '' })).rejects.toThrow('color is required');
  });

  it('throws on unrecognized format', async () => {
    await expect(colorConvert({ color: 'not-a-color' })).rejects.toThrow('Unrecognized color format');
  });
});

/* ------------------------------------------------------------------ */
/*  markdownToHtml                                                     */
/* ------------------------------------------------------------------ */
describe('markdownToHtml', () => {
  it('converts heading', async () => {
    const result = await markdownToHtml({ markdown: '# Hello' });
    expect(result.html).toMatch(/<h1[\s>]/);
    expect(result.html).toContain('Hello');
  });

  it('converts bold and italic', async () => {
    const result = await markdownToHtml({ markdown: '**bold** and *italic*' });
    expect(result.html).toContain('<strong>bold</strong>');
    expect(result.html).toContain('<em>italic</em>');
  });

  it('converts a list', async () => {
    const result = await markdownToHtml({ markdown: '- item1\n- item2' });
    expect(result.html).toContain('<li>');
    expect(result.html).toContain('item1');
  });

  it('converts inline code', async () => {
    const result = await markdownToHtml({ markdown: 'Use `console.log`' });
    expect(result.html).toContain('<code>console.log</code>');
  });

  it('returns the length of the generated HTML', async () => {
    const result = await markdownToHtml({ markdown: '# Title' });
    expect(result.length).toBe(result.html.length);
  });

  it('throws on empty markdown', async () => {
    await expect(markdownToHtml({ markdown: '' })).rejects.toThrow('markdown is required');
  });
});

/* ------------------------------------------------------------------ */
/*  htmlToText                                                         */
/* ------------------------------------------------------------------ */
describe('htmlToText', () => {
  it('strips HTML tags', async () => {
    const result = await htmlToText({ html: '<p>Hello <b>World</b></p>' });
    expect(result.text).toContain('Hello');
    expect(result.text).toContain('World');
    expect(result.text).not.toContain('<p>');
    expect(result.text).not.toContain('<b>');
  });

  it('removes script blocks', async () => {
    const result = await htmlToText({ html: '<p>Text</p><script>alert("x")</script>' });
    expect(result.text).not.toContain('alert');
    expect(result.text).toContain('Text');
  });

  it('removes style blocks', async () => {
    const result = await htmlToText({ html: '<style>body{color:red}</style><p>Content</p>' });
    expect(result.text).not.toContain('color:red');
    expect(result.text).toContain('Content');
  });

  it('decodes HTML entities', async () => {
    const result = await htmlToText({ html: '<p>&amp; &lt; &gt; &quot; &#39; &nbsp;</p>' });
    expect(result.text).toContain('&');
    expect(result.text).toContain('<');
    expect(result.text).toContain('>');
    expect(result.text).toContain('"');
    expect(result.text).toContain("'");
  });

  it('preserves newlines from block elements', async () => {
    const result = await htmlToText({ html: '<p>Para 1</p><p>Para 2</p>' });
    expect(result.text).toContain('Para 1');
    expect(result.text).toContain('Para 2');
    expect(result.text).toContain('\n');
  });

  it('converts list items to bullet points', async () => {
    const result = await htmlToText({ html: '<ul><li>Item 1</li><li>Item 2</li></ul>' });
    expect(result.text).toContain('• Item 1');
    expect(result.text).toContain('• Item 2');
  });

  it('returns word count', async () => {
    const result = await htmlToText({ html: '<p>one two three</p>' });
    expect(result.wordCount).toBe(3);
  });

  it('returns length', async () => {
    const result = await htmlToText({ html: '<p>hello</p>' });
    expect(result.length).toBe(result.text.length);
  });

  it('throws on empty html', async () => {
    await expect(htmlToText({ html: '' })).rejects.toThrow('html is required');
  });
});

/* ------------------------------------------------------------------ */
/*  jwtDecode                                                          */
/* ------------------------------------------------------------------ */
describe('jwtDecode', () => {
  // Build a test JWT manually (header.payload.signature)
  const encode = (obj: Record<string, unknown>): string =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    sub: 'user-42',
    iss: 'titan-test',
    iat: 1700000000,
    exp: 9999999999,     // far in the future
    name: 'Test User',
  };
  const validToken = `${encode(header)}.${encode(payload)}.fake-signature`;

  it('decodes header and payload', async () => {
    const result = await jwtDecode({ token: validToken });
    expect(result.header).toEqual(header);
    expect(result.payload.sub).toBe('user-42');
    expect(result.payload.name).toBe('Test User');
  });

  it('extracts standard claims', async () => {
    const result = await jwtDecode({ token: validToken });
    expect(result.issuer).toBe('titan-test');
    expect(result.subject).toBe('user-42');
    expect(result.issuedAt).toBeDefined();
  });

  it('reports not expired for future exp', async () => {
    const result = await jwtDecode({ token: validToken });
    expect(result.isExpired).toBe(false);
    expect(result.expiresAt).toBeDefined();
  });

  it('reports expired for past exp', async () => {
    const expiredPayload = { ...payload, exp: 1000000000 };
    const expiredToken = `${encode(header)}.${encode(expiredPayload)}.fake`;
    const result = await jwtDecode({ token: expiredToken });
    expect(result.isExpired).toBe(true);
  });

  it('handles token without exp', async () => {
    const noExpPayload = { sub: 'user', iss: 'test' };
    const token = `${encode(header)}.${encode(noExpPayload)}.sig`;
    const result = await jwtDecode({ token });
    expect(result.isExpired).toBe(false);
    expect(result.expiresAt).toBeUndefined();
  });

  it('throws on empty token', async () => {
    await expect(jwtDecode({ token: '' })).rejects.toThrow('token is required');
  });

  it('throws on malformed JWT (not 3 parts)', async () => {
    await expect(jwtDecode({ token: 'only.two' })).rejects.toThrow('Invalid JWT format');
  });
});

/* ------------------------------------------------------------------ */
/*  timezoneConvert                                                    */
/* ------------------------------------------------------------------ */
describe('timezoneConvert', () => {
  it('converts a specific time between timezones', async () => {
    const result = await timezoneConvert({
      time: '2024-06-15T12:00:00Z',
      fromTimezone: 'UTC',
      toTimezone: 'America/New_York',
    });
    expect(result.fromTimezone).toBe('UTC');
    expect(result.toTimezone).toBe('America/New_York');
    expect(result.convertedTime).toBeDefined();
    expect(result.originalTime).toContain('2024-06-15');
  });

  it('throws on invalid time', async () => {
    await expect(timezoneConvert({
      time: 'not-a-date',
      fromTimezone: 'UTC',
      toTimezone: 'UTC',
    })).rejects.toThrow('Invalid time');
  });

  it('throws on invalid timezone', async () => {
    await expect(timezoneConvert({
      time: '2024-06-15T12:00:00Z',
      fromTimezone: 'UTC',
      toTimezone: 'Fake/Timezone',
    })).rejects.toThrow('Invalid timezone');
  });

  it('returns offset string', async () => {
    const result = await timezoneConvert({
      time: '2024-06-15T12:00:00Z',
      fromTimezone: 'UTC',
      toTimezone: 'Asia/Tokyo',
    });
    expect(result.offset).toContain('→');
  });
});
