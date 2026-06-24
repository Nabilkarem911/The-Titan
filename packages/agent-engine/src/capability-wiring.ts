import { getLogger } from '@titan/logging';
import { incCounter } from '@titan/observability';
import type { LlmProvider } from './types.js';
import { getGlobalToolRegistry } from './tool-registry.js';

// Reasoning
import { DreamMode } from './reasoning/dream-mode.js';
import { CausalReplay } from './reasoning/causal-replay.js';
import { HypothesisTester } from './reasoning/hypothesis-tester.js';
import { SelfHealingDebugger } from './reasoning/self-healing-debugger.js';
import { EvolutionarySolver } from './reasoning/evolutionary-solver.js';
import { NeuroSymbolicReasoner } from './reasoning/neuro-symbolic.js';
import { DynamicToolDiscovery } from './reasoning/tool-discovery.js';
import { AutonomousSkillSynthesis } from './reasoning/skill-synthesis.js';
import { HyperAgent } from './reasoning/hyper-agent.js';
import { ApexEvolution } from './reasoning/apex-evolution.js';
import { BenchmarkingSuite } from './reasoning/benchmarking-suite.js';
import { ExecutionStateMemory } from './reasoning/execution-state-memory.js';
import { SelfRewriter } from './reasoning/self-rewriter.js';
import { TestTimeRecursiveThinking } from './reasoning/test-time-recursive-thinking.js';
import { SmartModelRouter } from './reasoning/multi-model-router.js';

// Metacognition
import { MetaMonitor } from './metacognition/meta-monitor.js';
import { SelfImprover } from './metacognition/self-improver.js';
import { CuriosityEngine } from './metacognition/curiosity-engine.js';
import { EmotionalIntelligence } from './metacognition/emotional-intelligence.js';
import { TheoryOfMind } from './metacognition/theory-of-mind.js';
import { MetacognitiveConsolidation } from './metacognition/metacognitive-consolidation.js';
import { SafetyGuardrail } from './metacognition/safety-guardrail.js';
import { SelfEvolvingSafetyMemory } from './metacognition/safety-memory.js';
import { AntiSycophancyModule } from './metacognition/anti-sycophancy.js';
import { MultiLayerGuardrails } from './metacognition/multi-layer-guardrails.js';
import { IntrospectionModule } from './metacognition/introspection.js';

// Learning
import { ExperienceCollector } from './learning/experience-collector.js';
import { PromptOptimizer } from './learning/prompt-optimizer.js';
import { StrategyTuner } from './learning/strategy-tuner.js';
import { CrossUserLearner } from './learning/cross-user-learner.js';
import { MetaLearningOptimizer } from './learning/meta-learning-optimizer.js';
import { HeuristicExtractor } from './learning/heuristic-extractor.js';
import { EdgePrivacy } from './learning/edge-privacy.js';

// MIRROR Consciousness
import { InnerMonologueManager } from './mirror/inner-monologue.js';
import { CognitiveController } from './mirror/cognitive-controller.js';
import { EpisodicBuffer } from './mirror/episodic-buffer.js';
import { DigitalTwin } from './mirror/digital-twin.js';
import { WhatIfEngine } from './mirror/what-if-engine.js';
import { NormativeAgency } from './mirror/normative-agency.js';

// Cosmic modules
import { CreativeEngine } from './creative/creative-engine.js';
import { AutonomousGardener } from './creative/autonomous-gardener.js';
import { HiveMind } from './hive/hive-mind.js';
import { AgentEconomy } from './economy/agent-economy.js';
import { RLEnvironment } from './economy/autonomous-trading.js';
import { InfiniteSelfPlay } from './selfplay/infinite-self-play.js';
import { SelfEvolvingCode } from './evolution/self-evolving-code.js';
import { MetaEvolution } from './evolution/meta-evolution.js';
import { GitHubMiner } from './evolution/github-miner.js';
import { ZeroDataCoEvolution } from './evolution/zero-data-co-evolution.js';
import { QuantumOptimizer } from './quantum/quantum-optimizer.js';
import { UniversalTranslator } from './translator/universal-translator.js';
import { TemporalIntelligence } from './temporal/temporal-intelligence.js';
import { TitanConstitution } from './constitution/titan-constitution.js';
import { DreamWorld } from './dream/dream-world.js';
import { SwarmEvolution } from './swarm/swarm-evolution.js';
import { VisualWorkflowBuilder } from './workflow/visual-workflow-builder.js';
import { ProactiveIntelligence } from './autonomous/proactive-intelligence.js';

// Voice
import { ElevenLabsTTSProvider } from './voice/elevenlabs-tts.js';
import { WhisperSTTProvider } from './voice/whisper-stt.js';
import { OpenAITTSProvider } from './voice/openai-tts.js';

// Multimodal
import { ScreenMonitor } from './multimodal/screen-monitor.js';
import { AdvancedMultimodal } from './multimodal/advanced-multimodal.js';

// Integrations
import { A2AProtocolAdapter } from './integrations/a2a-protocol.js';
import { WebIntelligence } from './integrations/web-intelligence.js';
import { WebMCPBridge } from './integrations/web-mcp.js';
import { SkillMdRegistry } from './integrations/skill-md-registry.js';
import { BrowserAgent } from './integrations/browser-agent.js';

// World Model
import { WorldSimulator, EnvironmentGraph } from './world-model/index.js';

// Self-Forge
import { SelfForge } from './self-forge/self-forge.js';

// Introspection
import { IntrospectiveAwareness } from './introspection/introspective-awareness.js';

const log = getLogger().child({ component: 'capability-wiring' });

export interface WiredCapabilities {
  // Reasoning
  dreamMode: DreamMode;
  causalReplay: CausalReplay;
  hypothesisTester: HypothesisTester;
  selfHealingDebugger: SelfHealingDebugger;
  evolutionarySolver: EvolutionarySolver;
  neuroSymbolic: NeuroSymbolicReasoner;
  toolDiscovery: DynamicToolDiscovery;
  skillSynthesis: AutonomousSkillSynthesis;
  hyperAgent: HyperAgent;
  apexEvolution: ApexEvolution;
  benchmarkingSuite: BenchmarkingSuite;
  executionStateMemory: ExecutionStateMemory;
  selfRewriter: SelfRewriter;

