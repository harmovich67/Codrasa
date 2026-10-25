import { GoogleGenAI } from '@google/genai';
import { get, run, getSetting } from './db.js';
import { httpError } from './utils.js';

export const DEFAULT_MODELS = { smart: 'gemini-3.6-flash', fast: 'gemini-3.5-flash-lite' };

let cached = { key: null, client: null };

export function getAI() {
  const key = getSetting('gemini_api_key') || process.env.GEMINI_API_KEY;
  if (!key) throw httpError(400, 'مفتاح Gemini غير مضبوط — أضفه من صفحة الإعدادات');
  if (cached.key !== key) cached = { key, client: new GoogleGenAI({ apiKey: key }) };
  return cached.client;
}

// Whether students get the assistant in this lesson: the lesson's own switch wins over the platform setting.
export const aiEnabledFor = (lesson) => (lesson.ai_mode ? lesson.ai_mode === 'on' : getSetting('student_ai', '1') === '1');

export function modelFor(tier, user) {
  // Students only get the smart model when the teacher allows it.
  const allowSmart = user?.role === 'teacher' || getSetting('student_smart', '0') === '1';
  if (tier === 'smart' && allowSmart) return getSetting('smart_model') || DEFAULT_MODELS.smart;
  return getSetting('fast_model') || DEFAULT_MODELS.fast;
}

export function aiError(err) {
  const msg = String(err?.message || err || '').slice(0, 300);
  return httpError(502, `تعذّر الحصول على رد من Gemini: ${msg}`);
}

const today = () => new Date().toISOString().slice(0, 10);

export function checkQuota(user) {
  if (user.role === 'teacher') return;
  const limit = Number(getSetting('ai_daily_limit', '30'));
  const used = get('SELECT count FROM ai_usage WHERE user_id = ? AND day = ?', user.id, today())?.count || 0;
  if (used >= limit) throw httpError(429, `وصلت للحد اليومي للمساعد (${limit} رسالة). جرّب بكرة!`);
}

export function bumpQuota(user) {
  if (user.role === 'teacher') return;
  run(
    `INSERT INTO ai_usage (user_id, day, count) VALUES (?, ?, 1)
     ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1`,
    user.id,
    today(),
  );
}
