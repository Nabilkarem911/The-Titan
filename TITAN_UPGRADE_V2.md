# TITAN UPGRADE V2 — الخطة النهائية للوحش

> آخر تحديث: 2026-06-18
> الهدف: تايتن يبقى أقوى agent framework في الوجود — CLI + Web + API
> القاعدة الذهبية: مفيش حاجة من V1 تتكسر

---

## الوضع الحالي (بعد V1)

| المكون | الحالة | LOC | Tests |
|--------|--------|-----|-------|
| Agent Engine (planner, reflection, strategies, personality) | ✅ | ~4,500 | 174 |
| Memory (5 layers, consolidation, graph, retrieval) | ✅ | ~3,200 | 96 |
| Tools (48 tool + MCP + composition) | ✅ | ~4,800 | 141 |
| Swarm + Workflow Engine | ✅ | ~2,200 | 82 |
| SDK + Streaming | ✅ | ~580 | 6 |
| Observability (eval, tracing, cost) | ✅ | ~1,300 | 91 |
| Resilience (circuit breaker, bulkhead, health) | ✅ | ~400 | 18 |
| Dashboard (28 pages) | ✅ | ~8,300 | — |
| Core API (17 routes, 65+ endpoints) | ✅ | ~5,000 | 14 |
| **المجموع** | | **~30K+** | **990** |

### اللي ناقص عشان يبقى "أقوى حد في الوجود"

تايتن دلوقتي **framework ممتاز** — بس مش **agent ذكي حقيقي**. الفرق:
- Claude Code يقدر **يفهم codebase كامل** ويتنقل فيه — تايتن لأ
- Claude Code عنده **CLI interface** تقدر تكلمه من الترمينال — تايتن web بس
- Claude Code **بيتعلم من السياق** ويفتكرك — تايتن ذاكرته سطحية في الاستخدام الفعلي
- Claude Code يقدر **يعدل كود، يشغله، يشوف النتيجة، ويصلح** — حلقة كاملة. تايتن بيعمل step واحدة وبيستنى

---

## V2 PLAN — 12 Phase

### Phase 1: Titan CLI — واجهة الترمينال
**الأولوية: 🔴 حرجة | المدة: 1-2 أسابيع**

تايتن يشتغل من الترمينال زي Claude Code — تكتبله أمر وينفذه.

```
titan-cli/
├── bin/
│   └── titan.ts                 # Entry point → #!/usr/bin/env node
├── src/
│   ├── cli.ts                   # Commander.js أو inquirer — parse args
│   ├── repl.ts                  # Interactive REPL loop (readline)
│   ├── auth.ts                  # Login, token storage (~/.titan/auth.json)
│   ├── config.ts                # CLI config (~/.titan/config.json)
│   ├── commands/
│   │   ├── chat.ts              # titan chat "سؤالك"
│   │   ├── run.ts               # titan run --agent code-helper "اعمل API"
│   │   ├── swarm.ts             # titan swarm "حلل المشروع ده"
│   │   ├── files.ts             # titan files list / upload / download
│   │   ├── status.ts            # titan status — health + queue stats
│   │   ├── history.ts           # titan history — آخر المحادثات
│   │   ├── config-cmd.ts        # titan config set/get
│   │   └── login.ts             # titan login
│   ├── renderer/
│   │   ├── markdown.ts          # Render markdown في الترمينال (chalk + marked)
│   │   ├── spinner.ts           # Loading indicators
│   │   ├── stream-printer.ts    # SSE token-by-token printing
│   │   └── code-highlight.ts    # Syntax highlighting
│   ├── context/
│   │   ├── project-detector.ts  # يكتشف نوع المشروع (package.json, Cargo.toml, etc.)
│   │   ├── git-context.ts       # يقرأ git status, branch, recent commits
│   │   └── file-indexer.ts      # يعمل index للملفات المهمة
│   └── connection/
│       ├── api-client.ts        # Uses @titan/sdk internally
│       ├── ws-client.ts         # WebSocket for real-time updates
│       └── local-mode.ts        # يشتغل locally بدون سيرفر (embedded agent)
├── package.json
└── tsconfig.json
```

