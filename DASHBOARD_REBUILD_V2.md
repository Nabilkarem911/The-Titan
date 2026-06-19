# Dashboard Rebuild V2 — من الصفر الحقيقي

## الخطة

مسح **كل ملف في `apps/dashboard/src/`** بالكامل. مفيش ولا سطر كود قديم. نبدأ من صفحة بيضا.

اللي هيفضل بس: `package.json`, `tsconfig.json`, `vite.config.ts`, `tailwind.config.js`, `index.html`

---

## اللي هنبنيه

### ملفات أساسية (Infrastructure)

| ملف | الوظيفة |
|-----|---------|
| `main.tsx` | Entry point |
| `App.tsx` | Router + auth guard + lazy routes |
| `index.css` | Tailwind + design system |
| `api/client.ts` | fetch + tokens + errors — REAL endpoints بس |
| `contexts/AuthContext.tsx` | login/logout + token storage |
| `contexts/ThemeContext.tsx` | dark/light mode |
| `components/Layout.tsx` | Sidebar + header + search |
| `components/ErrorBoundary.tsx` | Error boundary |

---

### الصفحات — 23 صفحة (بعد دمج Templates في Agents و Teams في Workspaces)

كل صفحة مبنية على backend endpoint **حقيقي شغال**.

#### A. Core Workspace

| # | صفحة | الـ Backend | إيه بتعمل |
|---|-------|-----------|-----------|
| 1 | **Login** | `POST /api/v1/auth/login` | تسجيل دخول — response: `{ user, tokens: { accessToken, refreshToken } }` |
| 2 | **Dashboard** | `/health/dashboard` + `/metrics.json` | لوحة عامة — DB, Redis, queues |
| 3 | **Chat** | `POST /api/v1/chat` (SSE) | شات تفاعلي مع streaming + خطوات تفكير الـ agent |
| 4 | **Agents** | CRUD `/api/v1/agent-profiles` | بطاقات الـ agents — إنشاء، تعديل، حذف، تشغيل |
| 5 | **Playground** | `POST /api/v1/agents/:id/stream` (SSE) | تجربة agent — اختار profile + prompt + شوف النتيجة live |
| 6 | **Files & Editor** | `/api/v1/files/*` + `/api/v1/files/content` | file tree + Monaco editor في صفحة واحدة (زي VS Code مصغر) |

#### B. Operations

| # | صفحة | الـ Backend | إيه بتعمل |
|---|-------|-----------|-----------|
| 8 | **Runs** | `/api/v1/agents/:id/runs` + steps | سجل التشغيل — كل run بالـ steps والـ tools |
| 9 | **Terminal** | WebSocket `/terminal?token=...` | terminal تفاعلي — xterm.js |
| 10 | **Queue** | `/api/v1/admin/queues/:name/stats` | مراقبة 9 queues — waiting, active, completed, failed |
| 11 | **Cron** | CRUD `/api/v1/cron` | جدولة مهام — cron expression + agent |
| 12 | **Logs** | WebSocket `/ws` | live logs |
| 13 | **Health** | `/health/dashboard` + `/health/ready` | حالة النظام — DB, Redis, queues |
| 14 | **Metrics** | `/metrics.json` | Prometheus metrics |

#### C. Management

| # | صفحة | الـ Backend | إيه بتعمل |
|---|-------|-----------|-----------|
| 15 | **Webhooks** | CRUD `/api/v1/webhooks` | إدارة webhooks + سجل التسليم |
| 16 | **Plugins** | CRUD `/api/v1/plugins` | تصفح وتثبيت plugins |
| 17 | **API Keys** | `/api/v1/api-keys` | إنشاء وإلغاء API keys |
| 18 | **Settings** | `/api/v1/auth/me` + `/api/v1/user/keys` | البروفايل + provider secrets |
| 19 | **Audit Logs** | `/api/v1/compliance/audit/*` | سجل المراجعة + hash chain verification |

#### D. Advanced

| # | صفحة | الـ Backend | إيه بتعمل |
|---|-------|-----------|-----------|
| 20 | **Git** | `POST /api/v1/git/push` | commit & push |
| 21 | **Swarm** | `/api/v1/swarm/run` + tasks | تشغيل multi-agent |
| 22 | **Workspaces** | CRUD `/api/v1/workspaces` + members | إدارة workspaces — الـ Teams هتبقى tab جواها |
| 23 | **Memory** | Agent tools (remember/recall) | عرض الذاكرة |

> **تغييرات UX:**
> - **Templates** → هتبقى tab جوه صفحة **Agents** (اختار بروفايل جاهز)
> - **Teams** → هتبقى sub-view جوه صفحة **Workspaces** (إدارة الأعضاء)
> - **Editor + Files** → صفحة واحدة: file tree على الشمال + Monaco editor على اليمين (زي VS Code مصغر)

---

