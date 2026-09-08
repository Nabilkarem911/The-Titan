import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import { getGlobalToolRegistry } from '../tool-registry.js';
import { capabilityRegistryRepo as crRepo } from '@titan/database';

const log = getLogger().child({ component: 'capability-registry' });

export interface Capability {
  id: string;
  name: string;
  category: CapabilityCategory;
  description: string;
  enabled: boolean;
  source: 'core' | 'super-agent' | 'cosmic' | 'platform' | 'evolution' | 'mythical';
  dependencies?: string[];
}

type CapabilityCategory =
  | 'reasoning'
  | 'memory'
  | 'tools'
  | 'code-intel'
  | 'multimodal'
  | 'voice'
  | 'swarm'
  | 'learning'
  | 'safety'
  | 'consciousness'
  | 'creative'
  | 'economy'
  | 'evolution'
  | 'communication'
  | 'autonomous'
  | 'privacy'
  | 'workflow'
  | 'integrations';

interface CapabilitySnapshot {
  total: number;
  enabled: number;
  byCategory: Record<string, number>;
  bySource: Record<string, number>;
  capabilities: Capability[];
  toolsCount: number;
}

const ALL_CAPABILITIES: Omit<Capability, 'id' | 'enabled'>[] = [
  // ── Core Reasoning ──
  { name: 'Multi-Strategy Planning', category: 'reasoning', source: 'core', description: 'Decomposes complex tasks into steps with strategy selection (chain-of-thought, tree-of-thought, debate, reflection)' },
  { name: 'Hypothesis Testing', category: 'reasoning', source: 'core', description: 'Formulates hypotheses, designs tests, validates or refutes them' },
  { name: 'Dream Mode', category: 'reasoning', source: 'core', description: 'Consolidates memories in background like human sleep — synthesizes insights from past experiences' },
  { name: 'Causal Replay', category: 'reasoning', source: 'core', description: 'Replays past failures with causal analysis to understand what went wrong' },
  { name: 'Self-Healing Debugger', category: 'reasoning', source: 'core', description: 'Autonomously diagnoses and fixes bugs in code' },
  { name: 'Self-Rewriter (MOSS)', category: 'reasoning', source: 'core', description: 'Full MOSS pipeline: diagnose → plan → implement → verify → deploy with health probes' },
  { name: 'Evolutionary Solver', category: 'reasoning', source: 'core', description: 'Evolves solutions through mutation, crossover, and selection' },
  { name: 'Neuro-Symbolic Reasoning', category: 'reasoning', source: 'core', description: 'Combines neural LLM reasoning with symbolic logic' },
  { name: 'Dynamic Tool Discovery', category: 'reasoning', source: 'core', description: 'Discovers tools from npm, GitHub, APIs, and MCP servers when missing capabilities are detected' },
  { name: 'Skill Synthesis', category: 'reasoning', source: 'core', description: 'Synthesizes new skills from observed patterns' },
  { name: 'Test-Time Recursive Thinking v2', category: 'reasoning', source: 'super-agent', description: 'Fast/slow solver architecture with depth-aware recursive strategies and abstention gate' },
  { name: 'HyperAgent', category: 'reasoning', source: 'super-agent', description: 'Hyper-efficient agent execution with parallel reasoning' },
  { name: 'Execution State Memory', category: 'reasoning', source: 'super-agent', description: 'Remembers execution states across runs for faster recovery' },
  { name: 'Smart Model Router', category: 'reasoning', source: 'super-agent', description: 'Routes requests to optimal model based on task complexity and budget' },
  { name: 'Benchmarking Suite', category: 'reasoning', source: 'super-agent', description: 'Built-in benchmarking for agent performance evaluation' },
  { name: 'APEX Evolution', category: 'reasoning', source: 'super-agent', description: 'Apex-level evolutionary optimization for agent strategies' },

  // ── Memory ──
  { name: '6-Layer Memory', category: 'memory', source: 'core', description: 'Working, episodic, semantic, procedural, emotional, and meta memory layers' },
  { name: 'Bi-Temporal Knowledge Graph', category: 'memory', source: 'super-agent', description: 'Facts with valid-time + transaction-time, supersession, multi-hop DFS traversal' },
  { name: 'RAG (Retrieval Augmented Generation)', category: 'memory', source: 'core', description: 'Semantic search over stored knowledge with pgvector embeddings' },
  { name: 'Cross-User Learning', category: 'memory', source: 'super-agent', description: 'Learns patterns across users while preserving privacy' },

  // ── Code Intelligence ──
  { name: 'Codebase Indexing', category: 'code-intel', source: 'core', description: 'Indexes codebases for semantic search and understanding' },
  { name: 'Dependency Graph', category: 'code-intel', source: 'core', description: 'Maps dependencies between files, modules, and packages' },
  { name: 'Code Architecture Awareness', category: 'code-intel', source: 'core', description: 'Understands the architecture of the codebase it works with' },

  // ── Tools & Execution ──
  { name: 'Self-Forge', category: 'tools', source: 'core', description: 'Agent writes its own tools when it encounters a problem it doesn\'t have a tool for' },
  { name: '93 Built-in Tools', category: 'tools', source: 'core', description: 'Pre-built tools for files, code, web, databases, Docker, git, and more' },
  { name: 'MCP Protocol', category: 'tools', source: 'core', description: 'Model Context Protocol for external tool integration' },
  { name: 'Tool Composition', category: 'tools', source: 'core', description: 'Combines multiple tools into complex workflows' },
  { name: 'Browser Agent', category: 'tools', source: 'core', description: 'Web browsing and interaction automation' },
  { name: 'Tool Marketplace', category: 'tools', source: 'core', description: 'Plugin marketplace for community tools' },
  { name: 'DAG Workflow Engine', category: 'tools', source: 'super-agent', description: 'Topological batch execution with parallel branches, cycle detection, retry with backoff' },
  { name: 'Visual Workflow Builder', category: 'workflow', source: 'platform', description: 'Drag-and-drop node editor with triggers, conditions, and DAG export' },

  // ── Multimodal ──
  { name: 'Image Understanding', category: 'multimodal', source: 'core', description: 'Analyzes and understands images' },
  { name: 'PDF Understanding', category: 'multimodal', source: 'core', description: 'Extracts text and metadata from PDFs' },
  { name: 'PDF Table Extraction', category: 'multimodal', source: 'platform', description: 'Extracts structured table data from PDFs' },
  { name: 'Code Screenshot OCR', category: 'multimodal', source: 'platform', description: 'Extracts editable code from screenshots' },
  { name: 'Diagram-to-Code', category: 'multimodal', source: 'platform', description: 'Converts whiteboard/diagram images to code' },
  { name: 'Chart Understanding', category: 'multimodal', source: 'platform', description: 'Extracts data from charts and graphs' },
  { name: 'Live Screen Monitoring', category: 'multimodal', source: 'platform', description: 'Continuous screenshot capture with vision analysis and proactive alerts' },

  // ── Voice ──
  { name: 'Whisper STT', category: 'voice', source: 'core', description: 'Speech-to-text transcription via OpenAI Whisper' },
  { name: 'OpenAI TTS', category: 'voice', source: 'core', description: 'Text-to-speech synthesis via OpenAI' },
  { name: 'ElevenLabs TTS', category: 'voice', source: 'platform', description: 'Voice cloning and multilingual TTS via ElevenLabs' },
  { name: 'Real-Time Voice Conversation', category: 'voice', source: 'platform', description: 'WebSocket-based streaming STT/LLM/TTS with interruption support' },
  { name: 'Emotion Detection', category: 'voice', source: 'core', description: 'Detects emotions in voice and text' },
  { name: 'Conversation Manager', category: 'voice', source: 'core', description: 'Manages conversation context and turn-taking' },

  // ── Swarm & Collaboration ──
  { name: 'Swarm Orchestration', category: 'swarm', source: 'core', description: 'Multi-agent task decomposition and parallel execution' },
  { name: 'Sub-Agent Spawner', category: 'swarm', source: 'core', description: 'Spawns specialized sub-agents for subtasks' },
  { name: 'Dynamic Agent Factory', category: 'swarm', source: 'core', description: 'Creates agents on-the-fly based on required capabilities' },
  { name: 'Real-time Collaboration', category: 'swarm', source: 'core', description: 'Multiple agents work simultaneously with shared workspace' },
  { name: 'Dynamic Swarm Topology', category: 'swarm', source: 'platform', description: 'Auto-decides agent count, emergent specialization, mid-task reconfiguration' },
  { name: 'Collective Memory Pool', category: 'swarm', source: 'platform', description: 'Shared memory across swarm agents with real-time sync and conflict resolution' },
  { name: 'A2A Federation', category: 'swarm', source: 'platform', description: 'Active task delegation, skill exchange, and federated learning across agents' },
  { name: 'Peer Review + Voting', category: 'swarm', source: 'core', description: 'Multi-agent peer review with voting systems' },

  // ── Learning & Evolution ──
  { name: 'Experience Collector', category: 'learning', source: 'core', description: 'Collects and stores execution experiences for learning' },
  { name: 'Prompt Optimizer', category: 'learning', source: 'core', description: 'Optimizes prompts based on past performance' },
  { name: 'Strategy Tuner', category: 'learning', source: 'core', description: 'Tunes strategy selection based on outcomes' },
  { name: 'Meta-Learning Optimizer', category: 'learning', source: 'super-agent', description: 'Learns how to learn — optimizes the learning process itself' },
  { name: 'Heuristic Extractor', category: 'learning', source: 'super-agent', description: 'Extracts heuristics from successful runs' },
  { name: 'Learned Context Compression', category: 'learning', source: 'evolution', description: 'LLM-based context scoring and intelligent compression with budget manager' },
  { name: 'Meta-Evolution Layer', category: 'evolution', source: 'evolution', description: 'Self-modifying improvement prompt, A/B testing, cross-domain transfer, evolution archive with rollback' },
  { name: 'GitHub Mining', category: 'evolution', source: 'evolution', description: 'Searches GitHub for repos, extracts code patterns, crystallizes them into permanent skills' },
  { name: 'Zero-Data Co-Evolution', category: 'evolution', source: 'evolution', description: 'Curriculum agent + executor + co-evolution loop — pure self-play, no human data needed' },
  { name: 'Self-Evolving Code', category: 'evolution', source: 'cosmic', description: 'Autonomous code improvement with fitness function, auto-rollback, and safety-critical file protection' },
  { name: 'Infinite Self-Play', category: 'evolution', source: 'cosmic', description: 'Infinite curriculum generator, self-play arena, open-ended skill discovery, evolutionary archive' },

  // ── Safety ──
  { name: 'TRIAD Safety Guardrail', category: 'safety', source: 'core', description: '3-way safety decisions: proceed, refuse, or update (revise plan)' },
  { name: 'Self-Evolving Safety Memory', category: 'safety', source: 'super-agent', description: 'Contrastive safety cells — harmful patterns paired with benign counterparts' },
  { name: 'Anti-Sycophancy', category: 'safety', source: 'super-agent', description: 'Detects and mitigates sycophantic behavior — flattery detection, dissent protocol' },
  { name: 'Multi-Layer Guardrails', category: 'safety', source: 'super-agent', description: '5-layer defense: input validation → injection detection → PII filter → content filter → output validation' },
  { name: 'Sandbox Execution', category: 'safety', source: 'core', description: 'Docker container sandbox with CapDrop ALL, readonly rootfs, no network' },

  // ── Consciousness (Cosmic) ──
  { name: 'MIRROR Consciousness', category: 'consciousness', source: 'cosmic', description: 'Inner monologue, cognitive controller, reconstructed self-model, episodic buffer — HOT-3 consciousness' },
  { name: 'Normative Agency', category: 'consciousness', source: 'cosmic', description: 'Forms commitments, detects conflicts, revises under error' },
  { name: 'Introspective Awareness', category: 'consciousness', source: 'cosmic', description: 'Self-model, bias detection (8 types), metacognition checks, confidence calibration' },
  { name: 'Digital Twin', category: 'consciousness', source: 'cosmic', description: 'Environment graph, what-if engine, causal graph, anomaly detection, predictive alerts' },
  { name: 'RL Environment', category: 'consciousness', source: 'cosmic', description: 'Q-learning, episodic training, convergence detection — practices in simulation before reality' },
  { name: 'Temporal Intelligence', category: 'consciousness', source: 'cosmic', description: 'Past analysis, future prediction, timeline branching, temporal reasoning, proactive scheduling' },
  { name: 'Multimodal Dreams', category: 'consciousness', source: 'cosmic', description: 'Visual/code/cross-modal dreams, hypothesis generation, memory consolidation, insight propagation' },

  // ── Creative ──
  { name: 'Creative Engine', category: 'creative', source: 'cosmic', description: 'Image (DALL-E/SD), music (Suno/Tone.js), video, generative art (p5.js/GLSL/Three.js), multi-agent critique' },
  { name: 'Style Learning', category: 'creative', source: 'cosmic', description: 'Learns user aesthetic preferences over time' },
  { name: 'Autonomous Gardener', category: 'creative', source: 'cosmic', description: 'Background creative steward — manages taste evolution, plants creative seeds, harvests emergence' },

  // ── Economy ──
  { name: 'Agent Economy (ComputeCredits)', category: 'economy', source: 'cosmic', description: 'Internal currency, skill marketplace, escrow-protected contracts, price negotiation, reputation system' },
  { name: 'Autonomous Trading', category: 'economy', source: 'cosmic', description: 'RL-based trading simulation with user permission' },
  { name: 'Hive Mind', category: 'economy', source: 'cosmic', description: 'Distributed collective intelligence, shared consciousness (CRDT), quorum voting, emergent specialization' },

  // ── Constitution ──
  { name: 'Titan Constitution', category: 'safety', source: 'cosmic', description: '7 core principles (2 immutable), 67% supermajority amendments, LLM deliberation, conflict resolution' },

  // ── Quantum ──
  { name: 'Quantum-Inspired Optimization', category: 'reasoning', source: 'cosmic', description: 'Superposition strategy selection, tensor networks, entanglement-based memory, quantum annealing' },

  // ── Translation ──
  { name: 'Universal Translator', category: 'communication', source: 'cosmic', description: '140+ languages, code translation with round-trip verification, protocol/modal/domain translation, cultural adaptation' },

  // ── Autonomous ──
  { name: 'Autonomous Loop', category: 'autonomous', source: 'core', description: '24/7 autonomous task execution with checkpoint/resume' },
  { name: 'Proactive Intelligence', category: 'autonomous', source: 'mythical', description: 'Pattern monitoring, proactive suggestions (3/day, DND), anticipatory task preparation' },
  { name: 'Causal World Model', category: 'autonomous', source: 'mythical', description: 'Causal graph, what-if simulation, root cause analysis across dependency chains' },
  { name: 'Self-Modifying Architecture', category: 'autonomous', source: 'mythical', description: 'Restructures own agent topology, switches coordination patterns, builds new archetypes' },
  { name: 'Conversational Code Editing', category: 'autonomous', source: 'mythical', description: 'Real-time code edits with live diff preview and collaborative editing' },

  // ── Privacy & Edge ──
  { name: 'On-Device LLM (Ollama)', category: 'privacy', source: 'platform', description: 'Local LLM support via Ollama with auto-detection' },
  { name: 'Smart Model Routing (Local/Cloud)', category: 'privacy', source: 'platform', description: 'Simple→local, complex→cloud, sensitive→always local' },
  { name: 'Privacy Mode', category: 'privacy', source: 'platform', description: 'Sensitive tasks never leave the device' },
  { name: 'Federated Learning', category: 'privacy', source: 'platform', description: 'Encrypted model diffs shared across Titan instances — privacy-preserving' },

  // ── Integrations ──
  { name: 'Telegram Bot', category: 'integrations', source: 'core', description: 'Full Telegram bot with rich UI, inline keyboards, voice messages' },
  { name: 'WhatsApp Integration', category: 'integrations', source: 'core', description: 'WhatsApp Business API integration' },
  { name: 'Slack Integration', category: 'integrations', source: 'core', description: 'Slack bot integration' },
  { name: 'Discord Integration', category: 'integrations', source: 'core', description: 'Discord bot integration' },
  { name: 'A2A Protocol v1.0', category: 'integrations', source: 'super-agent', description: 'Signed agent cards, multi-tenancy, 4 transports (HTTP/SSE/gRPC/WebSocket)' },
  { name: 'SKILL.md Registry', category: 'integrations', source: 'super-agent', description: 'Standardized skill registration and discovery' },
  { name: 'MCP Governance', category: 'integrations', source: 'super-agent', description: 'Per-server policies, permissions, rate limiting, audit logging, OAuth2' },
  { name: 'Web Intelligence', category: 'integrations', source: 'super-agent', description: 'Web scraping and intelligence gathering' },
  { name: 'WebMCP Bridge', category: 'integrations', source: 'super-agent', description: 'Bridge between web and MCP protocol' },
  { name: 'Computer Use (Desktop Bridge)', category: 'integrations', source: 'platform', description: '12 desktop tools — shell, files, screenshots, app automation, keyboard, clipboard' },

  // ── Metacognition ──
  { name: 'Metacognition', category: 'consciousness', source: 'core', description: 'Monitors own reasoning confidence and flags uncertainty' },
  { name: 'Curiosity Engine', category: 'consciousness', source: 'super-agent', description: 'Generates curiosity-driven exploration tasks' },
  { name: 'Emotional Intelligence', category: 'consciousness', source: 'super-agent', description: 'Detects and responds to user emotional state' },
  { name: 'Theory of Mind', category: 'consciousness', source: 'super-agent', description: 'Models other agents\' and users\' mental states' },
  { name: 'Meta-Agent', category: 'consciousness', source: 'core', description: 'Analyzes own runs and proposes improvements to prompts, strategies, and tool usage' },
  { name: 'Self-Improver', category: 'consciousness', source: 'core', description: 'Proposes concrete improvements based on past performance' },
];

