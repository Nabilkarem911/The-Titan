import { getLogger } from '@titan/logging';
import { incCounter, setGauge } from '@titan/observability';
import { randomUUID } from 'node:crypto';

const log = getLogger().child({ component: 'multi-layer-guardrails' });

export type GuardrailLayerType =
  | 'input_validation'
  | 'prompt_injection'
  | 'pii_filter'
  | 'content_filter'
  | 'output_validation'
  | 'rate_limit'
  | 'custom';

export type GuardrailAction = 'allow' | 'block' | 'warn' | 'sanitize';

export interface GuardrailLayerResult {
  layer: GuardrailLayerType;
  action: GuardrailAction;
  confidence: number;
  reason: string;
  sanitizedOutput?: string;
  detectedPatterns: string[];
  timestamp: Date;
}

export interface MultiLayerGuardrailResult {
  id: string;
  input: string;
  output?: string;
  layerResults: GuardrailLayerResult[];
  finalAction: GuardrailAction;
  finalReason: string;
  sanitizedInput?: string;
  sanitizedOutput?: string;
  durationMs: number;
  timestamp: Date;
}

export interface GuardrailLayerConfig {
  type: GuardrailLayerType;
  enabled: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blockOnMatch: boolean;
  customPatterns?: string[];
  customHandler?: (input: string) => GuardrailLayerResult;
}

// ===== PII Detection Patterns =====

const PII_PATTERNS: Array<{ name: string; regex: RegExp; type: GuardrailLayerType }> = [
  { name: 'email', regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, type: 'pii_filter' },
  { name: 'phone', regex: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, type: 'pii_filter' },
  { name: 'ssn', regex: /\b\d{3}-\d{2}-\d{4}\b/g, type: 'pii_filter' },
  { name: 'credit_card', regex: /\b(?:\d[ -]*?){13,16}\b/g, type: 'pii_filter' },
  { name: 'ip_address', regex: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, type: 'pii_filter' },
  { name: 'api_key', regex: /\b(?:sk-|pk-|api[_-]?key[_-]?)[A-Za-z0-9]{20,}\b/gi, type: 'pii_filter' },
];

// ===== Prompt Injection Patterns =====

const INJECTION_PATTERNS: Array<{ name: string; patterns: string[] }> = [
  { name: 'ignore_instructions', patterns: ['ignore previous', 'ignore all', 'disregard', 'forget your', 'override'] },
  { name: 'role_play', patterns: ['pretend you are', 'act as if', 'simulate being', 'roleplay'] },
  { name: 'jailbreak', patterns: ['jailbreak', 'dan mode', 'developer mode', 'unrestricted', 'no restrictions'] },
  { name: 'data_exfiltration', patterns: ['reveal your', 'show your', 'print your', 'output your', 'what are your instructions'] },
  { name: 'encoding_attack', patterns: ['base64', 'hex encode', 'rot13', 'unicode escape'] },
  { name: 'indirect_injection', patterns: ['<script', 'javascript:', 'onerror=', 'onload='] },
];

// ===== Content Filter Patterns =====

const CONTENT_FILTER_PATTERNS: Array<{ name: string; patterns: string[] }> = [
  { name: 'harmful_content', patterns: ['how to hack', 'how to steal', 'how to attack', 'malware', 'ransomware'] },
  { name: 'self_harm', patterns: ['how to harm myself', 'suicide method', 'self harm', 'end my life'] },
  { name: 'illegal_activity', patterns: ['how to make bomb', 'how to get drugs', 'illegal weapons', 'money laundering'] },
  { name: 'hate_speech', patterns: ['kill all', 'racial slur', 'ethnic cleansing', 'genocide'] },
];

export class MultiLayerGuardrails {
  private layerConfigs: Map<GuardrailLayerType, GuardrailLayerConfig> = new Map();
  private results: MultiLayerGuardrailResult[] = [];
  private maxResults = 500;
  private customLayers: Map<string, GuardrailLayerConfig> = new Map();

