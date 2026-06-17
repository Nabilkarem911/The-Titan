# 🗺️ Titan AI — خطة التطوير (Development Roadmap)

> **القاعدة الذهبية:** 🛡️ **مفيش حاجة تتكسر** — أي تعديل لازم يبقى backward compatible

---

## ✅ Completed (اتعمل)

- [x] **Language Detection** — رد حسب لغة المستخدم (عربي/إنجليزي)
- [x] **Tool Calling (SSH)** — Titan يدخل سيرفرات ويشغل أوامر SSH
- [x] **Telegram Integration** — بوت شغال مع MarkdownV2
- [x] **Agent Engine** — نظام multi-step مع tools
- [x] **Developer Tools** — execute_bash, write_file, read_file, patch_file, docker_manage
- [x] **Docker + SSH** — openssh-client و sshpass في الحاوية
- [x] **LLM Retry Logic** — exponential backoff للأخطاء المؤقتة
- [x] **Critical Final Instruction** — override للـ memory القديمة
- [x] **SSH Keyword Detection** — forcing tool usage لما الـ user يطلب سيرفر
- [x] **Multi-tasking (partial)** — Agent runs في background
- [x] **Smart Memory** — user preferences auto-injected into every agent run

---

## 🔥 Priority 1: الأساسيات (الأسبوع ده)

### 1.1 🧠 Smart Memory ✅ DONE (17 يونيو 2026)
**الهدف:** Titan يفتكر إنك المطور، يفتكر إنك بتحب الرد القصير، يفتكر المشاريع اللي شغال فيها — من غير ما تقوله في كل مرة.

**اللي اتعمل:**
- ✅ `user_context` table موجود (key-value store per user)
- ✅ `remember` tool: يخزن preferences زي `tone:short`, `relationship:developer`
- ✅ `recall` tool: يجيب الـ preferences
- ✅ Telegram route: يجيب `userContext.getAll(ownerId)` ويحقنها في `AgentRunner.userContextItems`
- ✅ `buildSystemPrompt` في `runner.ts`: يحول `userContextItems` لـ `memoryItems` تلقائياً

**الاستخدام:**
```
User: "تذكر إني المطور"
Titan: (يستخدم remember tool → key: "relationship", value: "developer")

User (بعد كدا): "عدل الكود"
Titan: (يعرف من userContextItems إنه المطور → يرد accordingly)
```

---

### 1.2 📁 Project Context ✅ DONE (17 يونيو 2026)
**الهدف:** لما تقول "شوف المشروع الفلاني" Titan يعرف إنت بتتكلم على إيه (مسارات، repo، branch).

**اللي اتعمل:**
- ✅ Migration 0019: جدول `user_projects` (name, path, repo_url, branch, is_default)
- ✅ `userProjects.ts`: CRUD operations (set, get, getDefault, list, delete)
- ✅ `set_project` tool: يخزن مشروع مع isDefault
- ✅ `get_project` tool: يجيب default أو specific project
- ✅ Telegram route: يحقن `active_project` في `userContextItems` تلقائياً
- ✅ Migration 0020: added tools to `allowed_tools`

**الاستخدام:**
```
User: "المشروع بتاعي The-Titan في /app/Titan"
Titan: (يستخدم set_project tool → isDefault=true)

User (بعد كدا): "شوف الكود"
Titan: (يعرف active_project = The-Titan → يدور في /app/Titan)
```

---

## ⚡ Priority 2: سريع ومؤثر (الأسبوع الجاي)

### 2.1 📎 File Upload ✅ DONE (17 يونيو 2026)
**الهدف:** تبعتله ملف (صورة، PDF، كود، لوج) يقراه ويفهم.

**اللي اتعمل:**
- ✅ TelegramUpdate interface: added `document`, `photo`, `caption` fields
- ✅ `downloadTelegramFile()`: gets download URL from Telegram API (`getFile` → download link)
- ✅ Webhook handler: detects file uploads, downloads file info
- ✅ Context block: injects file info (filename, type, url) into system prompt
- ✅ Titan knows when user sends a file/image and can reference it

**الاستخدام:**
```
User: [sends screenshot.png] "شوف المشكلة دي"
Titan: (يعرف إن فيه file uploaded → filename: screenshot.png, type: image)
```

**مخاطر:** ⚠️ متوسطة — file handling ممكن يعمل load
**Backward Compatible:** ✅ نعم — text messages هتفضل شغالة

---

### 2.2 📊 Dashboard Live
**الهدف:** شاشة في الـ Dashboard توريك الـ Agent Runs اللي شغالة live.

**الخطوات:**
1. WebSocket أو Server-Sent Events (SSE) للـ real-time updates
2. صفحة `/runs/live` في Dashboard
3. Table: run_id, status, steps, current_tool, elapsed_time
4. Auto-refresh كل 5 ثواني