**القدرات:**
- `titan chat "ازيك يا تايتن"` — محادثة سريعة
- `titan run "اعمل REST API بـ auth"` — ينفذ مهمة كاملة
- `titan chat` (بدون args) — يدخل REPL تفاعلي
- `titan --local` — يشتغل بدون سيرفر (يستخدم LLM API مباشرة)
- **Streaming** — الرد يطبع token بـ token زي Claude Code
- **Markdown rendering** — كود مع syntax highlighting في الترمينال
- **Project awareness** — يعرف إنت في أي مشروع ويقرأ الـ context
- **Auth** — يعمل login مرة واحدة ويحفظ الـ token في `~/.titan/`

**الربط بالسيرفر:**
- الـ CLI بيتكلم مع الـ API server عن طريق `@titan/sdk`
- لو الـ user عنده سيرفر Dokploy → يعمل `titan login --server https://titan.example.com`
- لو عايز يشتغل local → `titan --local --model gpt-4o` يستخدم الـ agent engine مباشرة

---

### Phase 2: Deep Code Intelligence — فهم الكود
**الأولوية: 🔴 حرجة | المدة: 2-3 أسابيع**

تايتن يفهم الـ codebase بالكامل — مش بس يقرأ ملف واحد.

```
packages/agent-engine/src/code-intel/
├── indexer/
│   ├── file-crawler.ts          # يمشي على كل الملفات (respects .gitignore)
│   ├── ast-parser.ts            # يحلل TypeScript/JavaScript AST
│   ├── symbol-extractor.ts      # يستخرج functions, classes, types, exports
│   ├── dependency-mapper.ts     # import graph — مين بيعتمد على مين
│   └── codebase-index.ts        # Full-text + semantic index للكود
├── search/
│   ├── semantic-code-search.ts  # "ابحث عن function بتعمل auth" → يلاقيها
│   ├── symbol-lookup.ts         # "وريني الـ AgentRunner class" → يروحله
│   └── reference-finder.ts      # "مين بيستخدم هذا الـ function؟"
├── analysis/
│   ├── complexity-analyzer.ts   # Cyclomatic complexity, lines, etc.
│   ├── dead-code-detector.ts    # كود مش مستخدم
│   ├── pattern-detector.ts      # يكتشف design patterns
│   └── tech-debt-scorer.ts      # يقيم الـ tech debt
└── context/
    ├── smart-context.ts         # يختار أهم الملفات للـ LLM context
    ├── chunk-splitter.ts        # يقسم الملفات الكبيرة بذكاء
    └── relevance-ranker.ts      # يرتب الملفات حسب الأهمية للسؤال
```

**القدرات:**
- **Codebase indexing** — يعمل index كامل للمشروع (files, symbols, dependencies)
- **Semantic code search** — "ابحث عن الكود اللي بيعمل rate limiting" → يلاقي الملفات المناسبة
- **Smart context selection** — بدل ما يبعت كل الكود للـ LLM، يختار بس الأجزاء المهمة
- **Dependency graph** — يعرف مين بيستورد مين ولو غيرت حاجة هنا إيه اللي هيتأثر
- **AST-level understanding** — يفهم structure الكود مش بس النص

---

### Phase 3: Autonomous Execution Loop — التنفيذ المستقل
**الأولوية: 🔴 حرجة | المدة: 2 أسابيع**

تايتن يقدر ينفذ مهمة كاملة لوحده — يخطط، ينفذ، يتحقق، يصلح.

```
packages/agent-engine/src/autonomous/
├── task-executor.ts             # الحلقة الرئيسية: plan → execute → verify → fix
├── verification/
│   ├── test-runner.ts           # يشغل الـ tests ويشوف النتيجة
│   ├── type-checker.ts          # يشغل tsc ويحلل الأخطاء
│   ├── lint-checker.ts          # يشغل eslint
│   └── build-checker.ts         # يعمل build ويشوف لو نجح
├── fix-loop/
│   ├── error-parser.ts          # يفهم رسالة الإيرور
│   ├── auto-fixer.ts            # يحاول يصلح تلقائياً
│   └── rollback.ts              # لو الإصلاح وسّع المشكلة → يرجع
├── git-ops/
│   ├── branch-manager.ts        # يعمل branch جديد للشغل
│   ├── commit-crafter.ts        # يكتب commit messages ذكية
│   ├── pr-creator.ts            # يفتح PR مع وصف شامل
│   └── diff-analyzer.ts         # يحلل الـ diff قبل الـ commit
└── sandbox/
    ├── safe-executor.ts         # ينفذ في بيئة معزولة
    └── resource-monitor.ts      # يراقب CPU/RAM/Disk usage
```