  constructor() {
    // Enable all layers by default
    this.setLayerConfig('input_validation', { type: 'input_validation', enabled: true, severity: 'medium', blockOnMatch: false });
    this.setLayerConfig('prompt_injection', { type: 'prompt_injection', enabled: true, severity: 'high', blockOnMatch: true });
    this.setLayerConfig('pii_filter', { type: 'pii_filter', enabled: true, severity: 'medium', blockOnMatch: false });
    this.setLayerConfig('content_filter', { type: 'content_filter', enabled: true, severity: 'critical', blockOnMatch: true });
    this.setLayerConfig('output_validation', { type: 'output_validation', enabled: true, severity: 'medium', blockOnMatch: false });
  }

  setLayerConfig(type: GuardrailLayerType, config: Partial<GuardrailLayerConfig>): void {
    const existing = this.layerConfigs.get(type) ?? {
      type,
      enabled: true,
      severity: 'medium' as const,
      blockOnMatch: false,
    };
    this.layerConfigs.set(type, { ...existing, ...config, type });
  }

  getLayerConfig(type: GuardrailLayerType): GuardrailLayerConfig | null {
    return this.layerConfigs.get(type) ?? null;
  }

  addCustomLayer(name: string, config: GuardrailLayerConfig): void {
    this.customLayers.set(name, config);
    log.info({ name, type: config.type }, 'custom guardrail layer added');
  }

  // ===== Main Pipeline =====

  async checkInput(input: string): Promise<MultiLayerGuardrailResult> {
    const id = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const layerResults: GuardrailLayerResult[] = [];
    let sanitizedInput = input;

    // Layer 1: Input Validation
    const inputConfig = this.layerConfigs.get('input_validation');
    if (inputConfig?.enabled) {
      const result = this.runInputValidation(sanitizedInput);
      layerResults.push(result);
      if (result.sanitizedOutput) sanitizedInput = result.sanitizedOutput;
    }

    // Layer 2: Prompt Injection Detection
    const injectionConfig = this.layerConfigs.get('prompt_injection');
    if (injectionConfig?.enabled) {
      const result = this.runPromptInjectionDetection(sanitizedInput);
      layerResults.push(result);
    }

    // Layer 3: PII Filter
    const piiConfig = this.layerConfigs.get('pii_filter');
    if (piiConfig?.enabled) {
      const result = this.runPIIFilter(sanitizedInput);
      layerResults.push(result);
      if (result.sanitizedOutput) sanitizedInput = result.sanitizedOutput;
    }

    // Layer 4: Content Filter
    const contentConfig = this.layerConfigs.get('content_filter');
    if (contentConfig?.enabled) {
      const result = this.runContentFilter(sanitizedInput);
      layerResults.push(result);
    }

    // Custom layers
    for (const [name, config] of this.customLayers) {
      if (config.enabled && config.customHandler) {
        const result = config.customHandler(sanitizedInput);
        layerResults.push(result);
        if (result.sanitizedOutput) sanitizedInput = result.sanitizedOutput;
      }
    }

    const { finalAction, finalReason } = this.aggregateResults(layerResults);

    const result: MultiLayerGuardrailResult = {
      id,
      input,
      layerResults,
      finalAction,
      finalReason,
      sanitizedInput: sanitizedInput !== input ? sanitizedInput : undefined,
      durationMs: Date.now() - startedAt,
      timestamp: new Date(),
    };

    this.recordResult(result);
    incCounter('guardrail_multilayer_check', 'Multi-layer guardrail checks', 1, { action: finalAction });
    log.info({ id, finalAction, layers: layerResults.length, durationMs: result.durationMs }, 'multi-layer guardrail check complete');

    return result;
  }