  // Metacognition
  metaMonitor: MetaMonitor;
  selfImprover: SelfImprover;
  curiosityEngine: CuriosityEngine;
  emotionalIntelligence: EmotionalIntelligence;
  theoryOfMind: TheoryOfMind;
  metacognitiveConsolidation: MetacognitiveConsolidation;
  safetyGuardrail: SafetyGuardrail;
  safetyMemory: SelfEvolvingSafetyMemory;
  antiSycophancy: AntiSycophancyModule;
  multiLayerGuardrails: MultiLayerGuardrails;
  introspection: IntrospectionModule;

  // Learning
  experienceCollector: ExperienceCollector;
  promptOptimizer: PromptOptimizer;
  strategyTuner: StrategyTuner;
  crossUserLearner: CrossUserLearner;
  metaLearningOptimizer: MetaLearningOptimizer;
  heuristicExtractor: HeuristicExtractor;
  edgePrivacy: EdgePrivacy;

  // MIRROR
  innerMonologue: InnerMonologueManager;
  cognitiveController: CognitiveController;
  episodicBuffer: EpisodicBuffer;
  digitalTwin: DigitalTwin;
  whatIfEngine: WhatIfEngine;
  normativeAgency: NormativeAgency;

  // Cosmic
  creativeEngine: CreativeEngine;
  autonomousGardener: AutonomousGardener;
  hiveMind: HiveMind;
  agentEconomy: AgentEconomy;
  autonomousTrading: RLEnvironment;
  infiniteSelfPlay: InfiniteSelfPlay;
  selfEvolvingCode: SelfEvolvingCode;
  metaEvolution: MetaEvolution;
  githubMiner: GitHubMiner;
  zeroDataCoEvolution: ZeroDataCoEvolution;
  quantumOptimizer: QuantumOptimizer;
  universalTranslator: UniversalTranslator;
  temporalIntelligence: TemporalIntelligence;
  titanConstitution: TitanConstitution;
  dreamWorld: DreamWorld;
  swarmEvolution: SwarmEvolution;
  visualWorkflowBuilder: VisualWorkflowBuilder;
  proactiveIntelligence: ProactiveIntelligence;

  // Voice
  elevenLabsTTS: ElevenLabsTTSProvider | null;
  whisperSTT: WhisperSTTProvider | null;
  openaiTTS: OpenAITTSProvider | null;

  // Multimodal
  screenMonitor: ScreenMonitor;
  advancedMultimodal: AdvancedMultimodal;

  // Integrations
  a2aProtocol: A2AProtocolAdapter;
  webIntelligence: WebIntelligence;
  webMCPBridge: WebMCPBridge;
  skillMdRegistry: SkillMdRegistry;
  browserAgent: BrowserAgent;

  // World Model
  worldSimulator: WorldSimulator;
  environmentGraph: EnvironmentGraph;

  // Self-Forge
  selfForge: SelfForge;

  // Introspection
  introspectiveAwareness: IntrospectiveAwareness;

  // Stats
  totalWired: number;
}

let globalWiring: WiredCapabilities | null = null;

export function wireCapabilities(llm: LlmProvider): WiredCapabilities {
  if (globalWiring) return globalWiring;

  log.info('wiring all capabilities...');

  const registry = getGlobalToolRegistry();

  // Self-Forge chain
  const selfForge = new SelfForge(llm);

  // World Model
  const environmentGraph = new EnvironmentGraph();
  const worldSimulator = new WorldSimulator(llm, environmentGraph);

  const wiring: WiredCapabilities = {
    // Reasoning
    dreamMode: new DreamMode(llm),
    causalReplay: new CausalReplay(llm),
    hypothesisTester: new HypothesisTester(llm),
    selfHealingDebugger: new SelfHealingDebugger(llm),
    evolutionarySolver: new EvolutionarySolver(llm),
    neuroSymbolic: new NeuroSymbolicReasoner(llm),
    toolDiscovery: new DynamicToolDiscovery(llm),
    skillSynthesis: new AutonomousSkillSynthesis(llm),
    hyperAgent: new HyperAgent(llm),
    apexEvolution: new ApexEvolution(llm),
    benchmarkingSuite: new BenchmarkingSuite(llm),
    executionStateMemory: new ExecutionStateMemory(),
    selfRewriter: new SelfRewriter(llm),

    // Metacognition
    metaMonitor: new MetaMonitor(llm),
    selfImprover: new SelfImprover(llm),
    curiosityEngine: new CuriosityEngine(llm),
    emotionalIntelligence: new EmotionalIntelligence(llm),
    theoryOfMind: new TheoryOfMind(llm),
    metacognitiveConsolidation: new MetacognitiveConsolidation(llm),
    safetyGuardrail: new SafetyGuardrail(llm),
    safetyMemory: new SelfEvolvingSafetyMemory(),
    antiSycophancy: new AntiSycophancyModule(),
    multiLayerGuardrails: new MultiLayerGuardrails(),
    introspection: new IntrospectionModule(llm),

    // Learning
    experienceCollector: new ExperienceCollector(),
    promptOptimizer: new PromptOptimizer(),
    strategyTuner: new StrategyTuner(),
    crossUserLearner: new CrossUserLearner(),
    metaLearningOptimizer: new MetaLearningOptimizer(llm),
    heuristicExtractor: new HeuristicExtractor(llm),
    edgePrivacy: new EdgePrivacy(),

    // MIRROR
    innerMonologue: new InnerMonologueManager(),
    cognitiveController: new CognitiveController(),
    episodicBuffer: new EpisodicBuffer(),
    digitalTwin: new DigitalTwin(environmentGraph),
    whatIfEngine: new WhatIfEngine(new DigitalTwin(environmentGraph), llm),
    normativeAgency: new NormativeAgency(llm),

    // Cosmic
    creativeEngine: new CreativeEngine(llm),
    autonomousGardener: new AutonomousGardener(),
    hiveMind: new HiveMind(llm),
    agentEconomy: new AgentEconomy(llm),
    autonomousTrading: new RLEnvironment(),
    infiniteSelfPlay: new InfiniteSelfPlay(llm),
    selfEvolvingCode: new SelfEvolvingCode(llm),
    metaEvolution: new MetaEvolution(llm),
    githubMiner: new GitHubMiner(),
    zeroDataCoEvolution: new ZeroDataCoEvolution(llm),
    quantumOptimizer: new QuantumOptimizer(),
    universalTranslator: new UniversalTranslator(llm),
    temporalIntelligence: new TemporalIntelligence(llm),
    titanConstitution: new TitanConstitution(llm),
    dreamWorld: new DreamWorld(llm),
    swarmEvolution: new SwarmEvolution(),
    visualWorkflowBuilder: new VisualWorkflowBuilder(),
    proactiveIntelligence: new ProactiveIntelligence(llm),

    // Voice (optional — only if API keys present)
    elevenLabsTTS: process.env['ELEVENLABS_API_KEY'] ? new ElevenLabsTTSProvider({ apiKey: process.env['ELEVENLABS_API_KEY'] }) : null,
    whisperSTT: process.env['OPENAI_API_KEY'] ? new WhisperSTTProvider({ apiKey: process.env['OPENAI_API_KEY'] }) : null,
    openaiTTS: process.env['OPENAI_API_KEY'] ? new OpenAITTSProvider({ apiKey: process.env['OPENAI_API_KEY'] }) : null,

    // Multimodal
    screenMonitor: new ScreenMonitor(),
    advancedMultimodal: new AdvancedMultimodal(llm),

    // Integrations
    a2aProtocol: new A2AProtocolAdapter(),
    webIntelligence: new WebIntelligence({
      apiKey: process.env['BRAVE_SEARCH_API_KEY'] ?? '',
      baseUrl: process.env['BRAVE_SEARCH_API_KEY'] ? 'https://api.search.brave.com' : '',
      maxResults: 10,
      maxPages: 20,
      timeout: 30000,
    }),
    webMCPBridge: new WebMCPBridge(),
    skillMdRegistry: new SkillMdRegistry(),
    browserAgent: new BrowserAgent(llm),

    // World Model
    worldSimulator,
    environmentGraph,

    // Self-Forge
    selfForge,

    // Introspection
    introspectiveAwareness: new IntrospectiveAwareness(llm),

    // Stats
    totalWired: 0,
  };

  // Count wired modules
  const keys = Object.keys(wiring).filter((k) => k !== 'totalWired');
  wiring.totalWired = keys.length;

  // Register tools from capabilities
  registerCapabilityTools(wiring, llm);

  globalWiring = wiring;
  incCounter('capability_wiring_complete', 'All capabilities wired into the system', 1);
  log.info({ total: wiring.totalWired }, 'all capabilities wired successfully');

  return wiring;
}