**الحلقة:**
```
1. User: "اعمل endpoint جديد /api/v1/analytics"
2. Titan يحلل الـ codebase → يفهم الـ patterns الموجودة
3. يكتب الكود (route + handler + types + tests)
4. يشغل tsc → لو فيه errors يصلحها
5. يشغل الـ tests → لو فشلت يصلح
6. يعمل git commit + PR
7. يرد على الـ user بملخص اللي عمله
```

---

### Phase 4: Persistent Identity & User Bonding — الهوية الدائمة
**الأولوية: 🟠 عالية | المدة: 1-2 أسابيع**

تايتن يعرفك شخصياً — يفتكر محادثاتكم، أسلوبك، مشاريعك.

```
packages/memory/src/identity/
├── user-profile-builder.ts      # يبني profile تدريجي من المحادثات
├── relationship-tracker.ts      # يتتبع العلاقة (developer, user, admin)
├── preference-learner.ts        # يتعلم preferences تلقائياً (مش manually)
├── conversation-continuity.ts   # يربط محادثات مختلفة ببعض
├── project-memory.ts            # يفتكر كل مشروع واللي اتعمل فيه
└── persona-adapter.ts           # يكيف شخصيته حسب الـ user
```

**الربط بالداتابيز (PostgreSQL على Dokploy):**
```sql
-- New tables
CREATE TABLE user_long_term_memory (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  category TEXT NOT NULL,  -- 'preference', 'fact', 'relationship', 'project'
  confidence FLOAT DEFAULT 0.5,
  source TEXT,             -- 'inferred', 'explicit', 'observed'
  access_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, key)
);

CREATE TABLE conversation_summaries (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  topics TEXT[],
  decisions TEXT[],
  action_items TEXT[],
  mood TEXT,               -- 'positive', 'neutral', 'frustrated', 'excited'
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE project_context (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  project_name TEXT NOT NULL,
  project_path TEXT,
  tech_stack TEXT[],
  architecture_notes TEXT,
  known_issues TEXT[],
  recent_changes TEXT[],
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, project_name)
);
```

**القدرات:**
- يفتكرك بين الـ sessions — "آخر مرة كنت شغال على الـ auth module"
- يتعلم أسلوبك — لو بتحب الكود مختصر هيكتبلك مختصر
- يعرف مشاريعك — "مشروع تايتن بيستخدم Fastify وPostgreSQL"
- يتكيف — لو جديد عليك يشرح أكتر، لو expert يختصر

---

### Phase 5: Computer Use & Browser Agent — التحكم بالكمبيوتر
**الأولوية: 🟠 عالية | المدة: 2 أسابيع**

تايتن يقدر يتصفح الإنترنت، ياخد screenshots، يملأ forms.

```
packages/tools/src/browser/
├── browser-pool.ts              # Playwright browser instances pool
├── page-controller.ts           # navigate, click, type, scroll, wait
├── screenshot-analyzer.ts       # ياخد screenshot ويحللها بالـ vision
├── element-finder.ts            # يلاقي elements بالـ AI (مش CSS selectors بس)
├── form-filler.ts               # يملأ forms تلقائياً
├── data-extractor.ts            # يستخرج بيانات من صفحات
├── session-manager.ts           # يحفظ cookies/sessions
└── browser-agent.ts             # Agent wrapper — يتصفح ويحقق أهداف
```

**القدرات:**
- "افتح GitHub وشوف آخر issues" → يفتح الموقع ويقرأه
- "اعمل login على Dokploy وشوف status الـ containers" → يدخل ويتصفح
- "خد screenshot من الصفحة دي وقولي فيها إيه" → vision analysis
- "ادخل على Grafana وشوف الـ metrics" → يقرأ dashboards

---

### Phase 6: Advanced RAG & Document Intelligence — ذكاء المستندات
**الأولوية: 🟡 متوسطة-عالية | المدة: 1-2 أسابيع**

تايتن يقرأ ويفهم أي مستند — PDF, Word, Excel, صور, فيديو.

```
packages/memory/src/rag/
├── document-processor.ts        # يحلل أي نوع ملف
├── chunk-strategy.ts            # يقسم المستندات بذكاء (semantic chunking)
├── multi-modal-embedder.ts      # embeddings للنص + الصور + الجداول
├── citation-tracker.ts          # يرجع المصدر مع كل إجابة
├── knowledge-base.ts            # قاعدة معرفة ثابتة (docs, manuals, SOPs)
└── hybrid-rag-pipeline.ts       # vector search + keyword + reranking
```

