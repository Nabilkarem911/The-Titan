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
import { registerAllCapabilityTools } from './capability-tools/index.js';

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
  webIntelligence: WebIntelligence | null;
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
let globalWiringLlm: LlmProvider | null = null;

export function wireCapabilities(llm: LlmProvider): WiredCapabilities {
  if (globalWiring && globalWiringLlm === llm) return globalWiring;

  // If a different LLM is passed, re-wire with the new one
  if (globalWiring) {
    log.info('re-wiring capabilities with new LLM instance');
  }

  log.info('wiring capabilities (lazy mode)...');

  const registry = getGlobalToolRegistry();

  // Core modules with interdependencies — must be eager
  const environmentGraph = new EnvironmentGraph();
  const selfForge = new SelfForge(llm);
  const worldSimulator = new WorldSimulator(llm, environmentGraph);

  // Factory map for lazy initialization — modules are only created on first access
  const factories: Record<string, () => unknown> = {
    // Reasoning
    dreamMode: () => new DreamMode(llm),
    causalReplay: () => new CausalReplay(llm),
    hypothesisTester: () => new HypothesisTester(llm),
    selfHealingDebugger: () => new SelfHealingDebugger(llm),
    evolutionarySolver: () => new EvolutionarySolver(llm),
    neuroSymbolic: () => new NeuroSymbolicReasoner(llm),
    toolDiscovery: () => new DynamicToolDiscovery(llm),
    skillSynthesis: () => new AutonomousSkillSynthesis(llm),
    hyperAgent: () => new HyperAgent(llm),
    apexEvolution: () => new ApexEvolution(llm),
    benchmarkingSuite: () => new BenchmarkingSuite(llm),
    executionStateMemory: () => new ExecutionStateMemory(),
    selfRewriter: () => new SelfRewriter(llm),

    // Metacognition
    metaMonitor: () => new MetaMonitor(llm),
    selfImprover: () => new SelfImprover(llm),
    curiosityEngine: () => new CuriosityEngine(llm),
    emotionalIntelligence: () => new EmotionalIntelligence(llm),
    theoryOfMind: () => new TheoryOfMind(llm),
    metacognitiveConsolidation: () => new MetacognitiveConsolidation(llm),
    safetyGuardrail: () => new SafetyGuardrail(llm),
    safetyMemory: () => new SelfEvolvingSafetyMemory(),
    antiSycophancy: () => new AntiSycophancyModule(),
    multiLayerGuardrails: () => new MultiLayerGuardrails(),
    introspection: () => new IntrospectionModule(llm),

    // Learning
    experienceCollector: () => new ExperienceCollector(),
    promptOptimizer: () => new PromptOptimizer(),
    strategyTuner: () => new StrategyTuner(),
    crossUserLearner: () => new CrossUserLearner(),
    metaLearningOptimizer: () => new MetaLearningOptimizer(llm),
    heuristicExtractor: () => new HeuristicExtractor(llm),
    edgePrivacy: () => new EdgePrivacy(),

    // MIRROR
    innerMonologue: () => new InnerMonologueManager(),
    cognitiveController: () => new CognitiveController(),
    episodicBuffer: () => new EpisodicBuffer(),
    digitalTwin: () => new DigitalTwin(environmentGraph),
    whatIfEngine: () => new WhatIfEngine(new DigitalTwin(environmentGraph), llm),
    normativeAgency: () => new NormativeAgency(llm),

    // Cosmic
    creativeEngine: () => new CreativeEngine(llm),
    autonomousGardener: () => new AutonomousGardener(),
    hiveMind: () => new HiveMind(llm),
    agentEconomy: () => new AgentEconomy(llm),
    autonomousTrading: () => new RLEnvironment(),
    infiniteSelfPlay: () => new InfiniteSelfPlay(llm),
    selfEvolvingCode: () => new SelfEvolvingCode(llm),
    metaEvolution: () => new MetaEvolution(llm),
    githubMiner: () => new GitHubMiner(),
    zeroDataCoEvolution: () => new ZeroDataCoEvolution(llm),
    quantumOptimizer: () => new QuantumOptimizer(),
    universalTranslator: () => new UniversalTranslator(llm),
    temporalIntelligence: () => new TemporalIntelligence(llm),
    titanConstitution: () => new TitanConstitution(llm),
    dreamWorld: () => new DreamWorld(llm),
    swarmEvolution: () => new SwarmEvolution(),
    visualWorkflowBuilder: () => new VisualWorkflowBuilder(),
    proactiveIntelligence: () => new ProactiveIntelligence(llm),

    // Voice (optional — only if API keys present)
    elevenLabsTTS: () => process.env['ELEVENLABS_API_KEY'] ? new ElevenLabsTTSProvider({ apiKey: process.env['ELEVENLABS_API_KEY'] }) : null,
    whisperSTT: () => process.env['OPENAI_API_KEY'] ? new WhisperSTTProvider({ apiKey: process.env['OPENAI_API_KEY'] }) : null,
    openaiTTS: () => process.env['OPENAI_API_KEY'] ? new OpenAITTSProvider({ apiKey: process.env['OPENAI_API_KEY'] }) : null,

    // Multimodal
    screenMonitor: () => new ScreenMonitor(),
    advancedMultimodal: () => new AdvancedMultimodal(llm),

    // Integrations
    a2aProtocol: () => new A2AProtocolAdapter(),
    webIntelligence: () => {
      const apiKey = process.env['BRAVE_SEARCH_API_KEY'];
      if (!apiKey) return null;
      return new WebIntelligence({
        apiKey,
        baseUrl: 'https://api.search.brave.com',
        maxResults: 10,
        maxPages: 20,
        timeout: 30000,
      });
    },
    webMCPBridge: () => new WebMCPBridge(),
    skillMdRegistry: () => new SkillMdRegistry(),
    browserAgent: () => new BrowserAgent(llm),

    // Introspection
    introspectiveAwareness: () => new IntrospectiveAwareness(llm),
  };

  // Cache for instantiated modules
  const instanceCache = new Map<string, unknown>();

  // Create a Proxy that lazily instantiates modules on first access
  const target: Record<string, unknown> = {};
  const lazyWiring: Record<string, unknown> = new Proxy(target, {
    get(_target, prop: string) {
      // Eager core modules
      if (prop === 'environmentGraph') return environmentGraph;
      if (prop === 'selfForge') return selfForge;
      if (prop === 'worldSimulator') return worldSimulator;
      if (prop === 'totalWired') return Object.keys(factories).length + 3; // +3 for core modules

      // Check cache first
      if (instanceCache.has(prop)) {
        return instanceCache.get(prop);
      }

      // Create on demand
      const factory = factories[prop];
      if (factory) {
        const instance = factory();
        instanceCache.set(prop, instance);
        return instance;
      }

      return undefined;
    },
    has(_target, prop: string) {
      return prop in factories || prop === 'environmentGraph' || prop === 'selfForge' || prop === 'worldSimulator' || prop === 'totalWired';
    },
    ownKeys() {
      return [...Object.keys(factories), 'environmentGraph', 'selfForge', 'worldSimulator', 'totalWired'];
    },
    getOwnPropertyDescriptor(_target, prop: string): PropertyDescriptor | undefined {
      if (prop in factories || prop === 'environmentGraph' || prop === 'selfForge' || prop === 'worldSimulator' || prop === 'totalWired') {
        return { enumerable: true, configurable: true, value: lazyWiring[prop] };
      }
      return undefined;
    },
  });

  const wiring = lazyWiring as unknown as WiredCapabilities;

  // Register tools from capabilities — this accesses each module, triggering lazy init
  // for modules that have tools registered. Modules without tools stay uninitialised.
  registerAllCapabilityTools(wiring, llm);

  globalWiring = wiring;
  globalWiringLlm = llm;
  incCounter('capability_wiring_complete', 'All capabilities wired into the system (lazy)', 1);
  const instantiatedCount = instanceCache.size;
  log.info({ total: Object.keys(factories).length + 3, instantiated: instantiatedCount }, 'capabilities wired (lazy mode) — modules instantiated on demand');

  return wiring;
}

export function getGlobalWiring(): WiredCapabilities | null {
  return globalWiring;
}

export function resetGlobalWiring(): void {
  globalWiring = null;
  globalWiringLlm = null;
}
