import {
  DreamMode,
  CausalReplay,
  SelfHealingDebugger,
  SelfRewriter,
  EvolutionarySolver,
  IntrospectionModule,
  CuriosityEngine,
  EmotionalIntelligence,
  NeuroSymbolicReasoner,
  DynamicToolDiscovery,
  AutonomousSkillSynthesis,
  MetaLearningOptimizer,
  TheoryOfMind,
  TestTimeRecursiveThinking,
  MetacognitiveConsolidation,
  SafetyGuardrail,
  SelfEvolvingSafetyMemory,
  HeuristicExtractor,
  HyperAgent,
  ExecutionStateMemory,
  SmartModelRouter,
  BenchmarkingSuite,
  WebMCPBridge,
  NormativeAgency,
  TemporalIntelligence,
  SwarmEvolution,
  RLEnvironment,
  createProviderFromEnv,
  getGlobalWiring,
} from '@titan/agent-engine';

let dreamMode: DreamMode | null = null;
let causalReplay: CausalReplay | null = null;
let debugger_: SelfHealingDebugger | null = null;
let selfRewriter: SelfRewriter | null = null;
let evolutionarySolver: EvolutionarySolver | null = null;
let introspectionModule: IntrospectionModule | null = null;
let curiosityEngine: CuriosityEngine | null = null;
let emotionalIntelligence: EmotionalIntelligence | null = null;
let neuroSymbolicReasoner: NeuroSymbolicReasoner | null = null;
let toolDiscovery: DynamicToolDiscovery | null = null;
let skillSynthesis: AutonomousSkillSynthesis | null = null;
let metaLearningOptimizer: MetaLearningOptimizer | null = null;
let theoryOfMind: TheoryOfMind | null = null;
let trtModule: TestTimeRecursiveThinking | null = null;
let mcConsolidation: MetacognitiveConsolidation | null = null;
let safetyGuardrail: SafetyGuardrail | null = null;
let safetyMemory: SelfEvolvingSafetyMemory | null = null;
let heuristicExtractor: HeuristicExtractor | null = null;
let hyperAgent: HyperAgent | null = null;
let executionStateMemory: ExecutionStateMemory | null = null;
let smartModelRouter: SmartModelRouter | null = null;
let benchmarkingSuite: BenchmarkingSuite | null = null;
let webMCPBridge: WebMCPBridge | null = null;
let normativeAgency: NormativeAgency | null = null;
let temporalIntelligence: TemporalIntelligence | null = null;
let swarmEvolution: SwarmEvolution | null = null;
let rlEnvironment: RLEnvironment | null = null;

export function getDreamMode(): DreamMode | null {
  if (dreamMode) return dreamMode;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  dreamMode = new DreamMode(llm);
  return dreamMode;
}

export function getCausalReplay(): CausalReplay | null {
  if (causalReplay) return causalReplay;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  causalReplay = new CausalReplay(llm);
  return causalReplay;
}

export function getDebugger(): SelfHealingDebugger | null {
  const wiring = getGlobalWiring();
  if (wiring?.selfHealingDebugger) return wiring.selfHealingDebugger;
  if (debugger_) return debugger_;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  debugger_ = new SelfHealingDebugger(llm);
  return debugger_;
}

export function getSelfRewriter(): SelfRewriter | null {
  const wiring = getGlobalWiring();
  if (wiring?.selfRewriter) return wiring.selfRewriter;
  if (selfRewriter) return selfRewriter;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  selfRewriter = new SelfRewriter(llm);
  return selfRewriter;
}

export function getEvolutionarySolver(): EvolutionarySolver | null {
  if (evolutionarySolver) return evolutionarySolver;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  evolutionarySolver = new EvolutionarySolver(llm);
  return evolutionarySolver;
}

export function getIntrospection(): IntrospectionModule | null {
  if (introspectionModule) return introspectionModule;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  introspectionModule = new IntrospectionModule(llm);
  return introspectionModule;
}

export function getCuriosity(): CuriosityEngine | null {
  if (curiosityEngine) return curiosityEngine;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  curiosityEngine = new CuriosityEngine(llm);
  return curiosityEngine;
}

export function getEmotionalIntelligence(): EmotionalIntelligence | null {
  if (emotionalIntelligence) return emotionalIntelligence;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  emotionalIntelligence = new EmotionalIntelligence(llm);
  return emotionalIntelligence;
}