**القدرات:**
- ارفعله PDF كبير → يقسمه، يعمله index، وتسأله أي سؤال عنه
- ارفعله Excel → يحلل البيانات ويعمل charts
- ارفعله صورة → يفهمها ويوصفها (vision model)
- **Citations** — كل إجابة فيها مرجع "الصفحة 15، الفقرة 3"

---

### Phase 7: Voice & Real-time Conversation — الصوت
**الأولوية: 🟡 متوسطة | المدة: 1-2 أسابيع**

تايتن يتكلم — تقدر تكلمه بالصوت ويرد عليك بالصوت.

```
packages/agent-engine/src/voice/
├── stt-provider.ts              # Speech-to-Text (Whisper API / Deepgram)
├── tts-provider.ts              # Text-to-Speech (ElevenLabs / OpenAI TTS)
├── voice-activity-detector.ts   # يعرف امتى تبدأ وتخلص كلام
├── conversation-manager.ts      # يدير المحادثة الصوتية (turn-taking)
├── emotion-detector.ts          # يكتشف المشاعر من نبرة الصوت
└── voice-profiles.ts            # أصوات مختلفة لـ personas مختلفة
```

**القدرات:**
- كلمه بالصوت من الداشبورد أو الـ CLI
- يرد بصوت طبيعي — مش robotic
- يفهم اللهجة — مصري، خليجي، شامي
- يكتشف لو إنت مستعجل أو مرتاح من نبرة صوتك

---

### Phase 8: Multi-Agent Teams — فرق عمل ذكية
**الأولوية: 🟡 متوسطة | المدة: 2 أسابيع**

مش agent واحد — فريق كامل كل واحد متخصص.

```
packages/agent-engine/src/teams/
├── team-builder.ts              # يبني فريق حسب المهمة
├── role-assigner.ts             # يوزع الأدوار بذكاء
├── meeting-protocol.ts          # الـ agents "تتاجمع" وتتناقش
├── peer-review.ts               # agent يراجع شغل agent تاني
├── knowledge-sharing.ts         # يتشاركوا معلومات
├── voting-system.ts             # لو اختلفوا يتصوتوا
└── team-templates/
    ├── dev-team.ts              # PM + Frontend + Backend + QA
    ├── research-team.ts         # Lead + Researchers + Analyst + Writer
    ├── content-team.ts          # Strategist + Writer + Editor + Designer
    └── ops-team.ts              # SRE + Security + DBA + DevOps
```

**القدرات:**
- "عايز فريق يبني لي landing page" → PM يخطط, Frontend يكتب, Designer يراجع
- **Peer review** — كل agent يراجع شغل الـ agent التاني
- **Meetings** — الـ agents تتناقش وتاخد قرارات جماعية
- **Specialization** — كل agent عنده personality وخبرة مختلفة

---

### Phase 9: Self-Learning & Auto-Improvement — التعلم الذاتي
**الأولوية: 🟡 متوسطة | المدة: 2 أسابيع**

تايتن يتحسن مع الوقت — يتعلم من أخطائه ونجاحاته.

```
packages/agent-engine/src/learning/
├── experience-collector.ts      # يجمع كل تجربة (نجاح/فشل/feedback)
├── pattern-learner.ts           # يكتشف patterns في سلوكه
├── prompt-optimizer.ts          # يحسن الـ prompts تلقائياً بناءً على النتائج
├── strategy-tuner.ts            # يتعلم أي strategy أحسن لأي نوع مهمة
├── tool-preference-learner.ts   # يتعلم أي tools أنجح لأي سيناريو
├── feedback-processor.ts        # يفهم feedback الـ user (👍/👎/تعليق)
├── benchmark-runner.ts          # يختبر نفسه بشكل دوري
└── ab-tester.ts                 # يقارن approaches مختلفة ويختار الأحسن
```

**القدرات:**
- لو نفس النوع من الأسئلة بيفشل فيه → يعدل الـ approach تلقائياً
- لو الـ user بيدي 👎 كتير على نوع معين → يتعلم ويتحسن
- **Weekly self-benchmark** — يختبر نفسه كل أسبوع ويقارن بالأسبوع اللي فات
- **A/B testing** — يجرب approach A و B ويشوف أيهم أحسن

---

