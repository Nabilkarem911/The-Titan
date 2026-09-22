/**
 * التعلّم التلقائي — تيتان يستخرج المعلومات الدائمة عن المستخدم ويخزّنها في الذاكرة.
 *
 * الفكرة: بدل ما ندوّر على حقوقائق بـschema ثابت (مش عارفين المفاتيح مقدّمًا)،
 * بنسأل سؤال قرار واحد: «دي معلومة شخصية دائمة عن المستخدم؟»
 * لو أيوة → نخزّن الجملة في الذاكرة الدلالية (بالتمثيل الموجود بتاعنا).
 *
 * التصميم (ليه كده):
 *  - الشغل بيتم بعد إرسال الرد (fire-and-forget) → **مش بيبطّئ الرد** ✓
 *  - كل حاجة في try/catch → **الفشل مايكسرش المحادثة** ✓ (أهم قاعدة)
 *  - سقف على طول النص وحجم الشغل → مايستهلكش بلا داعي ✓
 *  - المفتاح من env فقط، ومفيش أي طباعة أسرار ✓
 *
 * مقاس 2026-09: milliseconds.ai بالعربي — yes-no 0.6 ثانية، استخراج 5/5 حقول صح،
 * بيفهم اللهجات (مصري/سعودي/إنجليزي).
 */

import { getLogger } from '@titan/logging';

const log = getLogger().child({ component: 'learn-facts' });

const MS_BASE = 'https://api.milliseconds.ai/v1/decision-machine-1';
const MAX_TEXT_CHARS = 1_200;
const COLLECTION = process.env.MEMORY_FACTS_COLLECTION ?? 'user_facts';

/** أقل طول للنص اللي يستاهل ندوّر فيه عن معلومة */
const MIN_TEXT_CHARS = 12;

function apiKey(): string | undefined {
  return process.env.MILLISECONDS_API_KEY ?? process.env.MILLISECONDS_PLAYGROUND_KEY;
}

async function msDecide(endpoint: string, body: Record<string, unknown>): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new Error('MILLISECONDS_API_KEY is not set');
  const res = await fetch(`${MS_BASE}/${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`milliseconds.ai ${endpoint}: ${res.status} ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 1_000) };
  }
}

/** هل دي معلومة شخصية دائمة تستاهل تتحفظ؟ (قرار سريع ~0.6s) */
export async function isDurableFact(userText: string): Promise<boolean> {
  const r = (await msDecide('yes-no', {
    text: userText,
    statement:
      'النص ده فيه معلومة شخصية دائمة عن المستخدم نفسه (اسمه أو شغله أو أسرته أو مدينته ' +
      'أو رقمه أو تفضيلاته أو مواعيده)، ومش مجرد سؤال عام أو كلام عابر',
  })) as { answer?: boolean; probability?: number };

  const ok = r?.answer === true && (r.probability ?? 0) >= 0.55;
  log.debug({ ok, probability: r?.probability }, 'durable fact decision');
  return ok;
}

export interface LearnDeps {
  /** واجهة الذاكرة — بتستخدم upsert (زي المتوقع من @titan/memory) */
  memory?: { upsert: (collection: string, items: unknown[]) => Promise<void> };
  /** مساحة العمل/معرّف المحادثة — للفصل بين المستخدمين */
  workspaceId?: string;
  /** معرّف الرسالة — يمنع التكرار */
  messageId?: string;
}

/**
 * التعلم من دور واحد: نقرر ندوّر معلومة ولا لأ، ولو أيوة نخزّنها.
 * **ما بترمي أخطاء أبدًا** — كل الفشل بيتسجل وبيترجع صفر.
 * @returns عدد العناصر اللي اتخزنت
 */
export async function learnFromTurn(
  userText: string,
  deps: LearnDeps = {},
): Promise<number> {
  const started = Date.now();
  try {
    if (!userText || userText.trim().length < MIN_TEXT_CHARS) return 0;
    if (!apiKey()) {
      log.debug('learn skipped: no milliseconds key');
      return 0;
    }

    const clean = userText.trim().slice(0, MAX_TEXT_CHARS);
    const durable = await isDurableFact(clean);
    if (!durable) return 0;

    if (!deps.memory?.upsert) {
      log.info({ chars: clean.length, reason: 'also durable but no memory client' }, 'fact detected');
      return 0;
    }

    const id = deps.messageId ?? `fact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    await deps.memory.upsert(COLLECTION, [
      {
        id,
        content: clean,
        workspaceId: deps.workspaceId ?? 'default',
        metadata: {
          kind: 'durable_fact',
          source: 'learn-facts',
          detectedBy: 'milliseconds.ai/yes-no',
          learnedAt: new Date().toISOString(),
        },
      },
    ]);

    log.info({ id, chars: clean.length, ms: Date.now() - started }, 'durable fact stored');
    return 1;
  } catch (err) {
    // مهم جدًا: الفشل هنا مايكسرش المحادثة ولا يعطّلها
    log.warn({ err: String(err).slice(0, 200) }, 'learn-facts failed (ignored)');
    return 0;
  }
}