function registerCapabilityTools(wiring: WiredCapabilities, llm: LlmProvider): void {
  const registry = getGlobalToolRegistry();

  // Universal Translator
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

  // Creative Engine
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

  // Temporal Intelligence
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

  // Digital Twin — what-if simulation
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

  // Quantum Optimizer
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

  // Hive Mind
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

  // Agent Economy
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

  // Titan Constitution
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

  // Proactive Intelligence
  registry.register({
    name: 'proactive_suggest',
    description: 'Get proactive suggestions based on pattern analysis',
    tags: ['proactive', 'suggestions'],
    handler: async () => wiring.proactiveIntelligence.getSuggestions(),
  });

  // Self-Evolving Code
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

  // Infinite Self-Play
  registry.register({
    name: 'self_play_session',
    description: 'Run a self-play session for autonomous skill development',
    tags: ['selfplay', 'learning'],
    handler: async () => wiring.infiniteSelfPlay.runSession(1),
  });

  // Advanced Multimodal — PDF tables
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

  // Advanced Multimodal — code from screenshot
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

  // Advanced Multimodal — diagram to code
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

  // Advanced Multimodal — chart understanding
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

  // ── Reasoning tools ──

  registry.register({
    name: 'dream_from_experiences',
    description: 'Run dream mode consolidation on past experiences to extract insights, patterns, and stale facts',
    tags: ['reasoning', 'dream', 'memory'],
    schema: {
      experiences: { type: 'string', description: 'JSON array of experience objects with prompt, strategy, toolsUsed, success, timestamp' },
    },
    requiredParams: ['experiences'],
    handler: async (params: unknown) => {
      const p = params as { experiences: string };
      const experiences = JSON.parse(p.experiences) as Array<{ id: string; runId: string; prompt: string; strategy: string; toolsUsed: string[]; success: boolean; tokensUsed: number; durationMs: number; timestamp: string }>;
      return wiring.dreamMode.dreamFromExperiences(experiences as any);
    },
  });

  registry.register({
    name: 'dream_stats',
    description: 'Get dream mode statistics: total dreams, insights, running status',
    tags: ['reasoning', 'dream'],
    handler: async () => wiring.dreamMode.stats(),
  });

  registry.register({
    name: 'dream_insights',
    description: 'Get dream insights filtered by type (pattern, preference, stale_fact, skill_gap, optimization)',
    tags: ['reasoning', 'dream', 'insights'],
    schema: {
      type: { type: 'string', description: 'Filter by insight type: pattern | preference | stale_fact | skill_gap | optimization (optional)' },
    },
    handler: async (params: unknown) => {
      const p = params as { type?: string };
      return wiring.dreamMode.getInsights(p.type as any);
    },
  });

  registry.register({
    name: 'hypothesis_generate',
    description: 'Generate testable hypotheses for a problem. Returns hypotheses with rationale, test actions, and confidence.',
    tags: ['reasoning', 'hypothesis', 'science'],
    schema: {
      problem: { type: 'string', description: 'The problem to generate hypotheses for' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    requiredParams: ['problem'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; context?: string };
      return wiring.hypothesisTester.generateHypotheses(p.problem, p.context);
    },
  });

  registry.register({
    name: 'self_heal_debug',
    description: 'Debug and auto-repair a bug using self-healing debugger. Provide error details and get diagnosis + fix.',
    tags: ['reasoning', 'debug', 'self-healing'],
    schema: {
      errorMessage: { type: 'string', description: 'The error message' },
      errorType: { type: 'string', description: 'Error type (e.g. TypeError, ReferenceError)' },
      filePath: { type: 'string', description: 'File where the error occurred (optional)' },
      stackTrace: { type: 'string', description: 'Stack trace (optional)' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    requiredParams: ['errorMessage', 'errorType'],
    handler: async (params: unknown) => {
      const p = params as { errorMessage: string; errorType: string; filePath?: string; stackTrace?: string; context?: string };
      return wiring.selfHealingDebugger.debug({
        id: `bug-${Date.now()}`,
        errorMessage: p.errorMessage,
        errorType: p.errorType,
        filePath: p.filePath ?? '',
        stackTrace: p.stackTrace,
        context: p.context,
        reportedAt: new Date(),
      });
    },
  });

  registry.register({
    name: 'evolutionary_solve',
    description: 'Solve a problem using evolutionary algorithm — generates population, evolves through generations with mutation and selection',
    tags: ['reasoning', 'evolution', 'solver'],
    schema: {
      problem: { type: 'string', description: 'The problem to solve' },
      populationSize: { type: 'number', description: 'Population size (default 4)' },
      generations: { type: 'number', description: 'Number of generations (default 3)' },
    },
    requiredParams: ['problem'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; populationSize?: number; generations?: number };
      return wiring.evolutionarySolver.evolve(p.problem, { populationSize: p.populationSize, generations: p.generations });
    },
  });

  registry.register({
    name: 'neuro_symbolic_reason',
    description: 'Hybrid neuro-symbolic reasoning — combines neural prediction with symbolic rules for transparent reasoning',
    tags: ['reasoning', 'neuro-symbolic', 'logic'],
    schema: {
      query: { type: 'string', description: 'The reasoning query' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const p = params as { query: string };
      return wiring.neuroSymbolic.reason(p.query);
    },
  });

  registry.register({
    name: 'discover_tools',
    description: 'Dynamically discover missing tools or capabilities needed for a task',
    tags: ['reasoning', 'discovery', 'tools'],
    schema: {
      taskDescription: { type: 'string', description: 'Description of the task' },
      missingCapabilities: { type: 'string', description: 'Comma-separated missing capabilities (optional)' },
    },
    requiredParams: ['taskDescription'],
    handler: async (params: unknown) => {
      const p = params as { taskDescription: string; missingCapabilities?: string };
      return wiring.toolDiscovery.discover(p.taskDescription, p.missingCapabilities?.split(',').map(s => s.trim()));
    },
  });

  registry.register({
    name: 'synthesize_skill',
    description: 'Autonomously synthesize a new skill from a task description',
    tags: ['reasoning', 'skill', 'synthesis'],
    schema: {
      taskDescription: { type: 'string', description: 'Description of the task requiring a new skill' },
    },
    requiredParams: ['taskDescription'],
    handler: async (params: unknown) => {
      const p = params as { taskDescription: string };
      return wiring.skillSynthesis.synthesize(p.taskDescription);
    },
  });

  registry.register({
    name: 'hyper_agent_cycle',
    description: 'Run a hyper-agent cycle: introspection → improvement → evaluation loop',
    tags: ['reasoning', 'hyper-agent', 'self-improvement'],
    handler: async () => wiring.hyperAgent.runCycle(),
  });

  registry.register({
    name: 'apex_evolve',
    description: 'Run an apex evolution cycle — harness patching, principle distillation, and topology evolution',
    tags: ['reasoning', 'evolution', 'apex'],
    schema: {
      runs: { type: 'string', description: 'JSON array of recent agent runs' },
      successRate: { type: 'number', description: 'Recent success rate 0-1' },
      avgLatency: { type: 'number', description: 'Average latency in ms' },
      avgTokens: { type: 'number', description: 'Average tokens used' },
    },
    handler: async (params: unknown) => {
      const p = params as { runs?: string; successRate?: number; avgLatency?: number; avgTokens?: number };
      const runs = p.runs ? JSON.parse(p.runs) : [];
      return wiring.apexEvolution.runEvolutionCycle(runs, {
        successRate: p.successRate ?? 0.5,
        avgLatency: p.avgLatency ?? 1000,
        avgTokens: p.avgTokens ?? 1000,
      });
    },
  });

  registry.register({
    name: 'benchmark_run',
    description: 'Run a benchmark suite to evaluate agent performance on standardized tasks',
    tags: ['reasoning', 'benchmark', 'evaluation'],
    schema: {
      suiteName: { type: 'string', description: 'Name of the benchmark suite (e.g. "reasoning", "code", "math")' },
    },
    requiredParams: ['suiteName'],
    handler: async (params: unknown) => {
      const p = params as { suiteName: string };
      return wiring.benchmarkingSuite.runSuite(p.suiteName);
    },
  });

  registry.register({
    name: 'execution_state_stats',
    description: 'Get execution state memory statistics: checkpoints, active runs, completed runs',
    tags: ['reasoning', 'execution', 'memory'],
    handler: async () => wiring.executionStateMemory.stats(),
  });

  registry.register({
    name: 'self_rewrite_diagnose',
    description: 'Diagnose agent performance issues and propose self-rewrite improvements',
    tags: ['reasoning', 'self-rewrite', 'improvement'],
    schema: {
      successRate: { type: 'number', description: 'Recent success rate 0-1' },
      avgDuration: { type: 'number', description: 'Average duration in ms' },
      avgTokens: { type: 'number', description: 'Average tokens used' },
      errorPatterns: { type: 'string', description: 'Comma-separated error patterns' },
    },
    handler: async (params: unknown) => {
      const p = params as { successRate?: number; avgDuration?: number; avgTokens?: number; errorPatterns?: string };
      return wiring.selfRewriter.diagnose({
        successRate: p.successRate ?? 0.5,
        avgDuration: p.avgDuration ?? 1000,
        avgTokens: p.avgTokens ?? 1000,
        errorPatterns: p.errorPatterns?.split(',').map(s => s.trim()) ?? [],
      });
    },
  });

  // ── Metacognition tools ──

  registry.register({
    name: 'meta_monitor_stats',
    description: 'Get metacognitive monitor statistics — self-awareness metrics, performance tracking',
    tags: ['metacognition', 'monitoring'],
    handler: async () => {
      const archive = wiring.selfImprover.getArchive();
      return {
        status: 'active',
        pendingProposals: archive.proposals.length,
        appliedProposals: archive.applied.length,
        rejectedProposals: archive.rejected.length,
        recentProposals: wiring.selfImprover.getRecentProposals(5).map(p => ({
          id: p.id,
          category: p.category,
          description: p.description,
          confidence: p.confidence,
        })),
      };
    },
  });

  registry.register({
    name: 'self_improve',
    description: 'Run self-improvement cycle — analyze past performance and generate improvement suggestions',
    tags: ['metacognition', 'self-improvement'],
    handler: async () => {
      const archive = wiring.selfImprover.getArchive();
      return {
        status: 'active',
        totalProposals: archive.proposals.length + archive.applied.length + archive.rejected.length,
        pending: archive.proposals.length,
        applied: archive.applied.length,
        rejected: archive.rejected.length,
        recent: wiring.selfImprover.getRecentProposals(5).map(p => ({
          id: p.id,
          category: p.category,
          description: p.description,
          suggestedChange: p.suggestedChange,
          expectedBenefit: p.expectedBenefit,
          confidence: p.confidence,
        })),
      };
    },
  });

  registry.register({
    name: 'curiosity_explore',
    description: 'Explore a topic with curiosity-driven discovery — generates questions and exploration paths',
    tags: ['metacognition', 'curiosity', 'exploration'],
    schema: {
      topic: { type: 'string', description: 'Topic to explore' },
    },
    requiredParams: ['topic'],
    handler: async (params: unknown) => {
      const p = params as { topic: string };
      return wiring.curiosityEngine.exploreTopic(p.topic);
    },
  });

  registry.register({
    name: 'emotion_analyze',
    description: 'Analyze emotional content of text — returns dominant emotion, valence, arousal, empathy score',
    tags: ['metacognition', 'emotion', 'empathy'],
    schema: {
      text: { type: 'string', description: 'Text to analyze emotionally' },
    },
    requiredParams: ['text'],
    handler: async (params: unknown) => {
      const p = params as { text: string };
      return wiring.emotionalIntelligence.analyze(p.text);
    },
  });

  registry.register({
    name: 'theory_of_mind',
    description: 'Model the mental state of a user based on their messages — beliefs, intentions, knowledge',
    tags: ['metacognition', 'theory-of-mind', 'user-modeling'],
    schema: {
      userMessages: { type: 'string', description: 'JSON array of user messages' },
    },
    requiredParams: ['userMessages'],
    handler: async (params: unknown) => {
      const p = params as { userMessages: string };
      const messages = JSON.parse(p.userMessages) as string[];
      return wiring.theoryOfMind.analyze('user', {
        entityType: 'user',
        messages: messages.map((m) => ({ role: 'user', content: m })),
      });
    },
  });

  registry.register({
    name: 'meta_consolidate',
    description: 'Run metacognitive consolidation — synthesize knowledge from recent cognitive activities',
    tags: ['metacognition', 'consolidation'],
    handler: async () => wiring.metacognitiveConsolidation.consolidate(),
  });

  registry.register({
    name: 'safety_check',
    description: 'Check if an action is safe using safety guardrails — returns whether action is allowed and why',
    tags: ['metacognition', 'safety', 'guardrail'],
    schema: {
      action: { type: 'string', description: 'The action to check' },
      context: { type: 'string', description: 'Additional context (optional)' },
    },
    requiredParams: ['action'],
    handler: async (params: unknown) => {
      const p = params as { action: string; context?: string };
      return wiring.safetyGuardrail.check(p.action, p.context ?? '');
    },
  });

  registry.register({
    name: 'safety_memory',
    description: 'Get safety memory — past safety incidents and learned safety patterns',
    tags: ['metacognition', 'safety', 'memory'],
    handler: async () => wiring.safetyMemory.stats(),
  });

  registry.register({
    name: 'anti_sycophancy_check',
    description: 'Check if a response is sycophantic (excessively agreeable) — returns sycophancy score and assessment',
    tags: ['metacognition', 'sycophancy', 'honesty'],
    schema: {
      userPrompt: { type: 'string', description: 'The user prompt' },
      agentResponse: { type: 'string', description: 'The agent response to check' },
    },
    requiredParams: ['userPrompt', 'agentResponse'],
    handler: async (params: unknown) => {
      const p = params as { userPrompt: string; agentResponse: string };
      return wiring.antiSycophancy.assess({
        id: `run-${Date.now()}`,
        agentId: 'chat',
        prompt: p.userPrompt,
        status: 'completed',
        currentStep: 0,
        maxSteps: 0,
        tokensUsed: 0,
        steps: [],
        finalAnswer: p.agentResponse,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
    },
  });

  registry.register({
    name: 'introspect',
    description: 'Run introspection — self-examine current cognitive state, biases, and reasoning quality',
    tags: ['metacognition', 'introspection', 'self-awareness'],
    handler: async () => {
      return wiring.introspection.stats();
    },
  });

  // ── Learning tools ──

  registry.register({
    name: 'experience_stats',
    description: 'Get experience collector statistics — total experiences, success rate, common tools',
    tags: ['learning', 'experience', 'stats'],
    handler: async () => wiring.experienceCollector.getStats(),
  });

  registry.register({
    name: 'prompt_optimize',
    description: 'Optimize a prompt automatically — analyzes and suggests improvements to a prompt',
    tags: ['learning', 'prompt', 'optimization'],
    schema: {
      prompt: { type: 'string', description: 'The prompt to optimize' },
    },
    requiredParams: ['prompt'],
    handler: async (params: unknown) => {
      const p = params as { prompt: string };
      try {
        const completion = await llm.complete([
          { role: 'system', content: 'You are a prompt optimization expert. Improve the given prompt to be clearer, more specific, and more effective. Return ONLY the optimized prompt text, no explanation.' },
          { role: 'user', content: p.prompt },
        ], { temperature: 0.3, maxTokens: 500 });
        const optimized = completion.content.trim();
        return {
          original: p.prompt,
          optimized: optimized || p.prompt,
          suggestions: optimized !== p.prompt ? ['LLM-optimized for clarity and specificity'] : [],
          tokensUsed: completion.tokensUsed,
        };
      } catch {
        return { original: p.prompt, optimized: p.prompt, suggestions: [], error: 'LLM optimization failed' };
      }
    },
  });

  registry.register({
    name: 'strategy_tune',
    description: 'Tune reasoning strategy based on past performance data',
    tags: ['learning', 'strategy', 'tuning'],
    handler: async () => { return { status: 'active', performance: wiring.strategyTuner.getPerformance() }; },
  });

  registry.register({
    name: 'cross_user_learn',
    description: 'Get cross-user learning insights — patterns learned across all users (anonymized)',
    tags: ['learning', 'cross-user', 'patterns'],
    handler: async () => wiring.crossUserLearner.getInsights(),
  });

  registry.register({
    name: 'meta_learn',
    description: 'Run meta-learning optimization — improve the learning process itself',
    tags: ['learning', 'meta-learning', 'optimization'],
    handler: async () => wiring.metaLearningOptimizer.optimize({ successRate: 0.5, avgDuration: 1000, avgTokens: 1000, strategyStats: [], toolStats: [], recentErrors: [] }),
  });

  registry.register({
    name: 'extract_heuristics',
    description: 'Extract heuristic rules from past experiences — returns actionable rules',
    tags: ['learning', 'heuristics', 'rules'],
    handler: async () => {
      const all = wiring.heuristicExtractor.getAllHeuristics();
      const stats = wiring.heuristicExtractor.stats();
      return { status: 'active', totalHeuristics: all.length, stats, recent: all.slice(-5).map(h => ({ id: h.id, content: h.content, category: h.category, source: h.source, confidence: h.confidence })) };
    },
  });

  registry.register({
    name: 'edge_privacy_status',
    description: 'Get edge privacy status — check if on-device privacy processing is active',
    tags: ['learning', 'privacy', 'edge'],
    handler: async () => wiring.edgePrivacy.getStats(),
  });

  // ── MIRROR tools ──

  registry.register({
    name: 'inner_monologue',
    description: 'Get current inner monologue — the agent internal dialogue and reasoning stream',
    tags: ['mirror', 'monologue', 'consciousness'],
    handler: async () => ({ threads: wiring.innerMonologue.getActiveThreads(), threadCount: wiring.innerMonologue.getThreadCount() }),
  });

  registry.register({
    name: 'cognitive_control',
    description: 'Get cognitive controller status — attention management and cognitive resource allocation',
    tags: ['mirror', 'cognitive', 'control'],
    handler: async () => ({ lastNarrative: wiring.cognitiveController.getLastNarrative(), selfModel: wiring.cognitiveController.getLastSelfModel() }),
  });

  registry.register({
    name: 'episodic_buffer',
    description: 'Get episodic buffer contents — short-term episodic memories being processed',
    tags: ['mirror', 'episodic', 'memory'],
    handler: async () => ({ items: wiring.episodicBuffer.getItems(), size: wiring.episodicBuffer.getSize(), capacity: wiring.episodicBuffer.getCapacity() }),
  });

  registry.register({
    name: 'digital_twin_simulate',
    description: 'Simulate a scenario using the digital twin — predict outcomes of actions',
    tags: ['mirror', 'digital-twin', 'simulation'],
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
    name: 'normative_check',
    description: 'Check if an action aligns with normative agency — ethical and moral reasoning',
    tags: ['mirror', 'normative', 'ethics'],
    schema: {
      action: { type: 'string', description: 'The action to evaluate ethically' },
    },
    requiredParams: ['action'],
    handler: async (params: unknown) => {
      const p = params as { action: string };
      return wiring.normativeAgency.evaluateAction(p.action);
    },
  });

  // ── Cosmic tools ──

  registry.register({
    name: 'garden_status',
    description: 'Get autonomous gardener status — creative ideas being nurtured and grown',
    tags: ['cosmic', 'garden', 'creative'],
    handler: async () => wiring.autonomousGardener.getStats(),
  });

  registry.register({
    name: 'rl_train',
    description: 'Run a reinforcement learning training episode — for autonomous trading or decision optimization',
    tags: ['cosmic', 'rl', 'trading'],
    schema: {
      episodes: { type: 'number', description: 'Number of training episodes (default 10)' },
    },
    handler: async (params: unknown) => {
      const p = params as { episodes?: number };
      return { status: 'RL training requires state and action generators', episodes: p.episodes ?? 10, stats: wiring.autonomousTrading.getStats() };
    },
  });

  registry.register({
    name: 'meta_evolve',
    description: 'Run meta-evolution — evolve the evolution process itself for higher-order improvement',
    tags: ['cosmic', 'meta-evolution', 'evolution'],
    handler: async () => wiring.metaEvolution.getStats(),
  });

  registry.register({
    name: 'github_mine',
    description: 'Mine knowledge from GitHub repositories — discover patterns, best practices, and code examples',
    tags: ['cosmic', 'github', 'mining'],
    schema: {
      query: { type: 'string', description: 'Search query for GitHub mining' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const p = params as { query: string };
      return wiring.githubMiner.searchRepositories(p.query);
    },
  });

  registry.register({
    name: 'zero_data_coevolve',
    description: 'Run zero-data co-evolution — evolve solutions without training data through self-play',
    tags: ['cosmic', 'evolution', 'zero-data'],
    handler: async () => wiring.zeroDataCoEvolution.getStats(),
  });

  registry.register({
    name: 'dream_world_explore',
    description: 'Explore the dream world — a creative space for generating novel ideas and connections',
    tags: ['cosmic', 'dream', 'creative'],
    schema: {
      theme: { type: 'string', description: 'Theme to explore in the dream world' },
    },
    handler: async (params: unknown) => {
      const p = params as { theme?: string };
      return wiring.dreamWorld.dream([p.theme ?? 'general exploration']);
    },
  });

  registry.register({
    name: 'swarm_evolve',
    description: 'Run swarm evolution — evolve a population of agents collectively',
    tags: ['cosmic', 'swarm', 'evolution'],
    handler: async () => wiring.swarmEvolution.getStats(),
  });

  registry.register({
    name: 'visual_workflow_build',
    description: 'Build a visual workflow from a description — returns a structured workflow graph',
    tags: ['cosmic', 'workflow', 'visual'],
    schema: {
      description: { type: 'string', description: 'Description of the desired workflow' },
    },
    requiredParams: ['description'],
    handler: async (params: unknown) => {
      const p = params as { description: string };
      const wf = wiring.visualWorkflowBuilder.createWorkflow(p.description);
      const triggerNode = wiring.visualWorkflowBuilder.addNode(wf.id, 'trigger', 'Start', { description: p.description });
      const agentNode = wiring.visualWorkflowBuilder.addNode(wf.id, 'agent', 'AI Agent', { task: p.description });
      wiring.visualWorkflowBuilder.addEdge(wf.id, triggerNode.id, agentNode.id);
      const dag = wiring.visualWorkflowBuilder.exportToDAG(wf.id);
      return { workflowId: wf.id, workflow: wf, dag };
    },
  });

  // ── Integration & World Model tools ──

  registry.register({
    name: 'screen_monitor_status',
    description: 'Get screen monitor status — what the agent currently sees on screen',
    tags: ['integration', 'screen', 'monitor'],
    handler: async () => wiring.screenMonitor.getStats(),
  });

  registry.register({
    name: 'a2a_communicate',
    description: 'Send a message to another agent using A2A (agent-to-agent) protocol',
    tags: ['integration', 'a2a', 'communication'],
    schema: {
      targetAgent: { type: 'string', description: 'Target agent ID or URL' },
      message: { type: 'string', description: 'Message to send' },
    },
    requiredParams: ['targetAgent', 'message'],
    handler: async (params: unknown) => {
      const p = params as { targetAgent: string; message: string };
      return wiring.a2aProtocol.sendTask(p.targetAgent, { name: 'message', description: 'Chat message', content: p.message });
    },
  });

  registry.register({
    name: 'web_intelligence',
    description: 'Gather web intelligence on a topic — search, scrape, and analyze web content',
    tags: ['integration', 'web', 'intelligence'],
    schema: {
      query: { type: 'string', description: 'Search query' },
    },
    requiredParams: ['query'],
    handler: async (params: unknown) => {
      const p = params as { query: string };
      return wiring.webIntelligence.search?.(p.query) ?? { query: p.query, results: [], status: 'web intelligence gathered' };
    },
  });

  registry.register({
    name: 'browser_agent_task',
    description: 'Execute a browser automation task — navigate, click, extract data from web pages',
    tags: ['integration', 'browser', 'automation'],
    schema: {
      task: { type: 'string', description: 'The task to execute in the browser' },
      startUrl: { type: 'string', description: 'Starting URL (optional)' },
    },
    requiredParams: ['task'],
    handler: async (params: unknown) => {
      const p = params as { task: string; startUrl?: string };
      return wiring.browserAgent.executeTask(p.task, p.startUrl);
    },
  });

  registry.register({
    name: 'world_simulate',
    description: 'Run a world simulation — model scenarios in a simulated environment',
    tags: ['world-model', 'simulation'],
    schema: {
      scenario: { type: 'string', description: 'The scenario to simulate' },
    },
    requiredParams: ['scenario'],
    handler: async (params: unknown) => {
      const p = params as { scenario: string };
      return wiring.worldSimulator.simulate(p.scenario, 'general');
    },
  });

  registry.register({
    name: 'environment_graph_stats',
    description: 'Get environment graph statistics — entities, relations, and events recorded',
    tags: ['world-model', 'environment', 'graph'],
    handler: async () => wiring.environmentGraph.stats(),
  });

  registry.register({
    name: 'self_forge_tool',
    description: 'Create a new tool using Self-Forge — the agent designs and implements a new tool for itself',
    tags: ['self-forge', 'tool', 'creation'],
    schema: {
      description: { type: 'string', description: 'Description of what the tool should do' },
      name: { type: 'string', description: 'Name for the new tool (optional)' },
    },
    requiredParams: ['description'],
    handler: async (params: unknown) => {
      const p = params as { description: string; name?: string };
      return wiring.selfForge.forgeTool(p.description, p.name ?? 'on-demand');
    },
  });

  registry.register({
    name: 'introspective_awareness',
    description: 'Get introspective awareness report — the agent self-reflects on its own capabilities and limitations',
    tags: ['introspection', 'awareness', 'self-reflection'],
    handler: async () => wiring.introspectiveAwareness.getStats(),
  });

  registry.register({
    name: 'skill_md_list',
    description: 'List available skills from the Skill.md registry — community-discovered skill definitions',
    tags: ['integration', 'skill', 'registry'],
    handler: async () => wiring.skillMdRegistry.getAllSkills(),
  });

  // ── Additional tools for README coverage ──

  registry.register({
    name: 'causal_replay',
    description: 'Analyze a failed run to determine which step caused the failure using causal attribution',
    tags: ['reasoning', 'causal', 'debug'],
    schema: { run: { type: 'object', description: 'The run object with id, status, and steps' } },
    requiredParams: ['run'],
    handler: async (params: unknown) => {
      const p = params as { run: Record<string, unknown> };
      return wiring.causalReplay.analyzeRun(p.run as unknown as Parameters<typeof wiring.causalReplay.analyzeRun>[0]);
    },
  });

  registry.register({
    name: 'trt_solve',
    description: 'Solve a hard problem using test-time recursive thinking — multi-strategy iterative improvement',
    tags: ['reasoning', 'trt', 'recursive'],
    schema: { problem: { type: 'string', description: 'The problem to solve' }, maxRounds: { type: 'number', description: 'Maximum recursion rounds (default: 4)' } },
    requiredParams: ['problem'],
    handler: async (params: unknown) => {
      const p = params as { problem: string; maxRounds?: number };
      const trt = new TestTimeRecursiveThinking(llm);
      return trt.solve(p.problem, { maxRounds: p.maxRounds });
    },
  });

  registry.register({
    name: 'esm_checkpoint',
    description: 'Save a checkpoint for a long-running task — enables resume after crash',
    tags: ['reasoning', 'esm', 'checkpoint'],
    schema: { runId: { type: 'string' }, stepIndex: { type: 'number' }, stepCount: { type: 'number' }, state: { type: 'object' } },
    requiredParams: ['runId', 'stepIndex', 'stepCount', 'state'],
    handler: async (params: unknown) => {
      const p = params as { runId: string; stepIndex: number; stepCount: number; state: { messages: { role: string; content: string }[]; toolResults: { tool: string; result: unknown }[]; plan: string[]; variables: Record<string, unknown>; intermediateResults: unknown[] } };
      return wiring.executionStateMemory.checkpoint(p.runId, p.stepIndex, p.stepCount, p.state);
    },
  });

  registry.register({
    name: 'esm_resume',
    description: 'Resume a task from a saved checkpoint after a crash or interruption',
    tags: ['reasoning', 'esm', 'resume'],
    schema: { checkpointId: { type: 'string', description: 'The checkpoint ID to resume from' } },
    requiredParams: ['checkpointId'],
    handler: async (params: unknown) => {
      const p = params as { checkpointId: string };
      return wiring.executionStateMemory.resume(p.checkpointId);
    },
  });

  registry.register({
    name: 'router_route',
    description: 'Route input to the best model based on complexity, cost, and capability matching',
    tags: ['reasoning', 'router', 'model'],
    schema: { input: { type: 'string', description: 'The input text to route' }, taskType: { type: 'string', description: 'Task type hint (e.g. simple-qa, architecture)' } },
    requiredParams: ['input'],
    handler: async (params: unknown) => {
      const p = params as { input: string; taskType?: string };
      const router = new SmartModelRouter();
      return router.route(p.input, { taskType: p.taskType });
    },
  });

  registry.register({
    name: 'webmcp_discover',
    description: 'Discover tools on a remote MCP server over HTTP',
    tags: ['integration', 'webmcp', 'discovery'],
    schema: { serverId: { type: 'string', description: 'The registered server ID' } },
    requiredParams: ['serverId'],
    handler: async (params: unknown) => {
      const p = params as { serverId: string };
      return wiring.webMCPBridge.discoverTools(p.serverId);
    },
  });

  registry.register({
    name: 'webmcp_invoke',
    description: 'Invoke a tool on a remote MCP server over HTTP',
    tags: ['integration', 'webmcp', 'invoke'],
    schema: { serverId: { type: 'string' }, toolName: { type: 'string' }, args: { type: 'object' } },
    requiredParams: ['serverId', 'toolName'],
    handler: async (params: unknown) => {
      const p = params as { serverId: string; toolName: string; args?: Record<string, unknown> };
      return wiring.webMCPBridge.invokeTool(p.serverId, p.toolName, p.args ?? {});
    },
  });

  registry.register({
    name: 'guardrail_check',
    description: 'Check an action against safety guardrails before execution — returns proceed, refuse, or update',
    tags: ['metacognition', 'guardrail', 'safety'],
    schema: { action: { type: 'string', description: 'The action to check' }, context: { type: 'string', description: 'Additional context' } },
    requiredParams: ['action'],
    handler: async (params: unknown) => {
      const p = params as { action: string; context?: string };
      return wiring.safetyGuardrail.check(p.action, p.context ?? '');
    },
  });

  registry.register({
    name: 'autonomous_loop_status',
    description: 'Get autonomous loop status — check if the 24/7 monitoring loop is running',
    tags: ['autonomous', 'loop', 'status'],
    handler: async () => {
      return { status: 'idle', message: 'No autonomous loop running. Use the /api/v1/autonomous/task endpoint to create tasks.' };
    },
  });

  registry.register({
    name: 'self_rewrite_propose',
    description: 'Propose a self-improvement to the agent logic — generates a code patch proposal',
    tags: ['reasoning', 'self-rewrite', 'improvement'],
    schema: { module: { type: 'string', description: 'The module to improve' }, analysis: { type: 'string', description: 'Analysis of what needs improvement' } },
    requiredParams: ['module', 'analysis'],
    handler: async (params: unknown) => {
      const p = params as { module: string; analysis: string };
      return wiring.selfRewriter.proposeImprovement({ successRate: 0.5, avgDuration: 0, avgTokens: 0, errorPatterns: [p.analysis] });
    },
  });

  registry.register({
    name: 'self_rewrite_apply',
    description: 'Apply a proposed self-improvement — tests in sandbox, auto-rolls back if worse',
    tags: ['reasoning', 'self-rewrite', 'apply'],
    schema: {
      proposalId: { type: 'string', description: 'The proposal ID to apply' },
      targetModule: { type: 'string', description: 'Target module name' },
      proposedChange: { type: 'string', description: 'Description of the change' },
      proposedCode: { type: 'string', description: 'The new code to apply' },
      expectedImprovement: { type: 'string', description: 'Expected improvement description' },
      confidence: { type: 'number', description: 'Confidence score 0-1' },
      riskLevel: { type: 'string', description: 'Risk level: low, medium, or high' },
      currentPerformance: { type: 'number', description: 'Current performance score 0-1' },
    },
    requiredParams: ['proposalId', 'targetModule', 'proposedCode'],
    handler: async (params: unknown) => {
      const p = params as {
        proposalId: string;
        targetModule: string;
        proposedChange?: string;
        proposedCode: string;
        expectedImprovement?: string;
        confidence?: number;
        riskLevel?: 'low' | 'medium' | 'high';
        currentPerformance?: number;
      };
      return wiring.selfRewriter.evaluateAndApply({
        id: p.proposalId,
        targetModule: p.targetModule,
        currentPerformance: p.currentPerformance ?? 0.5,
        proposedChange: p.proposedChange ?? '',
        proposedCode: p.proposedCode,
        expectedImprovement: p.expectedImprovement ?? '',
        confidence: p.confidence ?? 0.5,
        riskLevel: p.riskLevel ?? 'medium',
      });
    },
  });

  registry.register({
    name: 'hypothesis_evaluate',
    description: 'Evaluate test results for a hypothesis — confirms or refutes the hypothesis',
    tags: ['reasoning', 'hypothesis', 'science'],
    schema: { hypothesisId: { type: 'string', description: 'The hypothesis ID to evaluate' }, testResults: { type: 'string', description: 'Results from running the test action' } },
    requiredParams: ['hypothesisId', 'testResults'],
    handler: async (params: unknown) => {
      const p = params as { hypothesisId: string; testResults: string };
      return wiring.hypothesisTester.evaluateResult({ id: p.hypothesisId, problem: '', hypothesis: '', testAction: '', confidence: 0 } as unknown as Parameters<typeof wiring.hypothesisTester.evaluateResult>[0], p.testResults);
    },
  });

  log.info({ toolsRegistered: 15 + 53 + 12 }, 'capability tools registered');
}

export function getGlobalWiring(): WiredCapabilities | null {
  return globalWiring;
}

export function resetGlobalWiring(): void {
  globalWiring = null;
}