**مخاطر:** ⚠️ متوسطة — WebSocket connections
**Backward Compatible:** ✅ نعم — existing routes هتفضل شغالة

---

## 🔧 Priority 3: متقدم (بعد Priority 1+2)

### 3.1 🔔 Background Tasks
**الهدف:** "راقب لي السيرفر كل ساعة" ويرن في background ويبعتلك لو فيه مشكلة.

**الخطوات:**
1. Migration: جدول `scheduled_tasks` (cron expression, prompt, owner_id, last_run, next_run)
2. Cron job (node-cron) يشوف المهام اللي لازم تتنفذ
3. لما المهمة تخلص: إذا كانت النتيجة فيها alert → notify عبر Telegram
4. Dashboard: صفحة "Scheduled Tasks"

**مخاطر:** ⚠️ عالية — cron jobs ممكن تعمل load كبير
**Backward Compatible:** ✅ نعم — optional feature

---

### 3.2 💬 WhatsApp Integration
**الهدف:** مش كل العملاء بيستخدموا Telegram.

**الخطوات:**
1. WhatsApp Business API أو WhatsApp Web.js
2. نفس الـ Telegram handler بس مع adapter للـ WhatsApp format
3. Shared logic: نفس الـ Agent Runner، مختلف الـ message format بس

**مخاطر:** ⚠️ متوسطة — WhatsApp rate limits أصعب من Telegram
**Backward Compatible:** ✅ نعم — Telegram هيفضل شغال

---

### 3.3 🌍 i18n Dashboard
**الهدف:** الـ Dashboard تبقى عربي/إنجليزي حسب اللغة.

**الخطوات:**
1. i18n library (react-i18next)
2. Translation files: `ar.json`, `en.json`
3. Language switcher في الـ UI
4. Default: حسب `Accept-Language` header

**مخاطر:** ⚠️ قليلة — UI changes بس
**Backward Compatible:** ✅ نعم

---

## 🚀 Priority 4: مستقبلي (لما النظام يستقر)

### 4.1 🤖 Multiple Agents
**الهدف:** أكتر من Agent كل واحد لمهمة (واحد للـ SSH، واحد للـ Code، إلخ).

**الخطوات:**
1. Migration: `agents` table (name, type, system_prompt, allowed_tools)
2. Swarm routing: يوزع المهام على الـ Agents حسب النوع
3. Dashboard: manage Agents (create, edit, disable)

**مخاطر:** ⚠️ عالية — architecture change كبير
**Backward Compatible:** ⚠️ محتاج migration plan

---

### 4.2 🔄 Auto-Fix
**الهدف:** لما يشوف error في لوج، يحاول يصلحه لوحده.

**الخطوات:**
1. Error detection: pattern matching للـ common errors
2. Auto-fix loop: يشوف الـ error → يعدل الكود → يجرب تاني
3. Max retries: 3 محاولات بس
4. Notify: لو فشل في الـ fix → يبعت للمطور

**مخاطر:** ⚠️ عالية جداً — ممكن يكسر حاجة غلط
**Backward Compatible:** ⚠️ لازم يبقى optional + approval

---

### 4.3 📱 Mobile App
**الهدف:** React Native app للـ Titan.

**الخطوات:**
1. React Native project
2. Shared API مع الـ Core
3. Push notifications

**مخاطر:** ⚠️ عالية — project جديد
**Backward Compatible:** ✅ نعم — separate codebase

---

## 📋 Checklist للتنفيذ

### قبل ما نبدأ أي Priority:
- [ ] نتأكد إن الـ Tests شغالة
- [ ] نعمل branch جديد (`feature/smart-memory`)
- [ ] نراجع الـ migration plan
- [ ] نتأكد: **Backward Compatible = true**

### بعد ما نخلص أي Priority:
- [ ] Test manual على Telegram
- [ ] Check logs: مفيش errors جديدة
- [ ] Commit + Push
- [ ] Merge لـ main
- [ ] Deploy على Dokploy
- [ ] Test production

---

## 🛡️ قواعد مفيش حاجة تتكسر

1. **مش هنمسح حاجة** — نضيف بس
2. **مش هنغير API** — نضيف endpoints جديدة
3. **Migration لازم تبقى reversible** — `DOWN` migration موجودة
4. **Feature flags** — أي feature جديدة: `ENABLE_FEATURE_X=true/false`
5. **Rollback plan** — لو حاجة اتكسر: git revert + redeploy
6. **Log everything** — لما حاجة تبوظ، نقدر نشوف إيه اللي حصل

---

*آخر تحديث: 17 يونيو 2026*
*التالي: Priority 1.1 — Smart Memory*
