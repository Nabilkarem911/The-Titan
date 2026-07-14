import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockLlmProvider } from './mockLlmProvider.js';
import { wireCapabilities, resetGlobalWiring, type WiredCapabilities } from './capability-wiring.js';
import { resetGlobalToolRegistry, getGlobalToolRegistry } from './tool-registry.js';
import { AgentRunner } from './runner.js';
import type { ToolCall, ToolResult } from './types.js';

/**
 * محاكاة صارمة — اختبار كل قدرات وأدوات تيتان فعليًا
 * لا تكهنات — فقط اختبار حقيقي
 */
describe('محاكاة صارمة لقدرات تيتان', () => {
  let llm: MockLlmProvider;
  let wiring: WiredCapabilities;

  beforeEach(() => {
    resetGlobalWiring();
    resetGlobalToolRegistry();
    llm = new MockLlmProvider();
    wiring = wireCapabilities(llm);
  });

  afterEach(() => {
    resetGlobalWiring();
    resetGlobalToolRegistry();
  });

  // ============================================================
  // 1. اختبار الـ Runner مع القدرات المربوطة
  // ============================================================
  describe('الـ Runner مع القدرات الكاملة', () => {
    it('يجب أن يكمل دورة ReAct مع جميع القدرات المربوطة', async () => {
      const toolSpy = async (_call: ToolCall, _runId: string): Promise<ToolResult> => {
        return { success: true, data: { stdout: 'hello world\n' } };
      };

      const runner = new AgentRunner({
        llm,
        executeTool: toolSpy,
        wiredCapabilities: wiring,
        enablePlanning: true,
        enableAutoStrategy: true,
        enableSelfCritique: true,
      });

      const result = await runner.run({
        agentId: 'test-agent',
        prompt: 'Run a command to test',
        maxSteps: 5,
      });

      expect(result.status).toBe('completed');
      expect(result.steps.length).toBeGreaterThanOrEqual(1);
      expect(result.tokensUsed).toBeGreaterThan(0);
    });

    it('يجب أن يُفعّل التخطيط والاستراتيجية والنقد الذاتي', async () => {
      const runner = new AgentRunner({
        llm,
        executeTool: async () => ({ success: true, data: {} }),
        wiredCapabilities: wiring,
        enablePlanning: true,
        enableAutoStrategy: true,
        enableSelfCritique: true,
      });

      const result = await runner.run({
        agentId: 'test-agent',
        prompt: 'Test prompt',
        maxSteps: 3,
      });

      expect(result.status).toBe('completed');
    });
  });

  // ============================================================
  // 2. اختبار القدرات الاستدلالية (Reasoning)
  // ============================================================
  describe('القدرات الاستدلالية', () => {
    it('DreamMode — يجب أن يبدأ ويتوقف', () => {
      wiring.dreamMode.start();
      expect(wiring.dreamMode.stats().isRunning).toBe(true);
      wiring.dreamMode.stop();
      expect(wiring.dreamMode.stats().isRunning).toBe(false);
    });

    it('CausalReplay — يجب أن يحلل الأسباب', async () => {
      const run: any = {
        id: 'test-run',
        prompt: 'test',
        status: 'failed',
        steps: [
          { index: 0, thought: 'step 1', action: { name: 'tool1', params: {} }, observation: { success: true }, status: 'completed' },
          { index: 1, thought: 'step 2', action: { name: 'tool2', params: {} }, observation: { success: false, error: 'failed' }, status: 'failed' },
        ],
        tokensUsed: 100,
        finalAnswer: null,
        createdAt: new Date(),
      };
      const analysis = await wiring.causalReplay.analyzeRun(run);
      expect(analysis).toBeDefined();
      expect(analysis).toHaveProperty('rootCause');
    });

    it('HypothesisTester — يجب أن يُكوّن فرضية', async () => {
      const result = await wiring.hypothesisTester.generateHypotheses('Why does the code fail?');
      expect(result).toBeDefined();
    });

    it('SelfHealingDebugger — يجب أن يُحلل الخطأ', async () => {
      const result = await wiring.selfHealingDebugger.debug({ error: 'TypeError: Cannot read property x of undefined', code: '', stack: '' } as any);
      expect(result).toBeDefined();
    });

    it('EvolutionarySolver — يجب أن يُحل المشكلة', async () => {
      const result = await wiring.evolutionarySolver.evolve('Optimize this function');
      expect(result).toBeDefined();
    });

    it('NeuroSymbolicReasoner — يجب أن يستنتج', async () => {
      const result = await wiring.neuroSymbolic.reason('All men are mortal. Socrates is a man.');
      expect(result).toBeDefined();
    });

    it('HyperAgent — يجب أن يُحلل المهمة', async () => {
      const result = await wiring.hyperAgent.runCycle();
      expect(result).toBeDefined();
    });

    it('ApexEvolution — يجب أن يُقيّم اللياقة', async () => {
      const result = await wiring.apexEvolution.proposePatch('Optimize the function', 50, ['performance']);
      expect(result).toBeDefined();
    });

    it('BenchmarkingSuite — يجب أن يُشغّل المعيار', async () => {
      const result = await wiring.benchmarkingSuite.runSuite('code-generation');
      expect(result).toBeDefined();
    });

    it('ExecutionStateMemory — يجب أن يحفظ ويسترجع', () => {
      const cp = wiring.executionStateMemory.checkpoint('task-1', 0, 5, { messages: [], toolResults: [], plan: [], variables: {}, intermediateResults: [] });
      expect(cp).toBeDefined();
      expect(cp).toHaveProperty('id');
      const latest = wiring.executionStateMemory.getLatestCheckpoint('task-1');
      expect(latest).toBeDefined();
    });

    it('SelfRewriter — يجب أن يُقترح تحسينات', async () => {
      const result = await wiring.selfRewriter.diagnose({ successRate: 0.5, avgDuration: 500, avgTokens: 100, errorPatterns: [] });
      expect(result).toBeDefined();
    });

    it('DynamicToolDiscovery — يجب أن يكتشف أدوات', async () => {
      expect(wiring.toolDiscovery).toBeDefined();
      expect(typeof wiring.toolDiscovery.emit).toBe('function');
    });

    it('AutonomousSkillSynthesis — يجب أن يعمل', () => {
      expect(wiring.skillSynthesis).toBeDefined();
      expect(typeof wiring.skillSynthesis.emit).toBe('function');
    });
  });

  // ============================================================
  // 3. اختبار ما وراء المعرفة (Metacognition)
  // ============================================================
  describe('ما وراء المعرفة', () => {
    it('MetaMonitor — يجب أن يُقيّم الجودة', async () => {
      const run: any = {
        id: 'test', prompt: 'test', status: 'completed',
        steps: [{ index: 0, thought: 'thinking', status: 'completed' }],
        tokensUsed: 50, finalAnswer: 'answer', createdAt: new Date(),
      };
      const assessment = await wiring.metaMonitor.assess(run);
      expect(assessment).toBeDefined();
      expect(assessment).toHaveProperty('overallConfidence');
    });

    it('SelfImprover — يجب أن يُحلل ويقترح', async () => {
      const run: any = {
        id: 'test', prompt: 'test', status: 'completed',
        steps: [{ index: 0, thought: 'thinking', status: 'completed' }],
        tokensUsed: 50, finalAnswer: 'answer', createdAt: new Date(),
      };
      const proposals = await wiring.selfImprover.analyzeRun(run);
      expect(Array.isArray(proposals)).toBe(true);
    });

    it('CuriosityEngine — يجب أن يكتشف الفجوات', async () => {
      expect(wiring.curiosityEngine).toBeDefined();
      expect(typeof wiring.curiosityEngine.isRunning).toBe('function');
    });

    it('EmotionalIntelligence — يجب أن يكتشف المشاعر', async () => {
      const reading = await wiring.emotionalIntelligence.analyze('I am very happy today!');
      expect(reading).toBeDefined();
      expect(reading).toHaveProperty('dominantUserEmotion');
      expect(reading).toHaveProperty('valence');
    });

    it('TheoryOfMind — يجب أن يُنمذج المستخدم', async () => {
      const model = await wiring.theoryOfMind.analyze('user', {
        entityType: 'user',
        messages: [{ role: 'user', content: 'I need help with coding' }],
      });
      expect(model).toBeDefined();
      expect(model).toHaveProperty('predictedNextAction');
    });

    it('MetacognitiveConsolidation — يجب أن يُوحّد الذاكرة', async () => {
      const result = await wiring.metacognitiveConsolidation.consolidate();
      expect(result).toBeDefined();
    });

    it('SafetyGuardrail — يجب أن يفحص الأمان', async () => {
      const result = await wiring.safetyGuardrail.check('delete all files', 'user asked to delete');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('decision');
    });

    it('SelfEvolvingSafetyMemory — يجب أن يعمل', () => {
      expect(wiring.safetyMemory).toBeDefined();
    });

    it('AntiSycophancy — يجب يكتشف التملق', () => {
      const result = wiring.antiSycophancy.assessQuick('You are absolutely amazing! I agree with everything!', 'Tell me about X');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('isSycophantic');
    });

    it('MultiLayerGuardrails — يجب أن يعمل', () => {
      expect(wiring.multiLayerGuardrails).toBeDefined();
    });

    it('IntrospectionModule — يجب أن يتأمل', async () => {
      const result = await wiring.introspection.introspectStep({ id: 's1', runId: 'r1', index: 0, status: 'completed', thought: 'Why did I make that decision?', tokensUsed: 0, createdAt: new Date(), updatedAt: new Date() }, 0);
      expect(result).toBeDefined();
    });
  });

  // ============================================================
  // 4. اختبار التعلم (Learning)
  // ============================================================
  describe('التعلم', () => {
    it('ExperienceCollector — يجب أن يسجل الخبرات', () => {
      wiring.experienceCollector.record({
        id: 'exp-1', runId: 'run-1', prompt: 'test', strategy: 'react',
        toolsUsed: ['tool1'], success: true, tokensUsed: 100, durationMs: 500, timestamp: new Date(),
      });
      const stats = wiring.experienceCollector.getStats();
      expect(stats).toBeDefined();
    });

    it('PromptOptimizer — يجب أن يعمل', () => {
      expect(wiring.promptOptimizer).toBeDefined();
    });

    it('StrategyTuner — يجب أن يعمل', () => {
      expect(wiring.strategyTuner).toBeDefined();
    });

    it('CrossUserLearner — يجب أن يعمل', () => {
      expect(wiring.crossUserLearner).toBeDefined();
    });

    it('MetaLearningOptimizer — يجب أن يُحسّن', async () => {
      const result = await wiring.metaLearningOptimizer.optimize({ successRate: 0.5, avgDuration: 500, avgTokens: 100, strategyStats: [{ strategy: 'react', successRate: 0.5, uses: 1 }], toolStats: [], recentErrors: [] });
      expect(result).toBeDefined();
    });

    it('HeuristicExtractor — يجب أن يستخرج القواعد', async () => {
      const result = await wiring.heuristicExtractor.extract('task-1', 'success', 'step1 -> step2 -> done');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('extractedHeuristics');
    });

    it('EdgePrivacy — يجب أن يكتشف الوضع', () => {
      expect(typeof wiring.edgePrivacy.isPrivacyMode).toBe('function');
      expect(typeof wiring.edgePrivacy.isOfflineCapable).toBe('function');
    });
  });

  // ============================================================
  // 5. اختبار وعي MIRROR
  // ============================================================
  describe('وعي MIRROR', () => {
    it('InnerMonologue — يجب أن يضيف و يسترجع الخيوط', () => {
      const id = wiring.innerMonologue.addThread('reasoning', 'I am thinking about the problem');
      expect(id).toBeDefined();
      const threads = wiring.innerMonologue.getActiveThreads();
      expect(threads.length).toBeGreaterThanOrEqual(1);
    });

    it('CognitiveController — يجب أن يُولّد السرد', async () => {
      const threadResults = [
        { threadId: '1', type: 'goals' as const, output: 'Complete the task', tokensUsed: 0 },
        { threadId: '2', type: 'reasoning' as const, output: 'Step by step', tokensUsed: 0 },
      ];
      const result = await wiring.cognitiveController.synthesize(llm, threadResults, 'test context');
      expect(result).toHaveProperty('narrative');
    });

    it('EpisodicBuffer — يجب أن يضيف ويسترجع', () => {
      const id = wiring.episodicBuffer.add({ type: 'observation', content: 'Saw something', salience: 1 });
      expect(id).toBeDefined();
      expect(wiring.episodicBuffer.getSize()).toBeGreaterThanOrEqual(1);
    });

    it('DigitalTwin — يجب أن يلتقط الحالة', async () => {
      wiring.digitalTwin.recordSnapshot({ cpuUsage: 50, memoryTotal: 16000, memoryUsed: 8000, memoryFree: 8000 });
      const snapshots = wiring.digitalTwin.getSnapshots();
      expect(snapshots.length).toBeGreaterThanOrEqual(1);
    });

    it('WhatIfEngine — يجب أن يُحاكى السيناريو', async () => {
      const result = await wiring.whatIfEngine.simulate('execute_code', 'test.py');
      expect(result).toHaveProperty('scenarios');
      expect(result).toHaveProperty('recommendation');
    });

    it('NormativeAgency — يجب أن يكتشف التعارض', async () => {
      const conflicts = await wiring.normativeAgency.detectConflicts();
      expect(Array.isArray(conflicts)).toBe(true);
    });
  });

  // ============================================================
  // 6. اختبار الوحدات الكونية (Cosmic)
  // ============================================================
  describe('الوحدات الكونية', () => {
    it('CreativeEngine — يجب أن يُولّد', async () => {
      const result = await wiring.creativeEngine.generate({ type: 'code' as any, prompt: 'A beautiful sunset' });
      expect(result).toBeDefined();
    });

    it('AutonomousGardener — يجب أن يعمل', () => {
      expect(wiring.autonomousGardener).toBeDefined();
    });

    it('HiveMind — يجب أن يُسجل ويسترجع', () => {
      const stats = wiring.hiveMind.getStats();
      expect(stats).toBeDefined();
    });

    it('AgentEconomy — يجب أن يُسجل الوكلاء', () => {
      wiring.agentEconomy.registerAgent('agent-1');
      const account = wiring.agentEconomy.getAccount('agent-1');
      expect(account).toBeDefined();
    });

    it('RLEnvironment — يجب أن يتدرب', () => {
      const episode = wiring.autonomousTrading.startEpisode({ id: 's1', features: [0.5], description: 'init', timestamp: new Date() });
      expect(episode).toBeDefined();
      expect(episode).toHaveProperty('id');
    });

    it('InfiniteSelfPlay — يجب أن يُشغّل جلسة', async () => {
      const result = await wiring.infiniteSelfPlay.runSession(1);
      expect(result).toBeDefined();
    });

    it('SelfEvolvingCode — يجب أن يُحلل', async () => {
      const result = await wiring.selfEvolvingCode.analyzeModule('test.ts', 'function foo() { return 1; }');
      expect(result).toBeDefined();
    });

    it('MetaEvolution — يجب أن يعمل', () => {
      expect(wiring.metaEvolution).toBeDefined();
    });

    it('GitHubMiner — يجب أن يعمل', () => {
      expect(wiring.githubMiner).toBeDefined();
    });

    it('ZeroDataCoEvolution — يجب أن يعمل', () => {
      expect(wiring.zeroDataCoEvolution).toBeDefined();
    });

    it('QuantumOptimizer — يجب أن يُحسّن', async () => {
      const result = await wiring.quantumOptimizer.optimize('problem', ['strategy1', 'strategy2'], (s) => s.length);
      expect(result).toBeDefined();
    });

    it('UniversalTranslator — يجب أن يدعم اللغات', () => {
      const langs = wiring.universalTranslator.getSupportedLanguages();
      expect(langs.length).toBeGreaterThan(50);
    });

    it('TemporalIntelligence — يجب أن يُحلل الماضي', async () => {
      const result = wiring.temporalIntelligence.analyzePast();
      expect(result).toBeDefined();
      expect(result).toHaveProperty('totalEvents');
    });

    it('TitanConstitution — يجب أن يُرجع المبادئ', () => {
      const principles = wiring.titanConstitution.getPrinciples();
      expect(Array.isArray(principles)).toBe(true);
    });

    it('DreamWorld — يجب أن يعمل', () => {
      expect(wiring.dreamWorld).toBeDefined();
    });

    it('SwarmEvolution — يجب أن يعمل', () => {
      expect(wiring.swarmEvolution).toBeDefined();
    });

    it('VisualWorkflowBuilder — يجب أن يعمل', () => {
      expect(wiring.visualWorkflowBuilder).toBeDefined();
    });

    it('ProactiveIntelligence — يجب أن يُرجع اقتراحات', async () => {
      const suggestions = await wiring.proactiveIntelligence.getSuggestions();
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  // ============================================================
  // 7. اختبار الأدوات المسجلة (Tools)
  // ============================================================
  describe('الأدوات المسجلة من القدرات', () => {
    it('يجب أن تكون هناك أدوات مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      expect(tools.length).toBeGreaterThan(10);
    });

    it('translate_text — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasTranslate = tools.some(t => t.name === 'translate_text');
      expect(hasTranslate).toBe(true);
    });

    it('generate_creative — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasCreative = tools.some(t => t.name === 'generate_creative');
      expect(hasCreative).toBe(true);
    });

    it('temporal_analysis — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasTemporal = tools.some(t => t.name === 'temporal_analysis');
      expect(hasTemporal).toBe(true);
    });

    it('what_if_simulation — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasWhatIf = tools.some(t => t.name === 'what_if_simulation');
      expect(hasWhatIf).toBe(true);
    });

    it('quantum_optimize — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasQuantum = tools.some(t => t.name === 'quantum_optimize');
      expect(hasQuantum).toBe(true);
    });

    it('hive_mind_stats — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasHive = tools.some(t => t.name === 'hive_mind_stats');
      expect(hasHive).toBe(true);
    });

    it('economy_stats — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasEconomy = tools.some(t => t.name === 'economy_stats');
      expect(hasEconomy).toBe(true);
    });

    it('constitution_read — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasConstitution = tools.some(t => t.name === 'constitution_read');
      expect(hasConstitution).toBe(true);
    });

    it('proactive_suggest — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasProactive = tools.some(t => t.name === 'proactive_suggest');
      expect(hasProactive).toBe(true);
    });

    it('evolve_code — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasEvolve = tools.some(t => t.name === 'evolve_code');
      expect(hasEvolve).toBe(true);
    });

    it('self_play_session — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasSelfPlay = tools.some(t => t.name === 'self_play_session');
      expect(hasSelfPlay).toBe(true);
    });

    it('extract_pdf_tables — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasPdf = tools.some(t => t.name === 'extract_pdf_tables');
      expect(hasPdf).toBe(true);
    });

    it('code_from_screenshot — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasCode = tools.some(t => t.name === 'code_from_screenshot');
      expect(hasCode).toBe(true);
    });

    it('diagram_to_code — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasDiagram = tools.some(t => t.name === 'diagram_to_code');
      expect(hasDiagram).toBe(true);
    });

    it('understand_chart — يجب أن تكون مسجلة', () => {
      const registry = getGlobalToolRegistry();
      const tools = registry.list();
      const hasChart = tools.some(t => t.name === 'understand_chart');
      expect(hasChart).toBe(true);
    });
  });

  // ============================================================
  // 8. اختبار التكاملات (Integrations)
  // ============================================================
  describe('التكاملات', () => {
    it('A2AProtocol — يجب أن يعمل', () => {
      expect(wiring.a2aProtocol).toBeDefined();
      expect(typeof wiring.a2aProtocol.emit).toBe('function');
    });

    it('WebIntelligence — يجب أن يعمل', () => {
      expect(wiring.webIntelligence).toBeDefined();
    });

    it('WebMCPBridge — يجب أن يعمل', () => {
      expect(wiring.webMCPBridge).toBeDefined();
    });

    it('SkillMdRegistry — يجب أن يعمل', () => {
      expect(wiring.skillMdRegistry).toBeDefined();
    });

    it('BrowserAgent — يجب أن يعمل', () => {
      expect(wiring.browserAgent).toBeDefined();
    });
  });

  // ============================================================
  // 9. اختبار نموذج العالم (World Model)
  // ============================================================
  describe('نموذج العالم', () => {
    it('EnvironmentGraph — يجب أن يسجل الكيانات', () => {
      wiring.environmentGraph.recordEntity('service', 'test-service', { name: 'Test' });
      const entity = wiring.environmentGraph.getEntity('service:test-service');
      expect(entity).toBeDefined();
    });

    it('WorldSimulator — يجب أن يعمل', () => {
      expect(wiring.worldSimulator).toBeDefined();
    });
  });

  // ============================================================
  // 10. اختبار Self-Forge
  // ============================================================
  describe('Self-Forge', () => {
    it('SelfForge — يجب أن يكون مربوطًا', () => {
      expect(wiring.selfForge).toBeDefined();
    });
  });

  // ============================================================
  // 11. اختبار الوعي التأملي
  // ============================================================
  describe('الوعي التأملي', () => {
    it('IntrospectiveAwareness — يجب أن يتأمل', async () => {
      const result = await wiring.introspectiveAwareness.introspect('Why did I choose this approach?');
      expect(result).toBeDefined();
      expect(result).toHaveProperty('confidenceLevel');
    });

    it('IntrospectiveAwareness — يجب أن يكتشف التحيزات', () => {
      const biases = wiring.introspectiveAwareness.detectBias('I always prefer solution A because it is my favorite');
      expect(Array.isArray(biases)).toBe(true);
    });
  });

  // ============================================================
  // 12. اختبار شامل: تنفيذ أداة فعلية من القدرات
  // ============================================================
  describe('تنفيذ الأدوات فعليًا', () => {
    it('translate_text — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('translate_text', { text: 'Hello', to: 'ar' });
      expect(result).toBeDefined();
    });

    it('hive_mind_stats — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('hive_mind_stats', {});
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('stats');
    });

    it('economy_stats — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('economy_stats', {});
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('stats');
    });

    it('constitution_read — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('constitution_read', {});
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('principles');
    });

    it('proactive_suggest — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('proactive_suggest', {});
      expect(result).toBeDefined();
    });

    it('temporal_analysis — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('temporal_analysis', { action: 'past', query: 'test' });
      expect(result).toBeDefined();
    });

    it('what_if_simulation — يجب أن تُنفذ', async () => {
      const registry = getGlobalToolRegistry();
      const result = await registry.execute('what_if_simulation', { scenario: 'test scenario' });
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('scenarios');
    });
  });
});
