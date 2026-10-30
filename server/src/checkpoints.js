import { createHash, randomUUID } from 'node:crypto';
import { all, getSetting } from './db.js';
import { httpError, parseJSON } from './utils.js';

export const normalizeOutput = (value) => String(value ?? '').replaceAll('\r\n', '\n').trim();

export function checkpointRevision(checkpoint) {
  const { type, prompt, skill, options, answer, starter_code, expected_output } = checkpoint;
  return createHash('sha256').update(JSON.stringify({ type, prompt, skill, options, answer, starter_code, expected_output })).digest('hex').slice(0, 24);
}

export function validateCheckpoints(value, duration, language) {
  if (!Array.isArray(value) || value.length > 30) throw httpError(400, 'أضف حتى 30 تحديًا في الدرس');
  const ids = new Set();
  return value.map((item, index) => {
    if (!item || typeof item !== 'object') throw httpError(400, 'بيانات التحدي غير صالحة');
    const title = String(item.title || '').trim();
    const prompt = String(item.prompt || '').trim();
    const skill = String(item.skill || '').normalize('NFKC').trim().replace(/\s+/g, ' ');
    const t_ms = Number(item.t_ms);
    const id = item.id || randomUUID();
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw httpError(400, 'معرّفات التحديات يجب أن تكون فريدة');
    if (!title || title.length > 120 || !prompt || prompt.length > 3000 || !skill || skill.length > 80) {
      throw httpError(400, `راجع عنوان ومطلوب ومهارة التحدي ${index + 1}`);
    }
    if (!duration || !Number.isFinite(t_ms) || t_ms < 0 || t_ms > duration) throw httpError(400, `وقت التحدي ${index + 1} يجب أن يكون داخل التسجيل`);
    if (!['choice', 'code'].includes(item.type)) throw httpError(400, 'نوع التحدي غير مدعوم');
    const checkpoint = { id, title, prompt, skill, type: item.type, t_ms: Math.round(t_ms), required: item.required !== false, hint: String(item.hint || '').trim().slice(0, 1500) };
    if (item.type === 'choice') {
      const options = Array.isArray(item.options) ? item.options.map((option) => String(option).trim()) : [];
      if (options.length < 2 || options.length > 6 || options.some((option) => !option || option.length > 1000) || new Set(options).size !== options.length) {
        throw httpError(400, `التحدي ${index + 1} يحتاج من اختيارين إلى 6 اختيارات مختلفة`);
      }
      if (!Number.isInteger(item.answer) || item.answer < 0 || item.answer >= options.length) throw httpError(400, 'حدد الإجابة الصحيحة لكل تحدٍ');
      Object.assign(checkpoint, { options, answer: item.answer });
    } else {
      if (!['javascript', 'python', 'php'].includes(language)) throw httpError(400, 'تحديات تشغيل الكود متاحة حاليًا لـ JavaScript وPython وPHP؛ استخدم الاختيارات للغات الأخرى');
      if (typeof item.expected_output !== 'string' || !normalizeOutput(item.expected_output) || item.expected_output.length > 20000) throw httpError(400, 'اكتب ناتج التشغيل المتوقع لتحدي الكود');
      if (typeof item.starter_code !== 'string' || item.starter_code.length > 50000) throw httpError(400, 'كود البداية أطول من المسموح');
      Object.assign(checkpoint, { starter_code: item.starter_code, expected_output: normalizeOutput(item.expected_output) });
    }
    ids.add(id);
    return checkpoint;
  }).sort((first, second) => first.t_ms - second.t_ms);
}

export function checkpointsFor(lesson, userId, teacher = false) {
  const attempts = teacher ? [] : all('SELECT * FROM checkpoint_attempts WHERE user_id = ? AND lesson_id = ?', userId, lesson.id);
  return parseJSON(lesson.checkpoints, []).map((checkpoint) => {
    const revision = checkpointRevision(checkpoint);
    const attempt = attempts.find((entry) => entry.checkpoint_id === checkpoint.id && entry.revision === revision);
    const { answer, expected_output, ...visible } = checkpoint;
    return { ...(teacher ? checkpoint : visible), revision, progress: { passed: !!attempt?.passed, attempts: attempt?.attempts || 0, code: attempt?.code ?? null } };
  });
}

// Interactive questions can be switched off for the whole platform or per lesson; the lesson's own switch wins.
export const questionsEnabledFor = (lesson) => (lesson.questions_mode ? lesson.questions_mode === 'on' : getSetting('questions_enabled', '1') === '1');

// What a given viewer actually has to deal with: students get nothing when the feature is off.
export const activeCheckpoints = (lesson, userId, teacher = false) => (teacher || questionsEnabledFor(lesson) ? checkpointsFor(lesson, userId, teacher) : []);

export const requiredComplete = (checkpoints) => checkpoints.every((checkpoint) => !checkpoint.required || checkpoint.progress.passed);

export function gradeCheckpoint(checkpoint, body) {
  if (checkpoint.type === 'choice') {
    if (!Number.isInteger(body.answer) || body.answer < 0 || body.answer >= checkpoint.options.length) throw httpError(400, 'اختر إجابة أولًا');
    return body.answer === checkpoint.answer;
  }
  if (typeof body.code !== 'string' || body.code.length > 50000 || typeof body.output !== 'string' || body.output.length > 20000 || typeof body.error !== 'boolean') {
    throw httpError(400, 'شغّل الكود داخل التحدي ثم أرسل المحاولة');
  }
  return !body.error && normalizeOutput(body.output) === normalizeOutput(checkpoint.expected_output);
}