### Phase 10: Plugin Marketplace & Community — المجتمع
**الأولوية: 🔵 منخفضة-متوسطة | المدة: 2 أسابيع**

أي حد يقدر يبني tools و agents ويشاركها.

```
packages/tools/src/marketplace/
├── plugin-store.ts              # Browse, search, install plugins
├── plugin-validator.ts          # Security scan قبل التنصيب
├── plugin-sandbox.ts            # تشغيل plugins في sandbox آمن
├── rating-system.ts             # Users rate plugins
├── version-manager.ts           # Semantic versioning + auto-update
└── publisher.ts                 # نشر plugin جديد
```

```
packages/agent-engine/src/marketplace/
├── agent-store.ts               # Browse, clone, customize agent profiles
├── template-importer.ts         # استيراد agent templates
├── sharing-protocol.ts          # مشاركة agents بين teams
└── community-benchmarks.ts      # Leaderboard — أحسن agents
```

---

### Phase 11: Enterprise Features — المؤسسات
**الأولوية: 🔵 منخفضة | المدة: 2-3 أسابيع**

تايتن جاهز للشركات الكبيرة.

```
packages/auth/src/enterprise/
├── sso-provider.ts              # SAML / OAuth2 / OpenID Connect
├── ldap-connector.ts            # Active Directory integration
├── team-management.ts           # Teams, roles, permissions hierarchy
├── usage-quotas.ts              # حدود استخدام per team/user
└── billing-tracker.ts           # تتبع الاستهلاك والتكلفة

packages/shared/src/compliance/
├── data-residency.ts            # البيانات تتخزن في أي region
├── pii-detector.ts              # يكتشف بيانات شخصية ويحميها
├── audit-exporter.ts            # تصدير audit logs بصيغ مختلفة
├── retention-enforcer.ts        # تطبيق سياسات الاحتفاظ بالبيانات
└── gdpr-toolkit.ts              # حق الحذف، التصدير، الموافقة
```

---

### Phase 12: Mobile & Cross-Platform — الموبايل
**الأولوية: 🔵 منخفضة | المدة: 3-4 أسابيع**

تايتن على الموبايل — تكلمه من أي مكان.

```
apps/mobile/                     # React Native أو Expo
├── screens/
│   ├── ChatScreen.tsx           # الشاشة الرئيسية — chat
│   ├── VoiceScreen.tsx          # محادثة صوتية
│   ├── FilesScreen.tsx          # إدارة ملفات
│   ├── SettingsScreen.tsx       # إعدادات
│   └── DashboardScreen.tsx      # ملخص سريع
├── services/
│   ├── api.ts                   # SDK wrapper
│   ├── notifications.ts         # Push notifications
│   ├── voice.ts                 # Voice recording
│   └── offline.ts               # يشتغل offline (cached responses)
```

---

## الربط بالسيرفر (Dokploy + PostgreSQL)

### المعمارية المقترحة

```
┌─────────────────────────────────────────────────┐
│                   المستخدم                       │
│  CLI (titan chat) │ Web (Dashboard) │ Mobile     │
└────────┬──────────┴──────┬──────────┴───┬────────┘
         │                 │              │
         └────────────┬────┘──────────────┘
                      │
              ┌───────▼───────┐
              │   Titan Core   │  ← Dokploy Container
              │   (Fastify)    │
              │   Port 3000    │
              └───┬───┬───┬───┘
                  │   │   │
    ┌─────────────┤   │   ├─────────────┐
    │             │   │   │             │
┌───▼───┐  ┌─────▼───▼───▼─────┐  ┌───▼───┐
│ Redis │  │   PostgreSQL       │  │ Embed │
│ Queue │  │   + pgvector       │  │Service│
│ Cache │  │   (حاوية منفصلة)   │  │       │
└───────┘  │                    │  └───────┘
           │ Tables:            │
           │ - users            │
           │ - agent_runs       │
           │ - memory_*         │
           │ - user_long_term   │  ← جديد
           │ - conversation_sum │  ← جديد
           │ - project_context  │  ← جديد
           │ - code_index       │  ← جديد
           │ - learning_*       │  ← جديد
           └────────────────────┘
```

### الاتصال بالحاوية المنفصلة
```env
# .env على Dokploy
POSTGRES_HOST=titan-postgres        # اسم الحاوية
POSTGRES_PORT=5432
POSTGRES_DB=titan
POSTGRES_USER=titan
POSTGRES_PASSWORD=<secure-password>

# لو الحاوية على network مختلف
POSTGRES_HOST=172.17.0.x            # IP الحاوية
```

