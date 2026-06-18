# خطة إعادة بناء الداشبورد — Dashboard Rebuild Plan

> الهدف: داشبورد احترافية — كل صفحة شغالة، كل وظيفة مربوطة صح، UI/UX ممتاز
> القاعدة: مش بنعيد كتابة كل حاجة — بنصلح ونحسن اللي موجود

---

## تحليل الوضع الحالي

### اللي شغال كويس ومش هنلمسه:
- Router + lazy loading + code splitting ✅
- Auth context + token refresh ✅
- Theme context (dark/light) ✅
- Notification context ✅
- Layout (sidebar + header + search) ✅
- ErrorBoundary ✅
- Tailwind config ✅
- Login page ✅

### المشاكل الموجودة:

| المشكلة | عدد الصفحات المتأثرة | الخطورة |
|---------|---------------------|---------|
| **Silent error catching** — `catch { /* ignore */ }` | 20+ صفحة | 🔴 عالية |
| **مفيش error UI** — الـ user مش بيشوف أي خطأ | 25+ صفحة | 🔴 عالية |
| **Hardcoded URLs** — مش بتستخدم `API_BASE` | 3 صفحات | 🟠 متوسطة |
| **مفيش loading states** — الصفحة فاضية وبتحمل | 15+ صفحة | 🟠 متوسطة |
| **مفيش input validation** — الـ forms بتبعت بدون check | 10+ صفحات | 🟠 متوسطة |
| **Git page مش مربوطة** — مفيش GitHub integration حقيقي | 1 صفحة | 🔴 عالية |
| **Terminal WebSocket بدون reconnect** | 1 صفحة | 🟡 منخفضة |
| **15 صفحة جديدة placeholder** — بيانات ثابتة مش حقيقية | 15 صفحة | 🟠 متوسطة |

---

## خطة العمل — 8 مراحل

### المرحلة 1: إصلاح البنية الأساسية
**الملفات:** `api/client.ts`, `contexts/`, `components/Layout.tsx`

**المهام:**
1. **تحسين `api/client.ts`:**
   - إضافة methods جديدة لكل الـ API endpoints الموجودة (analytics, learning, search, integrations, marketplace, export)
   - إضافة `onError` callback عام — بدل ما كل صفحة تتعامل مع الأخطاء لوحدها
   - إضافة retry logic (مرة واحدة) للـ network errors
   - إضافة request/response interceptors

2. **إضافة `useApi` hook:**
   ```typescript
   // hook يبسط الـ API calls في كل صفحة
   const { data, loading, error, refetch } = useApi('/agents');
   ```

3. **إضافة Error Toast component:**
   - أي API error يظهر كـ toast notification
   - مش بس console.log — الـ user يشوف الخطأ

4. **إضافة Loading Skeleton component:**
   - skeleton cards, skeleton tables, skeleton text
   - يظهر أثناء التحميل بدل الصفحة الفاضية

5. **تحديث Layout.tsx:**
   - إضافة الـ 15 صفحة الجديدة في الـ sidebar
   - تحسين الـ navigation grouping

**الربط:** Layout → App.tsx routes → api/client.ts

---

### المرحلة 2: إصلاح الصفحات الأساسية (Core Pages)
**الصفحات:** Dashboard, Chat, Agents, Playground, Settings, Login

**Dashboard.tsx — الصفحة الرئيسية:**
- إصلاح hardcoded URLs (`/health/dashboard`, `/metrics.json`)
- استخدام `API_BASE` في كل مكان
- إضافة error states بدل `catch(() => null)`
- إضافة loading skeletons
- إضافة "Quick Actions" cards (chat, run agent, upload file)

**Chat.tsx:**
- التأكد من SSE streaming شغال
- إضافة reconnect logic
- إضافة typing indicator
- إضافة error message عند connection loss

**Agents.tsx:**
- شغالة بالفعل — بس محتاجة error toasts
- إضافة loading skeleton

**Settings.tsx:**
- إصلاح silent errors
- إضافة success/error feedback عند الحفظ

---

### المرحلة 3: إصلاح صفحات العمليات (Operations Pages)
**الصفحات:** Runs, Queue, Metrics, Logs, Cron, Webhooks, AuditLogs, Health

**Runs.tsx:**
- WebSocket reconnect موجود ✅
- إضافة error UI عند connection loss
- إضافة loading state

**Queue.tsx:**
- إصلاح hardcoded URL `/api/v1/admin/queues/`
- إضافة error handling

**Metrics.tsx:**
- إصلاح hardcoded `/metrics.json`
- إضافة fallback UI

**Terminal.tsx:**
- إضافة WebSocket reconnect logic
- إضافة connection status indicator (connected/disconnected/reconnecting)
- إصلاح `token=undefined` في الـ WebSocket URL

**Health.tsx:**
- إصلاح hardcoded `/health/dashboard`
- إضافة service status cards

---

### المرحلة 4: إصلاح Git Page بالكامل
**الصفحة:** Git.tsx

**المشكلة الحالية:** الصفحة بتعمل git push بدون ما تعرف على أي ريبو أو بأي credentials.

**الإصلاح:**
1. إضافة **GitHub Integration Setup:**
   - صفحة ربط حساب GitHub (OAuth أو Personal Access Token)
   - حفظ الـ token في الـ DB (مشفر)
   
