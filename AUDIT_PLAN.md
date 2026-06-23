# خطة المراجعة الصارمة — Full Audit Plan

## 1. مسارات غير مسجلة في السيرفر (Unregistered Routes)

الملفات دي موجودة في `apps/core/src/routes/` بس مش مسجلة في `server.ts`:

| الملف | الحالة | الأكشن |
|------|--------|--------|
| `analytics.ts` | 6 مسارات كلها stubs ترجع داتا وهمية | تسجيل + ربط بالداتابيس |
| `export-import.ts` | 5 مسارات كلها stubs | تسجيل + ربط بالداتابيس |
| `integrations.ts` (القديم) | 6 مسارات stubs — مستبدل بـ `integrations-v2.ts` | حذف الملف |
| `learning.ts` (القديم) | 5 مسارات stubs — مستبدل بـ `learning-v2.ts` | حذف الملف |
| `marketplace.ts` | 6 مسارات كلها stubs | تسجيل + ربط بالداتابيس |
| `search.ts` | 5 مسارات كلها stubs | تسجيل + ربط بالداتابيس |
| `user-preferences.ts` | 5 مسارات كلها stubs | تسجيل + ربط بالداتابيس |

## 2. مسار `/api/command` — مش موجود خالص

تيتان بيتكلم عن مسار `/api/command` اللي مش موجود. ده مسار لازم يتبدا عشان تيتان يقدر ينفذ أوامر من الشات مباشرة. الأكشن: إنشاء المسار + ربطه بالـ tool registry و dream mode.

## 3. مسارات Stub داخل ملفات مسجلة فعلاً

| الملف | المسار | المشكلة |
|------|--------|---------|
| `reasoning.ts` | `/api/v1/dream/trigger` | بياخد experiences من الـ body بدل ما يجيبها من الداتابيس |
| `multimodal.ts` | كله | شغال بس محتاج تسجيل في الداتابيس للنتائج |

## 4. جداول ناقصة في الداتابيس

| الجدول | الملف اللي محتاجه | الأكشن |
|--------|-------------------|--------|
| `user_preferences` | `user-preferences.ts` | إنشاء migration |
| `user_notifications` | `user-preferences.ts` | إنشاء migration |
| `marketplace_listings` | `marketplace.ts` | إنشاء migration |
| `marketplace_reviews` | `marketplace.ts` | إنشاء migration |
| `token_usage` | `analytics.ts` | إنشاء migration |
| `tool_execution_stats` | `analytics.ts` | إنشاء migration |
| `search_index` | `search.ts` | إنشاء migration |
| `export_jobs` | `export-import.ts` | إنشاء migration |
| `run_feedback` | `learning.ts` | التأكد من وجوده |

## 5. ترتيب التنفيذ

1. إنشاء migration 0032 لكل الجداول الناقصة
2. إنشاء repositories لكل جدول جديد
3. ربط `analytics.ts` بالداتابيس + تسجيله في server.ts
4. ربط `search.ts` بالداتابيس + تسجيله في server.ts
5. ربط `marketplace.ts` بالداتابيس + تسجيله في server.ts
6. ربط `user-preferences.ts` بالداتابيس + تسجيله في server.ts
7. ربط `export-import.ts` بالداتابيس + تسجيله في server.ts
8. إنشاء مسار `/api/command` + تسجيله في server.ts
9. حذف `integrations.ts` و `learning.ts` (النسخ القديمة)
10. ربط `/api/v1/dream/trigger` بجلب experiences من الداتابيس
11. Build + verify + commit + push