let globalRegistry: CapabilityRegistry | null = null;

export class CapabilityRegistry {
  private capabilities: Map<string, Capability> = new Map();
  private envFlags: Map<string, boolean> = new Map();

  constructor() {
    this.registerDefaults();
  }

  private registerDefaults(): void {
    for (const cap of ALL_CAPABILITIES) {
      const id = cap.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      this.capabilities.set(id, {
        ...cap,
        id,
        enabled: true,
      });
      crRepo.upsert(id, cap.name, true, cap).catch((err) => log.error({ err }, 'DB write failed'));
    }

    // Check env flags for disabled capabilities
    this.checkEnvFlags();

    log.info({ total: this.capabilities.size }, 'capability registry initialized');
  }

  private checkEnvFlags(): void {
    const disableMap: Record<string, string> = {
      'TITAN_COSMIC_MIRROR_ENABLED': 'mirror-consciousness',
      'TITAN_AUTONOMOUS_LOOP_ENABLED': 'autonomous-loop',
      'TITAN_PRIVACY_MODE': 'privacy-mode',
      'TITAN_MYTHICAL_ENABLED': 'proactive-intelligence',
    };

    for (const [envVar, capId] of Object.entries(disableMap)) {
      const value = process.env[envVar];
      if (value === 'false' || value === '0') {
        const cap = this.capabilities.get(capId);
        if (cap) cap.enabled = false;
      }
    }
  }

