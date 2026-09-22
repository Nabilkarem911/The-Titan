import type { LlmProvider } from '../types.js';
import { getGlobalToolRegistry } from '../tool-registry.js';
import type { WiredCapabilities } from '../capability-wiring.js';

export function registerCoreTools(wiring: WiredCapabilities, _llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  // ── milliseconds.ai — قرارات/تصنيف/استخراج سريع وموثوق (مقيس على العربي 2026-09) ──
  // بديل رخيص للفشل المتكرر في استخراج الحقايق بالموديل الصغير. مفتاحه من env فقط.
  const msCall = async (endpoint: string, body: Record<string, unknown>): Promise<unknown> => {
    const key = process.env.MILLISECONDS_API_KEY ?? process.env.MILLISECONDS_PLAYGROUND_KEY;
    if (!key) throw new Error('MILLISECONDS_API_KEY is not set');
    const res = await fetch(`https://api.milliseconds.ai/v1/decision-machine-1/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(45_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`milliseconds.ai ${endpoint}: ${res.status} ${text.slice(0, 300)}`);
    try {
      return JSON.parse(text);
    } catch {
      return { raw: text.slice(0, 4_000) };
    }
  };

  registry.register({
    name: 'ms_extract',
    description:
      'Extract structured fields from text using a JSON schema. Typed answers with probabilities, ' +
      'multilingual (understands Egyptian/Saudi/English dialects). Use for facts, orders, invoices.',
    tags: ['extraction', 'decision'],
    schema: {
      text: { type: 'string', description: 'The text to extract from' },
      schema: { type: 'object', description: 'JSON schema of the fields to extract' },
    },
    requiredParams: ['text', 'schema'],
    handler: async (params: unknown) => {
      const p = params as { text: string; schema: Record<string, unknown> };
      return msCall('extract', { text: p.text, schema: p.schema });
    },
  });

  registry.register({
    name: 'ms_classify',
    description:
      'Classify text into one of the given labels, or check a yes/no statement. Fast (~0.6s), ' +
      'dialect-aware. Use to route or triage a message instead of guessing with regex.',
    tags: ['classification', 'decision'],
    schema: {
      text: { type: 'string', description: 'The text to classify' },
      labels: { type: 'array', description: 'Candidate labels (omit for a yes/no check)' },
      statement: { type: 'string', description: 'Yes/no statement to check (used when labels are omitted)' },
    },
    requiredParams: ['text'],
    handler: async (params: unknown) => {
      const p = params as { text: string; labels?: string[]; statement?: string };
      if (p.labels && p.labels.length > 0) return msCall('classify', { text: p.text, labels: p.labels });
      return msCall('yes-no', { text: p.text, statement: p.statement ?? '' });
    },
  });

  registry.register({
    name: 'ms_entities',
    description:
      'Extract named entities (people, amounts, dates, order ids, cities) from text with ' +
      'probabilities and character offsets. Multilingual.',
    tags: ['extraction', 'entities'],
    schema: {
      text: { type: 'string', description: 'The text to read entities from' },
      types: { type: 'array', description: 'Entity types to look for' },
    },
    requiredParams: ['text'],
    handler: async (params: unknown) => {
      const p = params as { text: string; types?: string[] };
      return msCall('entities', { text: p.text, types: p.types ?? ['person', 'amount', 'date', 'city', 'order_id'] });
    },
  });

  registry.register({
    name: 'translate_text',
    description: 'Translate text between 100+ languages, code languages, or protocols',
    tags: ['translation', 'language'],
    schema: {
      text: { type: 'string', description: 'Text to translate' },
      from: { type: 'string', description: 'Source language' },
      to: { type: 'string', description: 'Target language' },
    },
    requiredParams: ['text', 'to'],
    handler: async (params: unknown) => {
      const p = params as { text: string; from?: string; to: string };
      return wiring.universalTranslator.translateLanguage(p.text, p.from ?? 'auto', p.to);
    },
  });

  registry.register({
    name: 'generate_creative',
    description: 'Generate images, music, video, or generative art',
    tags: ['creative', 'image'],
    schema: {
      type: { type: 'string', description: 'image | music | video | art', enum: ['image', 'music', 'video', 'art'] },
      prompt: { type: 'string', description: 'Creative prompt' },
    },
    requiredParams: ['type', 'prompt'],
    handler: async (params: unknown) => {
      const p = params as { type: string; prompt: string };
      return wiring.creativeEngine.generate({ type: p.type as 'image' | 'music' | 'video' | 'code', prompt: p.prompt });
    },
  });

  registry.register({
    name: 'temporal_analysis',
    description: 'Analyze temporal patterns, predict future events, or explore timeline branches',
    tags: ['temporal', 'prediction'],
    schema: {
      action: { type: 'string', description: 'past | future | branch | schedule', enum: ['past', 'future', 'branch', 'schedule'] },
      query: { type: 'string', description: 'The temporal query' },
    },
    requiredParams: ['action', 'query'],
    handler: async (params: unknown) => {
      const p = params as { action: string; query: string };
      switch (p.action) {
        case 'past': return wiring.temporalIntelligence.analyzePast();
        case 'future': return wiring.temporalIntelligence.predictFuture();
        case 'branch': return wiring.temporalIntelligence.exploreTimelineBranches(p.query, [p.query]);
        case 'schedule': return wiring.temporalIntelligence.scheduleOptimalTime(p.query, { start: 9, end: 18 }, 'UTC');
        default: return { error: `Unknown action: ${p.action}` };
      }
    },
  });

  registry.register({
    name: 'what_if_simulation',
    description: 'Simulate a what-if scenario using the digital twin world model',
    tags: ['simulation', 'prediction'],
    schema: {
      scenario: { type: 'string', description: 'The scenario to simulate' },
    },
    requiredParams: ['scenario'],
    handler: async (params: unknown) => {
      const p = params as { scenario: string };
      return wiring.whatIfEngine.simulate(p.scenario, p.scenario);
    },
  });

  registry.register({
    name: 'quantum_optimize',
    description: 'Quantum-inspired optimization for complex decision problems',
    tags: ['optimization', 'quantum'],
    schema: {
      problem: { type: 'string', description: 'Problem description' },
      strategies: { type: 'string', description: 'Comma-separated strategy options' },
    },
    requiredParams: ['problem', 'strategies'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; strategies: string };
      return wiring.quantumOptimizer.optimize(p.problem, p.strategies.split(',').map((s) => s.trim()), (s) => s.length);
    },
  });

  registry.register({
    name: 'hive_mind_stats',
    description: 'Get hive mind collective intelligence stats and knowledge',
    tags: ['hive', 'collective'],
    handler: async () => ({
      stats: wiring.hiveMind.getStats(),
      instances: wiring.hiveMind.getInstances(),
      knowledge: wiring.hiveMind.getAllKnowledge(),
    }),
  });

  registry.register({
    name: 'economy_stats',
    description: 'Query agent economy stats, listings, and reputation',
    tags: ['economy'],
    handler: async () => ({
      stats: wiring.agentEconomy.getStats(),
      listings: wiring.agentEconomy.getListings(),
      auditLog: wiring.agentEconomy.getAuditLog(),
    }),
  });

  registry.register({
    name: 'constitution_read',
    description: 'Read Titan Constitution principles and amendments',
    tags: ['constitution', 'governance'],
    handler: async () => ({
      principles: wiring.titanConstitution.getPrinciples(),
      amendments: wiring.titanConstitution.getAmendments(),
      markdown: wiring.titanConstitution.exportAsMarkdown(),
    }),
  });

  registry.register({
    name: 'proactive_suggest',
    description: 'Get proactive suggestions based on pattern analysis',
    tags: ['proactive', 'suggestions'],
    handler: async () => wiring.proactiveIntelligence.getSuggestions(),
  });

  registry.register({
    name: 'evolve_code',
    description: 'Analyze and propose improvements to a source module',
    tags: ['evolution', 'code'],
    schema: {
      modulePath: { type: 'string', description: 'Path to the source module' },
    },
    requiredParams: ['modulePath'],
    handler: async (params: unknown) => {
      const p = params as { modulePath: string };
      return wiring.selfEvolvingCode.analyzeModule(p.modulePath, '');
    },
  });

  registry.register({
    name: 'self_play_session',
    description: 'Run a self-play session for autonomous skill development',
    tags: ['selfplay', 'learning'],
    handler: async () => wiring.infiniteSelfPlay.runSession(1),
  });

  registry.register({
    name: 'extract_pdf_tables',
    description: 'Extract structured table data from PDF text content',
    tags: ['multimodal', 'pdf'],
    schema: {
      pdfText: { type: 'string', description: 'Extracted PDF text content' },
    },
    requiredParams: ['pdfText'],
    handler: async (params: unknown) => {
      const p = params as { pdfText: string };
      return wiring.advancedMultimodal.extractPDFTables(p.pdfText);
    },
  });

  registry.register({
    name: 'code_from_screenshot',
    description: 'Extract editable code from a screenshot description',
    tags: ['multimodal', 'ocr'],
    schema: {
      imageDescription: { type: 'string', description: 'Description of the screenshot content' },
    },
    requiredParams: ['imageDescription'],
    handler: async (params: unknown) => {
      const p = params as { imageDescription: string };
      return wiring.advancedMultimodal.codeFromScreenshot(p.imageDescription);
    },
  });

  registry.register({
    name: 'diagram_to_code',
    description: 'Convert a diagram description to code',
    tags: ['multimodal', 'diagram'],
    schema: {
      diagramDescription: { type: 'string', description: 'Description of the diagram' },
    },
    requiredParams: ['diagramDescription'],
    handler: async (params: unknown) => {
      const p = params as { diagramDescription: string };
      return wiring.advancedMultimodal.diagramToCode(p.diagramDescription);
    },
  });

  registry.register({
    name: 'understand_chart',
    description: 'Understand and extract data from a chart description',
    tags: ['multimodal', 'chart'],
    schema: {
      chartDescription: { type: 'string', description: 'Description of the chart' },
    },
    requiredParams: ['chartDescription'],
    handler: async (params: unknown) => {
      const p = params as { chartDescription: string };
      return wiring.advancedMultimodal.understandChart(p.chartDescription);
    },
  });
}
