import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import multer from 'multer';
import { all, get, run, tx, AUDIO_DIR } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { loadLessonFor } from '../access.js';
import { httpError, toInt, parseJSON } from '../utils.js';
import { aiEnabledFor } from '../ai.js';
import { checkpointsFor, checkpointRevision, gradeCheckpoint, requiredComplete, validateCheckpoints } from '../checkpoints.js';

const r = Router();
r.use(requireAuth);

const upload = multer({
  storage: multer.diskStorage({
    destination: AUDIO_DIR,
    filename: (req, file, cb) => cb(null, `${req.params.id}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.webm`),
  }),
  limits: { fileSize: 300 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, file.mimetype.startsWith('audio/') || file.mimetype === 'video/webm'),
});

function removeAudio(file) {
  if (!file) return;
  fs.rm(path.join(AUDIO_DIR, path.basename(file)), { force: true }, () => {});
}

function neighbours(lesson, user) {
  const onlyPublished = user.role === 'teacher' ? '' : 'AND published = 1';
  const ids = all(`SELECT id FROM lessons WHERE course_id = ? ${onlyPublished} ORDER BY position, id`, lesson.course_id).map((x) => x.id);
  const i = ids.indexOf(lesson.id);
  return { prev_id: ids[i - 1] ?? null, next_id: ids[i + 1] ?? null };
}

r.get('/:id', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.id));
  const quiz = parseJSON(lesson.quiz);
  const isTeacher = req.user.role === 'teacher';
  const out = {
    ...lesson,
    recording: parseJSON(lesson.recording),
    audio_url: lesson.audio_file ? `/uploads/audio/${lesson.audio_file}` : null,
    // Answers stay on the server for students — grading happens in POST /:id/quiz.
    quiz: quiz && (isTeacher ? quiz : quiz.map(({ q, options }) => ({ q, options }))),
    checkpoints: checkpointsFor(lesson, req.user.id, isTeacher),
    ai_enabled: aiEnabledFor(lesson),
    ...neighbours(lesson, req.user),
  };
  if (!isTeacher) {
    delete out.notes;
    out.progress = get('SELECT position_ms, completed, quiz_score FROM progress WHERE user_id = ? AND lesson_id = ?', req.user.id, lesson.id) || null;
  }
  res.json(out);
});

r.put('/:id', requireTeacher, (req, res) => {
  const id = toInt(req.params.id);
  const lesson = get('SELECT * FROM lessons WHERE id = ?', id);
  if (!lesson) throw httpError(404, 'الدرس غير موجود');
  const b = req.body;
  const sets = [];
  const vals = [];
  const set = (col, val) => (sets.push(`${col} = ?`), vals.push(val));
  const duration = 'recording' in b ? Math.round(b.recording?.duration || 0) : lesson.duration_ms;
  if ('checkpoints' in b || 'recording' in b || 'language' in b) {
    const checkpoints = validateCheckpoints(b.checkpoints ?? parseJSON(lesson.checkpoints, []), duration, b.language || lesson.language);
    set('checkpoints', checkpoints.length ? JSON.stringify(checkpoints) : null);
  }

  if ('title' in b) {
    if (!String(b.title).trim()) throw httpError(400, 'عنوان الدرس مطلوب');
    set('title', String(b.title).trim());
  }
  for (const col of ['description', 'notes', 'summary', 'language']) if (col in b) set(col, b[col] ?? null);
  if ('published' in b) set('published', b.published ? 1 : 0);
  if ('ai_mode' in b) set('ai_mode', ['on', 'off'].includes(b.ai_mode) ? b.ai_mode : null);
  if ('quiz' in b) set('quiz', Array.isArray(b.quiz) && b.quiz.length ? JSON.stringify(b.quiz) : null);
  if ('recording' in b) {
    set('recording', b.recording ? JSON.stringify(b.recording) : null);
    set('duration_ms', Math.round(b.recording?.duration || 0));
    // A new recording invalidates the old voice track; the client uploads the new one right after.
    set('audio_file', null);
    removeAudio(lesson.audio_file);
  }
  if (sets.length) {
    set('updated_at', new Date().toISOString().replace('T', ' ').slice(0, 19));
    tx(() => {
      run(`UPDATE lessons SET ${sets.join(', ')} WHERE id = ?`, ...vals, id);
      if (sets.includes('checkpoints = ?')) {
        const updated = get('SELECT * FROM lessons WHERE id = ?', id);
        for (const progress of all('SELECT user_id FROM progress WHERE lesson_id = ? AND completed = 1', id)) {
          if (!requiredComplete(checkpointsFor(updated, progress.user_id))) run('UPDATE progress SET completed = 0 WHERE user_id = ? AND lesson_id = ?', progress.user_id, id);
        }
      }
    });
  }
  res.json({ ok: true });
});