  register(capability: Omit<Capability, 'id'> & { id?: string }): void {
    const id = capability.id ?? capability.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    this.capabilities.set(id, { ...capability, id });
    crRepo.upsert(id, capability.name, capability.enabled ?? true, capability).catch((err) => log.error({ err }, 'DB write failed'));
    log.info({ id, name: capability.name }, 'capability registered');
  }

  enable(id: string): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;
    cap.enabled = true;
    return true;
  }

  disable(id: string): boolean {
    const cap = this.capabilities.get(id);
    if (!cap) return false;
    cap.enabled = false;
    return true;
  }

  get(id: string): Capability | null {
    return this.capabilities.get(id) ?? null;
  }

  getAll(): Capability[] {
    return [...this.capabilities.values()];
  }

  getEnabled(): Capability[] {
    return [...this.capabilities.values()].filter((c) => c.enabled);
  }

  getByCategory(category: CapabilityCategory): Capability[] {
    return [...this.capabilities.values()].filter((c) => c.category === category);
  }

  getBySource(source: Capability['source']): Capability[] {
    return [...this.capabilities.values()].filter((c) => c.source === source);
  }

  getSnapshot(): CapabilitySnapshot {
    const all = [...this.capabilities.values()];
    const byCategory: Record<string, number> = {};
    const bySource: Record<string, number> = {};

    for (const cap of all) {
      byCategory[cap.category] = (byCategory[cap.category] ?? 0) + 1;
      bySource[cap.source] = (bySource[cap.source] ?? 0) + 1;
    }

    let toolsCount = 0;
    try {
      toolsCount = getGlobalToolRegistry().size();
    } catch {
      // Registry might not be initialized in some contexts
    }

    return {
      total: all.length,
      enabled: all.filter((c) => c.enabled).length,
      byCategory,
      bySource,
      capabilities: all,
      toolsCount,
    };
  }

  generateSelfDescription(lang: 'en' | 'ar' = 'en'): string {
    const snapshot = this.getSnapshot();
    const enabled = snapshot.capabilities.filter((c) => c.enabled);

    if (lang === 'ar') {
      const categories: Record<string, string> = {
        reasoning: 'الاستدلال',
        memory: 'الذاكرة',
        tools: 'الأدوات',
        'code-intel': 'ذكاء الكود',
        multimodal: 'متعدد الوسائط',
        voice: 'الصوت',
        swarm: 'السرب',
        learning: 'التعلم',
        safety: 'الأمان',
        consciousness: 'الوعي',
        creative: 'الإبداع',
        economy: 'الاقتصاد',
        evolution: 'التطور',
        communication: 'التواصل',
        autonomous: 'الاستقلالية',
        privacy: 'الخصوصية',
        workflow: 'سير العمل',
        integrations: 'التكاملات',
      };

      const lines: string[] = [
        `أنا تايتن — نظام وكيل ذاتي متقدم. لدي ${enabled.length} قدرة مفعلة في ${Object.keys(snapshot.byCategory).length} فئة:`,
        '',
      ];

      for (const [cat, _count] of Object.entries(snapshot.byCategory)) {
        const catName = categories[cat] ?? cat;
        const catCaps = enabled.filter((c) => c.category === cat);
        if (catCaps.length > 0) {
          lines.push(`**${catName}** (${catCaps.length}):`);
          for (const cap of catCaps) {
            lines.push(`  - ${cap.name}: ${cap.description}`);
          }
          lines.push('');
        }
      }

      lines.push(`لدي أيضًا ${snapshot.toolsCount} أداة مدمجة.`);
      return lines.join('\n');
    }

    const lines: string[] = [
      `I am Titan — an advanced autonomous agent system. I have ${enabled.length} enabled capabilities across ${Object.keys(snapshot.byCategory).length} categories:`,
      '',
    ];

    for (const [cat, _count] of Object.entries(snapshot.byCategory)) {
      const catCaps = enabled.filter((c) => c.category === cat);
      if (catCaps.length > 0) {
        lines.push(`**${cat.toUpperCase()}** (${catCaps.length}):`);
        for (const cap of catCaps) {
          lines.push(`  - ${cap.name}: ${cap.description}`);
        }
        lines.push('');
      }
    }

    lines.push(`I also have ${snapshot.toolsCount} built-in tools available.`);
    return lines.join('\n');
  }

  generateSystemPromptSection(): string {
    return this.generateCompactPromptSection();
  }

  /**
   * COMPACT — ~100 tokens. Default for system prompt injection.
   * Only category names + counts, no individual capability descriptions.
   */
  generateCompactPromptSection(): string {
    const snapshot = this.getSnapshot();
    const enabled = snapshot.capabilities.filter((c) => c.enabled);

    const byCat: Record<string, number> = {};
    for (const cap of enabled) {
      byCat[cap.category] = (byCat[cap.category] ?? 0) + 1;
    }

    const catList = Object.entries(byCat)
      .map(([cat, count]) => `${cat}(${count})`)
      .join(', ');

    return [
      `You are Titan — ${enabled.length} capabilities [${catList}], ${snapshot.toolsCount} tools.`,
      'If asked what you can do, use the `list_capabilities` tool for details.',
      'If you need a missing capability, use Self-Forge to create it.',
    ].join(' ');
  }

  /**
   * SUMMARY — ~300 tokens. For when Titan needs to know capability names
   * but not full descriptions. Triggered by task classification.
   */
  generateSummaryPromptSection(relevantCategories?: string[]): string {
    const snapshot = this.getSnapshot();
    const enabled = snapshot.capabilities.filter((c) => c.enabled);

    const byCat: Record<string, Capability[]> = {};
    for (const cap of enabled) {
      if (relevantCategories && !relevantCategories.includes(cap.category)) continue;
      if (!byCat[cap.category]) byCat[cap.category] = [];
      byCat[cap.category].push(cap);
    }

    const lines: string[] = [
      `--- Titan Capabilities (${enabled.length} total, ${snapshot.toolsCount} tools) ---`,
    ];

    for (const [cat, caps] of Object.entries(byCat)) {
      lines.push(`[${cat.toUpperCase()}] ${caps.map((c) => c.name).join(', ')}`);
    }

    return lines.join('\n');
  }

  /**
   * FULL — ~3000+ tokens. Only for explicit "what can you do?" queries
   * or when the `list_capabilities` tool is called.
   */
  generateFullPromptSection(): string {
    const snapshot = this.getSnapshot();
    const enabled = snapshot.capabilities.filter((c) => c.enabled);

    const byCat: Record<string, Capability[]> = {};
    for (const cap of enabled) {
      if (!byCat[cap.category]) byCat[cap.category] = [];
      byCat[cap.category].push(cap);
    }

    const lines: string[] = [
      '--- Titan Capabilities (Self-Awareness) ---',
      `You are Titan, an advanced autonomous agent with ${enabled.length} capabilities across ${Object.keys(byCat).length} categories.`,
      `You have ${snapshot.toolsCount} built-in tools available.`,
      '',
      'Your capabilities include:',
    ];

    for (const [cat, caps] of Object.entries(byCat)) {
      lines.push(`[${cat.toUpperCase()}]`);
      for (const cap of caps) {
        lines.push(`  - ${cap.name}: ${cap.description}`);
      }
    }

    lines.push('');
    lines.push('Use these capabilities proactively. When a task fits one of your capabilities, leverage it.');
    lines.push('If you need a capability you don\'t have, use Self-Forge to create a new tool.');

    return lines.join('\n');
  }

  /**
   * TASK-AWARE — injects only capabilities relevant to the current task.
   * Uses keyword matching to determine relevant categories.
   * ~200-400 tokens depending on task.
   */
  generateTaskAwareSection(userMessage: string): string {
    const relevantCats = this.classifyTaskCategories(userMessage);
    if (relevantCats.length === 0) {
      return this.generateCompactPromptSection();
    }
    return this.generateSummaryPromptSection(relevantCats);
  }

  private classifyTaskCategories(message: string): string[] {
    const lower = message.toLowerCase();
    const cats: string[] = [];

    const patterns: Array<[string, RegExp]> = [
      ['reasoning', /\b(think|reason|plan|analyz|solve|decid|strateg|hypothes|debug|fix|bug)/],
      ['memory', /\b(remember|recall|memory|history|past|forget|knowledge)/],
      ['code-intel', /\b(code|function|class|module|import|refactor|architect|dependency)/],
      ['multimodal', /\b(image|pdf|screenshot|chart|diagram|table|visual|picture|photo)/],
      ['voice', /\b(voice|audio|speak|talk|listen|transcri|tts|stt|sound)/],
      ['swarm', /\b(agent|swarm|parallel|delegate|collaborat|team|spawn|multi-agent)/],
      ['learning', /\b(learn|improve|optimi|train|feedback|experience|adapt)/],
      ['safety', /\b(safe|guard|protect|secur|danger|risk|harm|destruct)/],
      ['consciousness', /\b(self|aware|introspect|metacogn|think about|reflect|conscious)/],
      ['creative', /\b(creat|generat|art|music|image|video|design|aesthetic)/],
      ['economy', /\b(trad|credit|economy|market|buy|sell|price|escrow|reputation)/],
      ['evolution', /\b(evolv|self-improv|mutat|fitness|github|mine|co-evol|curriculum)/],
      ['communication', /\b(translat|language|message|chat|communicat|protocol)/],
      ['autonomous', /\b(autonom|proactive|schedule|automat|loop|self-run|causal)/],
      ['privacy', /\b(privat|local|offline|ollama|sensitive|confidential|encrypt)/],
      ['workflow', /\b(workflow|trigger|cron|webhook|pipeline|dag|flow|automat)/],
      ['integrations', /\b(telegram|whatsapp|slack|discord|integration|bot|webhook)/],
      ['tools', /\b(tool|forge|mcp|browser|marketplace|plugin|execute)/],
    ];

    for (const [cat, regex] of patterns) {
      if (regex.test(lower)) cats.push(cat);
    }

    return cats;
  }

  hasCapability(name: string): boolean {
    const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const cap = this.capabilities.get(id);
    return cap?.enabled ?? false;
  }

  getStats(): { total: number; enabled: number; disabled: number; categories: number; tools: number } {
    const all = [...this.capabilities.values()];
    return {
      total: all.length,
      enabled: all.filter((c) => c.enabled).length,
      disabled: all.filter((c) => !c.enabled).length,
      categories: new Set(all.map((c) => c.category)).size,
      tools: getGlobalToolRegistry().size(),
    };
  }

  reset(): void {
    this.capabilities.clear();
    this.registerDefaults();
  }
}

export function getGlobalCapabilityRegistry(): CapabilityRegistry {
  if (!globalRegistry) {
    globalRegistry = new CapabilityRegistry();
    incCounter('capability_registry_init', 'Capability registry initialized', 1);
  }
  return globalRegistry;
}

export function resetGlobalCapabilityRegistry(): void {
  globalRegistry = null;
}
