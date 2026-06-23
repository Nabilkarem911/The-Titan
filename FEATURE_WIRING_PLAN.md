# خطة صارمة: وصل جميع ميزات Titan بالشات والداشبورد

## القاعدة الذهبية
- لا كسر كود موجود
- لا تبسيط أو تكهنات
- لا أخطاء — كل خطوة تُختبر قبل الانتقال للتي بعدها
- كل ميزة تُجرب من الشات والداشبورد بعد ربطها

---

## المرحلة 1: تسجيل أدوات الشات لكل الميزات غير المتصلة

### 1A. أدوات الاستدلال (Reasoning) — 13 أداة جديدة
| # | اسم الأداة | الوحدة | الوصف |
|---|-----------|--------|-------|
| 1 | `dream_from_experiences` | DreamMode | تشغيل الحلم من تجارب سابقة |
| 2 | `causal_replay` | CausalReplay | إعادة تشغيل سببي لتحليل الأخطاء |
| 3 | `hypothesis_generate` | HypothesisTester | توليد فرضيات لمشكلة |
| 4 | `hypothesis_evaluate` | HypothesisTester | تقييم نتائج ضد فرضية |
| 5 | `self_heal_debug` | SelfHealingDebugger | تشخيص وإصلاح أخطاء تلقائياً |
| 6 | `evolutionary_solve` | EvolutionarySolver | حل مشكلة بالتطور الدارويني |
| 7 | `neuro_symbolic_reason` | NeuroSymbolicReasoner | استدلال هجين عصبي-رمزي |
| 8 | `discover_tools` | DynamicToolDiscovery | اكتشاف أدوات جديدة ديناميكياً |
| 9 | `synthesize_skill` | AutonomousSkillSynthesis | توليد مهارة جديدة تلقائياً |
| 10 | `hyper_agent_run` | HyperAgent | تشغيل وكيل فائق |
| 11 | `apex_evolve` | ApexEvolution | تطور قمي للنظام |
| 12 | `benchmark_run` | BenchmarkingSuite | قياس أداء النظام |
| 13 | `self_rewrite` | SelfRewriter | إعادة كتابة الكود ذاتياً |

### 1B. أدوات الميتامعرفة (Metacognition) — 10 أدوات جديدة
| # | اسم الأداة | الوحدة | الوصف |
|---|-----------|--------|-------|
| 14 | `meta_monitor` | MetaMonitor | مراقبة الحالة المعرفية |
| 15 | `self_improve` | SelfImprover | تحسين ذاتي بناءً على الأداء |
| 16 | `curiosity_explore` | CuriosityEngine | استكشاف فضولي لمواضيع جديدة |
| 17 | `emotion_analyze` | EmotionalIntelligence | تحليل المشاعر من نص |
| 18 | `theory_of_mind` | TheoryOfMind | نمذجة الحالة الذهنية للمستخدم |
| 19 | `meta_consolidate` | MetacognitiveConsolidation | توحيد المعرفة الميتامعرفية |
| 20 | `safety_check` | SafetyGuardrail | فحص أمان لفعل خطير |
| 21 | `safety_memory` | SelfEvolvingSafetyMemory | استرجاع ذكريات الأمان |
| 22 | `anti_sycophancy_check` | AntiSycophancyModule | فحص التملق في إجابة |
| 23 | `introspect` | IntrospectionModule | استبطان الذات |

### 1C. أدوات التعلم (Learning) — 7 أدوات جديدة
| # | اسم الأداة | الوحدة | الوصف |
|---|-----------|--------|-------|
| 24 | `experience_stats` | ExperienceCollector | إحصائيات التجارب |
| 25 | `prompt_optimize` | PromptOptimizer | تحسين prompt تلقائياً |
| 26 | `strategy_tune` | StrategyTuner | ضبط استراتيجية التفكير |
| 27 | `cross_user_learn` | CrossUserLearner | تعلم عبر المستخدمين |
| 28 | `meta_learn` | MetaLearningOptimizer | تحسين التعلم الفوقي |
| 29 | `extract_heuristics` | HeuristicExtractor | استخراج قواعد إرشادية |
| 30 | `edge_privacy_status` | EdgePrivacy | حالة الخصوصية على الحافة |

### 1D. أدوات MIRROR — 5 أدوات جديدة
| # | اسم الأداة | الوحدة | الوصف |
|---|-----------|--------|-------|
| 31 | `inner_monologue` | InnerMonologueManager | الحوار الداخلي |
| 32 | `cognitive_control` | CognitiveController | تحكم معرفي |
| 33 | `episodic_buffer` | EpisodicBuffer | ذاكرة الحلقات |
| 34 | `digital_twin_simulate` | DigitalTwin | محاكاة بالتوأم الرقمي |
| 35 | `normative_check` | NormativeAgency | فحص المعايير الأخلاقية |

### 1E. أدوات Cosmic — 8 أدوات جديدة
| # | اسم الأداة | الوحدة | الوصف |
|---|-----------|--------|-------|
| 36 | `garden_status` | AutonomousGardener | حالة الحديقة الإبداعية |
| 37 | `rl_train` | RLEnvironment | تدريب التعلم المعزز |
| 38 | `meta_evolve` | MetaEvolution | تطور فوقي |
| 39 | `github_mine` | GitHubMiner | تعدين معرفة من GitHub |
| 40 | `zero_data_coevolve` | ZeroDataCoEvolution | تطور مشترك بدون بيانات |
| 41 | `dream_world_explore` | DreamWorld | استكشاف عالم الأحلام |
| 42 | `swarm_evolve` | SwarmEvolution | تطور السرب |
| 43 | `visual_workflow_build` | VisualWorkflowBuilder | بناء سير عمل بصري |

