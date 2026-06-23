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
    webIntelligence: new WebIntelligence(),
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
  registerCapabilityTools(wiring);

  globalWiring = wiring;
  incCounter('capability_wiring_complete', 'All capabilities wired into the system', 1);
  log.info({ total: wiring.totalWired }, 'all capabilities wired successfully');

  return wiring;
}

function registerCapabilityTools(wiring: WiredCapabilities): void {
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

  log.info({ toolsRegistered: 15 }, 'capability tools registered');
}

export function getGlobalWiring(): WiredCapabilities | null {
  return globalWiring;
}

export function resetGlobalWiring(): void {
  globalWiring = null;
}