r.delete('/:id', requireTeacher, (req, res) => {
  const lesson = get('SELECT audio_file FROM lessons WHERE id = ?', toInt(req.params.id));
  run('DELETE FROM lessons WHERE id = ?', toInt(req.params.id));
  removeAudio(lesson?.audio_file);
  res.json({ ok: true });
});

r.post('/:id/audio', requireTeacher, upload.single('audio'), (req, res) => {
  const id = toInt(req.params.id);
  if (!req.file) throw httpError(400, 'لم يصل ملف صوت صالح');
  const lesson = get('SELECT audio_file FROM lessons WHERE id = ?', id);
  if (!lesson) {
    removeAudio(req.file.filename);
    throw httpError(404, 'الدرس غير موجود');
  }
  run('UPDATE lessons SET audio_file = ? WHERE id = ?', req.file.filename, id);
  removeAudio(lesson.audio_file);
  res.json({ audio_url: `/uploads/audio/${req.file.filename}` });
});

r.post('/:id/progress', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.id));
  const complete = requiredComplete(checkpointsFor(lesson, req.user.id));
  run(
    `INSERT INTO progress (user_id, lesson_id, position_ms, completed, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET
       position_ms = excluded.position_ms,
       completed = MAX(progress.completed, excluded.completed),
       updated_at = excluded.updated_at`,
    req.user.id,
    lesson.id,
    Math.min(lesson.duration_ms, Math.max(0, Math.round(Number(req.body.position_ms) || 0))),
    req.body.completed && complete ? 1 : 0,
  );
  res.json({ ok: true });
});

r.post('/:id/checkpoints/:checkpointId/attempt', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.id));
  const checkpoint = parseJSON(lesson.checkpoints, []).find((entry) => entry.id === req.params.checkpointId);
  if (!checkpoint) throw httpError(404, 'التحدي غير موجود');
  const revision = checkpointRevision(checkpoint);
  if (req.body.revision !== revision) throw httpError(409, 'المدرّس حدّث التحدي؛ حدّث الصفحة لعرض النسخة الجديدة');
  const passed = gradeCheckpoint(checkpoint, req.body);
  if (req.user.role === 'teacher') return res.json({ passed, attempts: 0, preview: true });
  const progress = tx(() => {
    run(
      `INSERT INTO checkpoint_attempts (user_id, lesson_id, checkpoint_id, revision, attempts, passed, code, output)
       VALUES (?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT(user_id, lesson_id, checkpoint_id, revision) DO UPDATE SET
         attempts = checkpoint_attempts.attempts + 1, passed = MAX(checkpoint_attempts.passed, excluded.passed),
         code = excluded.code, output = excluded.output, updated_at = datetime('now')`,
      req.user.id, lesson.id, checkpoint.id, revision, passed, checkpoint.type === 'code' ? req.body.code : null, checkpoint.type === 'code' ? req.body.output : null,
    );
    if (requiredComplete(checkpointsFor(lesson, req.user.id))) {
      run('UPDATE progress SET completed = 1 WHERE user_id = ? AND lesson_id = ? AND position_ms >= ? AND position_ms > 0', req.user.id, lesson.id, Math.max(0, lesson.duration_ms - 1000));
    }
    return get('SELECT passed, attempts FROM checkpoint_attempts WHERE user_id = ? AND lesson_id = ? AND checkpoint_id = ? AND revision = ?', req.user.id, lesson.id, checkpoint.id, revision);
  });
  res.json({ passed, mastered: !!progress.passed, attempts: progress.attempts });
});