### 1F. أدوات تكامل وعالم — 10 أدوات جديدة
| # | اسم الأداة | الوحدة | الوصف |
|---|-----------|--------|-------|
| 44 | `screen_monitor` | ScreenMonitor | مراقبة الشاشة |
| 45 | `a2a_communicate` | A2AProtocolAdapter | تواصل وكيل-لوكيل |
| 46 | `web_intelligence` | WebIntelligence | استخبارات الويب |
| 47 | `web_mcp_bridge` | WebMCPBridge | جسر MCP الويب |
| 48 | `skill_md_registry` | SkillMdRegistry | سجل المهارات |
| 49 | `browser_agent_task` | BrowserAgent | تنفيذ مهمة متصفح |
| 50 | `world_simulate` | WorldSimulator | محاكاة العالم |
| 51 | `environment_graph_stats` | EnvironmentGraph | إحصائيات رسم البيئة |
| 52 | `self_forge_tool` | SelfForge | إنشاء أداة جديدة |
| 53 | `introspective_awareness` | IntrospectiveAwareness | الوعي الاستبطاني |

**المجموع: 53 أداة جديدة تُسجل في ToolRegistry**

---

## المرحلة 2: صفحات الداشبورد

### 2A. صفحات جديدة تماماً (12 صفحة)
| # | الصفحة | المسار | الميزات المغطاة |
|---|--------|--------|----------------|
| 1 | Dream Lab | `/dream-lab` | DreamMode, DreamWorld, HeuristicExtractor |
| 2 | Hive Mind | `/hive-mind` | HiveMind, SwarmEvolution |
| 3 | Economy | `/economy` | AgentEconomy, RLEnvironment (التداول) |
| 4 | Self-Forge | `/self-forge` | SelfForge, DynamicToolDiscovery |
| 5 | Safety | `/safety` | SafetyGuardrail, AntiSycophancy, SelfEvolvingSafetyMemory |
| 6 | MIRROR | `/mirror` | InnerMonologue, CognitiveController, EpisodicBuffer, DigitalTwin, NormativeAgency |
| 7 | Creative | `/creative` | CreativeEngine, AutonomousGardener |
| 8 | Evolution | `/evolution` | SelfEvolvingCode, MetaEvolution, GitHubMiner, ZeroDataCoEvolution, ApexEvolution |
| 9 | Browser Agent | `/browser-agent` | BrowserAgent, WebIntelligence |
| 10 | World Model | `/world-model` | WorldSimulator, EnvironmentGraph, CausalReplay |
| 11 | Meta-Learning | `/meta-learning` | MetaLearningOptimizer, StrategyTuner, PromptOptimizer, CrossUserLearner |
| 12 | Constitution | `/constitution` | TitanConstitution, NormativeAgency |

### 2B. توسيع صفحات موجودة (5 صفحات)
| # | الصفحة | الميزات المضافة |
|---|--------|----------------|
| 1 | Learning | ExperienceCollector, HeuristicExtractor, EdgePrivacy |
| 2 | Autonomous | ProactiveIntelligence, HyperAgent, SelfImprover, MetaMonitor, CuriosityEngine |
| 3 | Playground | UniversalTranslator, TemporalIntelligence, QuantumOptimizer, EmotionalIntelligence, TheoryOfMind |
| 4 | Insights (جديد أو دمج) | IntrospectionModule, IntrospectiveAwareness, BenchmarkingSuite, ExecutionStateMemory |
| 5 | Code Intel | SelfHealingDebugger, NeuroSymbolicReasoner, AutonomousSkillSynthesis, SelfRewriter |

---

## المرحلة 3: التنفيذ الصارم

### ترتيب التنفيذ
1. **المرحلة 1A-1F:** تسجيل 53 أداة جديدة في `capability-wiring.ts`
2. **اختبار كل أداة:** كتابة اختبار لكل أداة في `comprehensive-audit.test.ts`
3. **المرحلة 2A:** إنشاء 12 صفحة داشبورد جديدة
4. **المرحلة 2B:** توسيع 5 صفحات موجودة
5. **اختبار كل صفحة:** التأكد من أن كل صفحة تعرض البيانات وتتفاعل

### معايير القبول
- [ ] كل أداة مسجلة تظهر في `registry.list()`
- [ ] كل أداة يمكن استدعاؤها من الشات وتنجح
- [ ] كل صفحة داشبورد تعرض بيانات حقيقية من الـ API
- [ ] لا يوجد كسر في أي كود موجود
- [ ] جميع الاختبارات الحالية تنجح
- [ ] اختبارات جديدة تنجح لكل ميزة

---

## المرحلة 4: الاختبار النهائي الصارم

1. تشغيل `npx vitest run` — جميع الاختبارات تنجح
2. اختبار يدوي من الشات لكل أداة
3. اختبار يدوي من الداشبورد لكل صفحة
4. التأكد من 0% أخطاء
