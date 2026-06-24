# خطة المراجعة الصارمة — Full Audit Plan (محدثة)

## الجزء الأول: Routes (اتصلحت ✅)
- analytics.ts, search.ts, marketplace.ts, user-preferences.ts, export-import.ts, learning.ts, command.ts — كلها اتربطت بالداتابيس واتسجلت في server.ts
- /api/v1/dream/trigger اتربط بجلب experiences من الداتابيس
- integrations.ts القديم مش مسجل ومستبدل بـ integrations-v2.ts

---

## الجزء الثاني: Agent-Engine modules لسه بتحط في الرام بدون DB

### Economy — محتاجين migration + repositories + wiring كامل
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| agent-economy.ts | accounts, reputation, listings, offers, escrows, auditLog | ❌ ولا واحدة |
| autonomous-trading.ts | episodes, qTable | ❌ ولا واحدة |

### Voice
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| elevenlabs-tts.ts | clonedVoices | ❌ |
| conversation-manager.ts | sessions, history | ❌ |

### Workflow
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| dag-workflow-engine.ts | executions | ❌ |
| workflow-builder.ts | nodes, edges | ❌ (builder — wiring عند save) |

### Reasoning
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| test-time-recursive-thinking.ts | globalKnowledge, results | ❌ |
| self-rewriter.ts | pipelines, versions | ❌ |
| self-healing-debugger.ts | lessons, attempts | ❌ |
| neuro-symbolic.ts | rules (2 places) | ❌ (results متوصلة) |
| hyper-agent.ts | successPatterns, failurePatterns, performanceHistory | ❌ (cycles متوصلة) |
| execution-state-memory.ts | checkpoints, runCheckpoints | ❌ |
| benchmarking-suite.ts | suites | ❌ (results متوصلة) |
| apex-evolution.ts | principles | ❌ (patches متوصلة) |
| tool-discovery.ts | queries | ❌ (discovered tools متوصلة) |
| skill-synthesis.ts | results | ❌ (skills متوصلة) |

### Metacognition
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| multi-layer-guardrails.ts | results, layerConfigs, customLayers | ❌ |
| metacognitive-consolidation.ts | microLessons, metaKnowledge (2) | ❌ (reflections متوصلة) |
| introspection.ts | reports, biasCounts | ❌ |
| curiosity-engine.ts | knowledgeGaps | ❌ (explorations/skills متوصلة) |
| theory-of-mind.ts | models | ❌ (analyses متوصلة) |
| safety-memory.ts | strategyIndex | ❌ (cells متوصلة) |
| safety-guardrail.ts | blockedPatterns, riskCategoryCounts | ❌ (results متوصلة) |
| capability-registry.ts | capabilities | ❌ |
| anti-sycophancy.ts | hedgeWordCounts | ❌ (assessments متوصلة) |

### Mirror
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| orchestrator.ts | buffer items (3 places) | ❌ |
| normative-agency.ts | revisions | ❌ (commitments/conflicts متوصلة) |
| inner-monologue.ts | threads | ❌ |
| episodic-buffer.ts | items | ❌ |
| cognitive-controller.ts | narrativeHistory | ❌ |

### World-model
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| environment-graph.ts | relations | ❌ (entities/events متوصلة) |
| autonomous-loop.ts | results (line 178) | ❌ (line 259 متوصلة) |

### Swarm
| الملف | الـ in-memory | الـ DB call |
|------|--------------|-------------|
| shared-workspace.ts | artifacts, notes | ❌ |
| swarm-evolution.ts | federationTasks (3), collectiveMemory conflict | ❌ (topologies/memory متوصلة) |

---

## الجزء الثالث: ترتيب التنفيذ

1. إنشاء migration 0032 لكل الجداول الناقصة (~25 جدول)
2. إنشاء repositories لكل جدول جديد
3. ربط كل module بالـ DB (إضافة .catch(() => {}) calls)
4. Build + verify + commit + push
