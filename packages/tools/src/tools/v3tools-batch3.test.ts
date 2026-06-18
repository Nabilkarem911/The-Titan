import { describe, it, expect } from 'vitest';
import { documentTemplate } from './documentTemplate.js';
import { slideCreate } from './slideCreate.js';
import { jsonSchemaValidate } from './jsonSchemaValidate.js';
import { yamlConvert } from './yamlConvert.js';
import { contractDraft } from './contractDraft.js';
import { imageEdit } from './imageEdit.js';

describe('documentTemplate', () => {
  it('replaces variables in template', async () => {
    const result = JSON.parse(await documentTemplate({ template: 'Hello {{name}}, your order #{{orderId}} is ready.', variables: { name: 'Nabil', orderId: '123' } }));
    expect(result.content).toContain('Nabil');
    expect(result.content).toContain('123');
    expect(result.variablesApplied).toBe(2);
  });

  it('warns about unreplaced variables', async () => {
    const result = JSON.parse(await documentTemplate({ template: 'Hello {{name}} — {{missing}}', variables: { name: 'Nabil' } }));
    expect(result.warnings).toContain('{{missing}}');
  });
});

describe('slideCreate', () => {
  it('generates presentation HTML', async () => {
    const result = JSON.parse(await slideCreate({ slides: [{ title: 'Intro', bullets: ['Point 1', 'Point 2'] }, { title: 'Details' }] }));
    expect(result.slideCount).toBe(2);
    expect(result.html).toContain('Intro');
    expect(result.html).toContain('Point 1');
  });
});

describe('jsonSchemaValidate', () => {
  it('validates correct data', async () => {
    const result = JSON.parse(await jsonSchemaValidate({
      data: { name: 'Nabil', age: 25 },
      schema: { type: 'object', properties: { name: { type: 'string' }, age: { type: 'number' } }, required: ['name'] },
    }));
    expect(result.valid).toBe(true);
  });

  it('catches missing required field', async () => {
    const result = JSON.parse(await jsonSchemaValidate({
      data: { age: 25 },
      schema: { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
    }));
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('name');
  });

  it('catches type mismatch', async () => {
    const result = JSON.parse(await jsonSchemaValidate({
      data: { age: 'not a number' },
      schema: { type: 'object', properties: { age: { type: 'number' } } },
    }));
    expect(result.valid).toBe(false);
  });
});

describe('yamlConvert', () => {
  it('converts JSON to YAML', async () => {
    const result = await yamlConvert({ input: '{"name":"Titan","version":"1.0"}', from: 'json', to: 'yaml' });
    expect(result).toContain('name: Titan');
    expect(result).toContain('version: 1');
  });

  it('converts YAML to JSON', async () => {
    const result = await yamlConvert({ input: 'name: Titan\nversion: 2', from: 'yaml', to: 'json' });
    const parsed = JSON.parse(result);
    expect(parsed.name).toBe('Titan');
    expect(parsed.version).toBe(2);
  });
});

describe('contractDraft', () => {
  it('drafts NDA contract', async () => {
    const result = JSON.parse(await contractDraft({ type: 'nda', parties: { partyA: 'Titan Corp', partyB: 'Client Inc' } }));
    expect(result.contract).toContain('NON-DISCLOSURE');
    expect(result.contract).toContain('Titan Corp');
    expect(result.contract).toContain('DISCLAIMER');
  });

  it('drafts freelance contract', async () => {
    const result = JSON.parse(await contractDraft({ type: 'freelance', parties: { partyA: 'Company', partyB: 'Freelancer' }, terms: { scope: 'Build a website' } }));
    expect(result.contract).toContain('FREELANCE');
    expect(result.contract).toContain('Build a website');
  });
});

describe('imageEdit', () => {
  it('returns resize instruction', async () => {
    const result = JSON.parse(await imageEdit({ action: 'resize', url: 'https://example.com/img.png', width: 400, height: 300 }));
    expect(result.action).toBe('resize');
    expect(result.width).toBe(400);
  });

  it('returns convert instruction', async () => {
    const result = JSON.parse(await imageEdit({ action: 'convert', url: 'https://example.com/img.png', format: 'webp' }));
    expect(result.format).toBe('webp');
  });
});
