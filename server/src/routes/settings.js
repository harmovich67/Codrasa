import { Router } from 'express';
import { getSetting, setSetting } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { DEFAULT_MODELS } from '../ai.js';

const r = Router();

const DEFAULTS = {
  platform_name: 'Codrasa',
  allow_registration: '1',
  currency: 'ج.م',
  smart_model: DEFAULT_MODELS.smart,
  fast_model: DEFAULT_MODELS.fast,
  ai_daily_limit: '30',
  student_smart: '0',
  student_ai: '1',
};

const read = () => Object.fromEntries(Object.entries(DEFAULTS).map(([k, v]) => [k, getSetting(k) ?? v]));

r.get('/public', (req, res) => {
  const s = read();
  res.json({
    platform_name: s.platform_name,
    allow_registration: s.allow_registration === '1',
    currency: s.currency,
    student_smart: s.student_smart === '1',
    student_ai: s.student_ai === '1',
  });
});

r.get('/', requireAuth, requireTeacher, (req, res) => {
  res.json({
    ...read(),
    gemini_key_set: !!getSetting('gemini_api_key'),
    gemini_key_from_env: !!process.env.GEMINI_API_KEY,
  });
});

r.put('/', requireAuth, requireTeacher, (req, res) => {
  for (const key of Object.keys(DEFAULTS)) {
    if (key in req.body) setSetting(key, String(req.body[key] ?? '').trim() || DEFAULTS[key]);
  }
  if (typeof req.body.gemini_api_key === 'string' && req.body.gemini_api_key.trim()) {
    setSetting('gemini_api_key', req.body.gemini_api_key.trim());
  }
  if (req.body.clear_gemini_key) setSetting('gemini_api_key', null);
  res.json({ ok: true });
});

export default r;