### مش هنبنيهم (الـ backend مش جاهز)

- Analytics — stub
- Integrations — stub
- Marketplace — stub
- Learning — stub
- Search — stub
- User Preferences — stub
- Workflow Designer — مفيش backend
- Cost Dashboard — stub
- Trace Viewer — stub

---

## Tech Stack

- React 18 + Vite + Tailwind CSS
- Tremor (charts)
- Lucide React (icons)
- Monaco Editor (code editor)
- xterm.js (terminal)

---

## ترتيب التنفيذ

### Phase 1: Infrastructure + Login + Dashboard
مسح `src/` → بناء الأساسيات → Login → Dashboard → NotFound
**التحقق:** TypeScript clean + Vite build

### Phase 2: Core Pages
Chat (SSE streaming), Agents (+ Templates tab), Playground, Files & Editor (merged)

### Phase 3: Operations
Runs, Terminal (xterm.js + WS reconnect), Queue, Cron, Logs, Health, Metrics

### Phase 4: Management
Webhooks, Plugins, API Keys, Settings, Audit Logs

### Phase 5: Advanced
Git, Swarm, Workspaces (+ Teams sub-view), Memory

### Phase 6: Build + Deploy
TypeScript check → Production build → Docker image

---

---

## إصلاحات تيتان (Agent Core) — قبل الداشبورد

### 1. تفعيل التفكير العميق (Planning + Strategy + Self-Critique)
**الملف:** `apps/core/src/routes/telegram.ts` → `createRunner()` call
**المشكلة:** الـ runner بيشتغل في Classic ReAct بدون planning أو strategies
**الحل:** تفعيل `enablePlanning`, `enableAutoStrategy`, `enableSelfCritique`

### 2. تقسيم الرسائل الطويلة على Telegram
**الملف:** `apps/core/src/routes/telegram.ts` → `sendTelegramMessage()`
**المشكلة:** Telegram limit = 4096 حرف. الرسائل الطويلة بتفشل
**الحل:** تقسيم الرسالة لـ chunks

### 3. Typing indicator مستمر أثناء التفكير ✅
**الحل:** بيبعت typing كل 4 ثواني طول ما الـ agent شغال

### 4. SSH في Docker Container
**الملف:** `apps/core/Dockerfile` + `docker-compose.yml`
**المشكلة:** الـ container مفيهوش `ssh` ولا `sshpass` — بيروحوا كل deploy
**الحل:** أضفنا `openssh-client sshpass git` في الـ Dockerfile + `titan-ssh` volume للـ SSH keys

### 5. Docker Socket للـ Container Orchestration
**الملف:** `docker-compose.yml`
**المشكلة:** `docker_orchestrator` tool مش شغال — مفيش docker.sock
**الحل:** mount `/var/run/docker.sock` في الـ core service

### 6. `ssh -i` كانت محظورة بالغلط ✅
**الملف:** `packages/tools/src/sandbox.ts`
**المشكلة:** forbidden pattern `sh -i` بيمسك `ssh -i`
**الحل:** regex مع negative lookbehind

---

## هوية Titan البصرية (Brand Identity) — "Cyber Monolith"

### الألوان
- Background: `#0A0F1D` (Deep Cyber Black)
- Cards: `#121829`
- Border: `#1E294B`
- Primary Accent: `#00F2FE` (Neon Cyan) — streams, active states
- Core Accent: `#7000FF` (Violet) — buttons, primary actions
- Error/Alert: `#FF007A` (Cyber Pink)
- Text: `#F8FAFC`

### الخطوط
- Headings: Space Grotesk
- Body: Inter
- Code/Terminal: JetBrains Mono

### متطلبات UI
- **Responsive** — يشتغل على mobile و tablet و desktop
- **RTL Support** — عربي وانجليزي (dir="rtl" و dir="ltr")
- **Dark theme primary** — الألوان السيبرانية فوق

---

## القواعد

1. **مفيش كود قديم** — كل سطر مكتوب من الصفر
2. **مفيش UI بدون backend** — كل صفحة مربوطة بـ endpoint حقيقي
3. **مفيش `catch { /* ignore */ }`** — كل error يتعرض للـ user
4. **مفيش hardcoded URLs** — API_BASE لـ `/api/v1/*`، paths مباشرة لـ `/health/*` و `/metrics*`
5. **كل صفحة فيها**: loading, error, empty, data states
6. **ممنوع `any`** — كل الـ Types تيجي من `@titan/shared` أو تتعرف صح في `api/client.ts`
7. **AbortController على كل fetch** — لما الـ user يسيب الصفحة، الـ request يتلغي (منع memory leaks و race conditions)
8. **Global Error Toast** — أي API error يظهر كـ toast فيه الـ status code والـ error message من Fastify
9. **WebSocket Token Security** — الـ Terminal token يكون short-lived، والـ connection تتأكد من الـ expiry