r.post('/:id/quiz', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.id));
  const quiz = parseJSON(lesson.quiz, []);
  if (!quiz.length) throw httpError(400, 'لا يوجد اختبار لهذا الدرس');
  const answers = Array.isArray(req.body.answers) ? req.body.answers : [];
  const results = quiz.map((item, i) => ({ correct: answers[i] === item.answer, answer: item.answer, explain: item.explain || '' }));
  const score = Math.round((results.filter((x) => x.correct).length / quiz.length) * 100);
  run(
    `INSERT INTO progress (user_id, lesson_id, quiz_score) VALUES (?, ?, ?)
     ON CONFLICT(user_id, lesson_id) DO UPDATE SET quiz_score = MAX(COALESCE(progress.quiz_score, 0), excluded.quiz_score), updated_at = datetime('now')`,
    req.user.id,
    lesson.id,
    score,
  );
  res.json({ score, results });
});

const EVENT_TYPES = new Set(['pause', 'rewind', 'error']);

r.post('/:id/events', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.id));
  if (req.user.role === 'teacher') return res.json({ ok: true }); // teacher previews don't count
  const events = (Array.isArray(req.body.events) ? req.body.events : [])
    .filter((e) => EVENT_TYPES.has(e?.type) && Number.isFinite(e.t))
    .slice(0, 200);
  tx(() => {
    for (const e of events) {
      run('INSERT INTO events (lesson_id, user_id, type, t_ms) VALUES (?, ?, ?, ?)', lesson.id, req.user.id, e.type, Math.max(0, Math.round(e.t)));
    }
  });
  res.json({ ok: true });
});

// How each challenge performs: who tried it, who passed, and how many tries it took.
r.get('/:id/checkpoint-stats', requireTeacher, (req, res) => {
  const lesson = get('SELECT id, checkpoints FROM lessons WHERE id = ?', toInt(req.params.id));
  if (!lesson) throw httpError(404, 'الدرس غير موجود');
  const attempts = all('SELECT checkpoint_id, revision, attempts, passed FROM checkpoint_attempts WHERE lesson_id = ?', lesson.id);
  res.json(
    parseJSON(lesson.checkpoints, []).map((checkpoint) => {
      const revision = checkpointRevision(checkpoint);
      const rows = attempts.filter((a) => a.checkpoint_id === checkpoint.id && a.revision === revision);
      const passed = rows.filter((a) => a.passed);
      return {
        id: checkpoint.id,
        learners: rows.length,
        passed: passed.length,
        stuck: rows.length - passed.length,
        avg_attempts: rows.length ? Math.round((rows.reduce((sum, a) => sum + a.attempts, 0) / rows.length) * 10) / 10 : 0,
      };
    }),
  );
});

const WEIGHTS = { pause: 1, rewind: 2, error: 3, question: 4 };

// The "Stuck Map": where on the lesson timeline students pause, rewind, hit errors or ask.
r.get('/:id/stuckmap', requireTeacher, (req, res) => {
  const id = toInt(req.params.id);
  const lesson = get('SELECT duration_ms FROM lessons WHERE id = ?', id);
  if (!lesson) throw httpError(404, 'الدرس غير موجود');
  const duration = Math.max(1, lesson.duration_ms);
  const N = 60;
  const size = duration / N;
  const bins = Array.from({ length: N }, (_, i) => ({ start: Math.round(i * size), end: Math.round((i + 1) * size), pause: 0, rewind: 0, error: 0, question: 0, score: 0 }));
  const rows = [
    ...all('SELECT type, t_ms FROM events WHERE lesson_id = ?', id),
    ...all("SELECT 'question' AS type, t_ms FROM questions WHERE lesson_id = ?", id),
  ];
  for (const row of rows) {
    const bin = bins[Math.min(N - 1, Math.floor(row.t_ms / size))];
    bin[row.type] += 1;
    bin.score += WEIGHTS[row.type] || 0;
  }
  const hot = [...bins].filter((b) => b.score > 0).sort((a, b) => b.score - a.score).slice(0, 5);
  const stats = get(
    'SELECT COUNT(*) AS viewers, COALESCE(SUM(completed), 0) AS completed, ROUND(AVG(quiz_score)) AS avg_quiz FROM progress WHERE lesson_id = ?',
    id,
  );
  res.json({ duration, bins, hot, totalEvents: rows.length, ...stats });
});

export default r;