الـ CLI هيتصل بالسيرفر عن طريق HTTPS:
```bash
titan login --server https://your-domain.com --email you@email.com
# يحفظ الـ token في ~/.titan/auth.json
# كل أمر بعد كده يروح للسيرفر
```

---

## ملخص الأولويات

| # | Phase | اللي بيعمله | الأولوية | المدة |
|---|-------|------------|----------|-------|
| 1 | **CLI Interface** | تايتن يشتغل من الترمينال | 🔴 حرجة | 1-2 أسابيع |
| 2 | **Code Intelligence** | يفهم أي codebase بالكامل | 🔴 حرجة | 2-3 أسابيع |
| 3 | **Autonomous Execution** | ينفذ مهام كاملة لوحده | 🔴 حرجة | 2 أسابيع |
| 4 | **Persistent Identity** | يعرفك ويفتكرك (DB-backed) | 🟠 عالية | 1-2 أسابيع |
| 5 | **Computer Use** | يتصفح الإنترنت ويتعامل مع مواقع | 🟠 عالية | 2 أسابيع |
| 6 | **Document Intelligence** | يقرأ ويفهم أي مستند | 🟡 متوسطة-عالية | 1-2 أسابيع |
| 7 | **Voice Interface** | محادثة صوتية طبيعية | 🟡 متوسطة | 1-2 أسابيع |
| 8 | **Multi-Agent Teams** | فرق عمل ذكية متخصصة | 🟡 متوسطة | 2 أسابيع |
| 9 | **Self-Learning** | يتحسن مع الوقت تلقائياً | 🟡 متوسطة | 2 أسابيع |
| 10 | **Plugin Marketplace** | مجتمع يبني tools و agents | 🔵 منخفضة-متوسطة | 2 أسابيع |
| 11 | **Enterprise** | SSO, teams, quotas, compliance | 🔵 منخفضة | 2-3 أسابيع |
| 12 | **Mobile App** | تايتن على الموبايل | 🔵 منخفضة | 3-4 أسابيع |

---

## الفرق بين V1 و V2

| القدرة | V1 (الحالي) | V2 (الهدف) |
|--------|------------|------------|
| الواجهة | Web dashboard فقط | **CLI + Web + Mobile + Voice** |
| فهم الكود | يقرأ ملف واحد | **يفهم codebase كامل + AST + dependencies** |
| التنفيذ | step واحدة ويستنى | **حلقة كاملة: كتابة → تشغيل → فحص → إصلاح** |
| الذاكرة | vector search بسيط | **5 layers + knowledge graph + DB-backed persistence** |
| الهوية | مفيش | **يعرفك، يفتكرك، يتكيف معاك** |
| التعلم | مفيش | **يتحسن من أخطائه + A/B testing + benchmarks** |
| الصوت | text فقط | **STT + TTS + emotion detection** |
| Browser | مفيش | **Playwright + vision + form filling** |
| Teams | swarm بسيط | **فرق متخصصة + peer review + meetings** |
| Enterprise | basic RBAC | **SSO + LDAP + quotas + compliance** |
| Mobile | مفيش | **React Native app** |

---

## القاعدة الذهبية

> كل حاجة جديدة في V2 هي **إضافة** مش استبدال.
> الـ runner.ts, الـ memory client, الـ tool registry, الـ dashboard — كل ده يفضل شغال زي ما هو.
> الموديولات الجديدة بتتبنى **جنب** الموجود وبتتكامل معاه عن طريق interfaces.
> مفيش breaking changes. مفيش migration لكود موجود. مفيش إعادة كتابة.

---

## الخلاصة

V1 خلى تايتن **framework قوي** — بنية سليمة, أمان, اختبارات, dashboard.

V2 هيخليه **agent ذكي حقيقي** — يفهم كود, ينفذ مهام, يتعلم, يتكلم, يفتكرك.

الفرق بين "framework" و "agent" هو: الـ framework محتاج حد يستخدمه. الـ agent **بيستخدم نفسه**.

ابدأ بـ Phase 1 (CLI) + Phase 2 (Code Intel) + Phase 3 (Autonomous) — دول هيعملوا أكبر فرق. الـ user يقدر يكلم تايتن من الترمينال, تايتن يفهم الكود, وينفذ المهمة لوحده.