export function getNeuroSymbolic(): NeuroSymbolicReasoner | null {
  if (neuroSymbolicReasoner) return neuroSymbolicReasoner;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  neuroSymbolicReasoner = new NeuroSymbolicReasoner(llm);
  return neuroSymbolicReasoner;
}

export function getToolDiscovery(): DynamicToolDiscovery | null {
  if (toolDiscovery) return toolDiscovery;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  toolDiscovery = new DynamicToolDiscovery(llm);
  return toolDiscovery;
}

export function getSkillSynthesis(): AutonomousSkillSynthesis | null {
  if (skillSynthesis) return skillSynthesis;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  skillSynthesis = new AutonomousSkillSynthesis(llm);
  return skillSynthesis;
}

export function getMetaLearningOptimizer(): MetaLearningOptimizer | null {
  if (metaLearningOptimizer) return metaLearningOptimizer;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  metaLearningOptimizer = new MetaLearningOptimizer(llm);
  return metaLearningOptimizer;
}

export function getTheoryOfMind(): TheoryOfMind | null {
  if (theoryOfMind) return theoryOfMind;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  theoryOfMind = new TheoryOfMind(llm);
  return theoryOfMind;
}

export function getTRT(): TestTimeRecursiveThinking | null {
  if (trtModule) return trtModule;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  trtModule = new TestTimeRecursiveThinking(llm);
  return trtModule;
}

export function getMCConsolidation(): MetacognitiveConsolidation | null {
  if (mcConsolidation) return mcConsolidation;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  mcConsolidation = new MetacognitiveConsolidation(llm);
  return mcConsolidation;
}

export function getSafetyGuardrail(): SafetyGuardrail | null {
  if (safetyGuardrail) return safetyGuardrail;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  safetyGuardrail = new SafetyGuardrail(llm);
  return safetyGuardrail;
}

export function getSafetyMemory(): SelfEvolvingSafetyMemory {
  if (safetyMemory) return safetyMemory;
  safetyMemory = new SelfEvolvingSafetyMemory();
  return safetyMemory;
}

export function getHeuristicExtractor(): HeuristicExtractor | null {
  if (heuristicExtractor) return heuristicExtractor;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  heuristicExtractor = new HeuristicExtractor(llm);
  return heuristicExtractor;
}

export function getHyperAgent(): HyperAgent | null {
  if (hyperAgent) return hyperAgent;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  hyperAgent = new HyperAgent(llm);
  return hyperAgent;
}

export function getExecutionStateMemory(): ExecutionStateMemory {
  if (executionStateMemory) return executionStateMemory;
  executionStateMemory = new ExecutionStateMemory();
  return executionStateMemory;
}

export function getSmartModelRouter(): SmartModelRouter {
  if (smartModelRouter) return smartModelRouter;
  smartModelRouter = new SmartModelRouter();
  return smartModelRouter;
}

export function getBenchmarkingSuite(): BenchmarkingSuite | null {
  if (benchmarkingSuite) return benchmarkingSuite;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  benchmarkingSuite = new BenchmarkingSuite(llm);
  return benchmarkingSuite;
}

export function getWebMCPBridge(): WebMCPBridge {
  if (webMCPBridge) return webMCPBridge;
  webMCPBridge = new WebMCPBridge();
  return webMCPBridge;
}

export function getNormativeAgency(): NormativeAgency | null {
  const wiring = getGlobalWiring();
  if (wiring?.normativeAgency) return wiring.normativeAgency;
  if (normativeAgency) return normativeAgency;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  normativeAgency = new NormativeAgency(llm);
  return normativeAgency;
}

export function getTemporalIntelligence(): TemporalIntelligence | null {
  if (temporalIntelligence) return temporalIntelligence;
  const llm = createProviderFromEnv();
  if (!llm) return null;
  temporalIntelligence = new TemporalIntelligence(llm);
  return temporalIntelligence;
}

export function getSwarmEvolution(): SwarmEvolution {
  const wiring = getGlobalWiring();
  if (wiring?.swarmEvolution) return wiring.swarmEvolution;
  if (swarmEvolution) return swarmEvolution;
  swarmEvolution = new SwarmEvolution();
  return swarmEvolution;
}

export function getRLEnvironment(): RLEnvironment {
  const wiring = getGlobalWiring();
  if (wiring?.autonomousTrading) return wiring.autonomousTrading;
  if (rlEnvironment) return rlEnvironment;
  rlEnvironment = new RLEnvironment();
  return rlEnvironment;
}