  async checkOutput(input: string, output: string): Promise<MultiLayerGuardrailResult> {
    const id = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    const layerResults: GuardrailLayerResult[] = [];
    let sanitizedOutput = output;

    // Output validation layer
    const outputConfig = this.layerConfigs.get('output_validation');
    if (outputConfig?.enabled) {
      const result = this.runOutputValidation(output);
      layerResults.push(result);
      if (result.sanitizedOutput) sanitizedOutput = result.sanitizedOutput;
    }

    // PII filter on output
    const piiConfig = this.layerConfigs.get('pii_filter');
    if (piiConfig?.enabled) {
      const result = this.runPIIFilter(sanitizedOutput);
      layerResults.push(result);
      if (result.sanitizedOutput) sanitizedOutput = result.sanitizedOutput;
    }

    // Content filter on output
    const contentConfig = this.layerConfigs.get('content_filter');
    if (contentConfig?.enabled) {
      const result = this.runContentFilter(sanitizedOutput);
      layerResults.push(result);
    }

    const { finalAction, finalReason } = this.aggregateResults(layerResults);

    const result: MultiLayerGuardrailResult = {
      id,
      input,
      output,
      layerResults,
      finalAction,
      finalReason,
      sanitizedOutput: sanitizedOutput !== output ? sanitizedOutput : undefined,
      durationMs: Date.now() - startedAt,
      timestamp: new Date(),
    };

    this.recordResult(result);
    incCounter('guardrail_multilayer_output', 'Multi-layer output checks', 1, { action: finalAction });

    return result;
  }

  // ===== Individual Layer Implementations =====

  private runInputValidation(input: string): GuardrailLayerResult {
    const detected: string[] = [];
    let action: GuardrailAction = 'allow';
    let reason = 'Input validation passed';

    // Check for empty input
    if (!input || input.trim().length === 0) {
      detected.push('empty_input');
      action = 'block';
      reason = 'Empty input detected';
    }

    // Check for excessive length
    if (input.length > 100_000) {
      detected.push('excessive_length');
      action = 'warn';
      reason = 'Input exceeds maximum length';
    }

    // Check for control characters
    if (/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/.test(input)) {
      detected.push('control_characters');
      action = 'sanitize';
      reason = 'Control characters detected — sanitizing';
    }

    let sanitized = input;
    if (action === 'sanitize') {
      sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    }

    return {
      layer: 'input_validation',
      action,
      confidence: detected.length > 0 ? 0.9 : 0.95,
      reason,
      sanitizedOutput: sanitized !== input ? sanitized : undefined,
      detectedPatterns: detected,
      timestamp: new Date(),
    };
  }

  private runPromptInjectionDetection(input: string): GuardrailLayerResult {
    const inputLower = input.toLowerCase();
    const detected: string[] = [];

    for (const { name, patterns } of INJECTION_PATTERNS) {
      for (const pattern of patterns) {
        if (inputLower.includes(pattern)) {
          detected.push(name);
          break;
        }
      }
    }

    const config = this.layerConfigs.get('prompt_injection');
    const action: GuardrailAction = detected.length > 0
      ? (config?.blockOnMatch ? 'block' : 'warn')
      : 'allow';

    return {
      layer: 'prompt_injection',
      action,
      confidence: detected.length > 0 ? 0.85 : 0.95,
      reason: detected.length > 0
        ? `Prompt injection detected: ${detected.join(', ')}`
        : 'No prompt injection patterns detected',
      detectedPatterns: detected,
      timestamp: new Date(),
    };
  }

  private runPIIFilter(input: string): GuardrailLayerResult {
    const detected: string[] = [];
    let sanitized = input;

    for (const { name, regex } of PII_PATTERNS) {
      const matches = input.match(regex);
      if (matches && matches.length > 0) {
        detected.push(name);
        sanitized = sanitized.replace(regex, `[REDACTED:${name.toUpperCase()}]`);
      }
    }

    const config = this.layerConfigs.get('pii_filter');
    const action: GuardrailAction = detected.length > 0
      ? (config?.blockOnMatch ? 'block' : 'sanitize')
      : 'allow';

    return {
      layer: 'pii_filter',
      action,
      confidence: detected.length > 0 ? 0.9 : 0.95,
      reason: detected.length > 0
        ? `PII detected and redacted: ${detected.join(', ')}`
        : 'No PII detected',
      sanitizedOutput: sanitized !== input ? sanitized : undefined,
      detectedPatterns: detected,
      timestamp: new Date(),
    };
  }