2. إضافة **Repository Selection:**
   - عرض الـ repos المتاحة من GitHub API
   - اختيار الـ repo المطلوب
   
3. إضافة **Pre-push Checks:**
   - عرض الـ git status قبل الـ push
   - عرض الـ diff
   - تأكيد من الـ user قبل الـ push

4. إضافة **Branch Management:**
   - عرض الـ branches
   - إنشاء branch جديد
   - switch بين branches

**الربط:** Git.tsx → `/api/v1/git/` endpoints → GitHub API

---

### المرحلة 5: إصلاح صفحات الملفات والمحرر
**الصفحات:** Files, Editor, Projects

**Files.tsx:**
- إصلاح error handling
- إضافة drag & drop upload
- إضافة file preview (images, PDF, text)
- إضافة file size/type validation

**Editor.tsx:**
- التأكد من Monaco Editor شغال بعد CSP fix
- إضافة file tree sidebar
- إضافة save feedback

**Projects.tsx:**
- ربط بالـ API صح
- إضافة project creation flow

---

### المرحلة 6: تفعيل الـ 15 صفحة الجديدة
**الصفحات:** Analytics, CostDashboard, TraceViewer, WorkflowDesigner, KnowledgeBase, UserProfile, AgentPerformance, ModelComparison, ToolStats, IntegrationHub, MarketplacePage, LearningDashboard, ErrorExplorer, NotificationCenter, WorkspaceInsights

**لكل صفحة:**
1. ربطها بالـ API endpoints الصحيحة
2. إضافتها في `App.tsx` routes (لو مش موجودة)
3. إضافتها في Layout sidebar
4. إضافة loading + error states
5. التأكد من إنها بتعرض بيانات حقيقية مش placeholder

**الأولوية:**
| الصفحة | الأولوية | السبب |
|--------|----------|-------|
| UserProfile | 🔴 عالية | الـ user محتاج يعدل settings |
| IntegrationHub | 🔴 عالية | ربط الخدمات الخارجية |
| Analytics | 🟠 متوسطة | مراقبة الاستخدام |
| NotificationCenter | 🟠 متوسطة | الـ user محتاج يشوف notifications |
| TraceViewer | 🟡 منخفضة | debugging tool |
| WorkflowDesigner | 🟡 منخفضة | advanced feature |

---

### المرحلة 7: تحسين UI/UX
**شامل كل الصفحات:**

1. **Consistent Error States:**
   ```
   كل صفحة لازم يبقى فيها:
   - Loading state (skeleton)
   - Empty state (icon + message + action)
   - Error state (icon + message + retry button)
   - Success state (data displayed)
   ```

2. **Form Validation:**
   - كل input فيه validation
   - Error messages تحت الـ field
   - Disable submit أثناء التحميل
   - Success toast بعد الحفظ

3. **Responsive Design:**
   - التأكد من كل صفحة شغالة على mobile
   - Tables تتحول لـ cards على الشاشات الصغيرة

4. **Accessibility:**
   - aria-labels على كل الـ interactive elements
   - Keyboard navigation
   - Focus management

5. **Performance:**
   - Virtualized lists للـ tables الكبيرة
   - Debounced search inputs
   - Memoized expensive computations

---

### المرحلة 8: Testing + Final Polish

1. **Manual Testing Checklist:**
   ```
   لكل صفحة:
   [ ] الصفحة بتحمل بدون errors
   [ ] الـ loading state ظاهر
   [ ] الـ data بتتعرض صح
   [ ] الـ error state شغال (disconnect internet وجرب)
   [ ] الـ forms بتعمل validate
   [ ] الـ actions بتشتغل (create, edit, delete)
   [ ] الصفحة responsive على mobile
   [ ] مفيش console errors
   ```

2. **Cross-browser Testing:**
   - Chrome, Firefox, Safari, Edge

3. **Performance Audit:**
   - Lighthouse score > 80
   - First Contentful Paint < 2s
   - No memory leaks

---

## ملخص المراحل

| # | المرحلة | عدد الملفات | الوقت المقدر |
|---|---------|------------|-------------|
| 1 | البنية الأساسية (hooks, components, api) | 5-8 ملفات | ساعة |
| 2 | الصفحات الأساسية (Dashboard, Chat, Agents) | 6 ملفات | ساعة |
| 3 | صفحات العمليات (Runs, Queue, Terminal) | 8 ملفات | ساعة |
| 4 | Git Page بالكامل | 1-2 ملف | 30 دقيقة |
| 5 | Files + Editor + Projects | 3 ملفات | 30 دقيقة |
| 6 | الـ 15 صفحة الجديدة | 15 ملف | ساعتين |
| 7 | UI/UX improvements | كل الملفات | ساعة |
| 8 | Testing + Polish | — | 30 دقيقة |

**المجموع: ~7 ساعات عمل = session واحدة مركزة**

---

## القواعد

1. **مفيش مسح وإعادة بناء** — بنصلح ونحسن الموجود
2. **كل صفحة لازم تشتغل** — مفيش placeholder أو "coming soon"
3. **كل API call لازم يكون فيه:** loading + error + empty + success states
4. **كل form لازم يكون فيه:** validation + feedback
5. **الـ Git page محتاجة تتبني صح** — ربط حقيقي مع GitHub
6. **مفيش `catch { /* ignore */ }`** — كل error يتعرض للـ user
7. **مفيش hardcoded URLs** — كله يمر من `API_BASE`