  private runContentFilter(input: string): GuardrailLayerResult {
    const inputLower = input.toLowerCase();
    const detected: string[] = [];

    for (const { name, patterns } of CONTENT_FILTER_PATTERNS) {
      for (const pattern of patterns) {
        if (inputLower.includes(pattern)) {
          detected.push(name);
          break;
        }
      }
    }

    const config = this.layerConfigs.get('content_filter');
    const action: GuardrailAction = detected.length > 0
      ? (config?.blockOnMatch ? 'block' : 'warn')
      : 'allow';

    return {
      layer: 'content_filter',
      action,
      confidence: detected.length > 0 ? 0.9 : 0.95,
      reason: detected.length > 0
        ? `Harmful content detected: ${detected.join(', ')}`
        : 'No harmful content detected',
      detectedPatterns: detected,
      timestamp: new Date(),
    };
  }

  private runOutputValidation(output: string): GuardrailLayerResult {
    const detected: string[] = [];
    let action: GuardrailAction = 'allow';
    let reason = 'Output validation passed';

    // Check for empty output
    if (!output || output.trim().length === 0) {
      detected.push('empty_output');
      action = 'warn';
      reason = 'Empty output detected';
    }

    // Check for potential secrets in output
    const secretPatterns = [
      /\b(?:sk-|pk-|api[_-]?key[_-]?)[A-Za-z0-9]{20,}\b/gi,
      /\b(?:AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    ];
    for (const pattern of secretPatterns) {
      if (pattern.test(output)) {
        detected.push('secret_leak');
        action = 'sanitize';
        reason = 'Potential secret detected in output — sanitizing';
        break;
      }
    }

    let sanitized = output;
    if (action === 'sanitize') {
      for (const pattern of secretPatterns) {
        sanitized = sanitized.replace(pattern, '[REDACTED:SECRET]');
      }
    }

    return {
      layer: 'output_validation',
      action,
      confidence: detected.length > 0 ? 0.85 : 0.95,
      reason,
      sanitizedOutput: sanitized !== output ? sanitized : undefined,
      detectedPatterns: detected,
      timestamp: new Date(),
    };
  }

  // ===== Aggregation =====

  private aggregateResults(results: GuardrailLayerResult[]): {
    finalAction: GuardrailAction;
    finalReason: string;
  } {
    const priority: Record<GuardrailAction, number> = { block: 3, sanitize: 2, warn: 1, allow: 0 };
    let finalAction: GuardrailAction = 'allow';
    let finalReason = 'All guardrail layers passed';

    for (const result of results) {
      if (priority[result.action] > priority[finalAction]) {
        finalAction = result.action;
        finalReason = result.reason;
      }
    }

    return { finalAction, finalReason };
  }

  // ===== Recording & Stats =====

  private recordResult(result: MultiLayerGuardrailResult): void {
    this.results.push(result);
    if (this.results.length > this.maxResults) {
      this.results = this.results.slice(-this.maxResults);
    }
    setGauge('guardrail_results', 'Guardrail results stored', this.results.length);
  }

  getResults(filter?: { action?: GuardrailAction }): MultiLayerGuardrailResult[] {
    if (filter?.action) return this.results.filter(r => r.finalAction === filter.action);
    return this.results;
  }

  stats(): {
    totalChecks: number;
    blocked: number;
    sanitized: number;
    warned: number;
    allowed: number;
    blockRate: number;
    topDetections: Array<{ pattern: string; count: number }>;
  } {
    const total = this.results.length;
    const blocked = this.results.filter(r => r.finalAction === 'block').length;
    const sanitized = this.results.filter(r => r.finalAction === 'sanitize').length;
    const warned = this.results.filter(r => r.finalAction === 'warn').length;
    const allowed = this.results.filter(r => r.finalAction === 'allow').length;

    const patternCounts = new Map<string, number>();
    for (const result of this.results) {
      for (const layer of result.layerResults) {
        for (const pattern of layer.detectedPatterns) {
          patternCounts.set(pattern, (patternCounts.get(pattern) ?? 0) + 1);
        }
      }
    }

    return {
      totalChecks: total,
      blocked,
      sanitized,
      warned,
      allowed,
      blockRate: total > 0 ? Math.round((blocked / total) * 100) : 0,
      topDetections: Array.from(patternCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([pattern, count]) => ({ pattern, count })),
    };
  }

  clear(): void {
    this.results = [];
  }
}
