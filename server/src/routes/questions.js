import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { loadLessonFor } from '../access.js';
import { httpError, toInt } from '../utils.js';

const r = Router();
r.use(requireAuth);

const BASE = `SELECT q.*, u.name AS student_name, l.title AS lesson_title, l.language, c.title AS course_title
  FROM questions q JOIN users u ON u.id = q.user_id JOIN lessons l ON l.id = q.lesson_id JOIN courses c ON c.id = l.course_id`;

r.get('/', (req, res) => {
  if (req.user.role !== 'teacher') {
    return res.json(all(`${BASE} WHERE q.user_id = ? ORDER BY q.created_at DESC`, req.user.id));
  }
  const status = req.query.status;
  const where = status === 'pending' ? 'WHERE q.answer IS NULL' : status === 'answered' ? 'WHERE q.answer IS NOT NULL' : '';
  res.json(all(`${BASE} ${where} ORDER BY (q.answer IS NOT NULL), q.created_at DESC`));
});

// Lessons a student can ask about from the "My questions" page (published lessons of joined courses).
r.get('/lessons', (req, res) => {
  res.json(
    all(
      `SELECT l.id, l.title, c.title AS course_title FROM lessons l
       JOIN courses c ON c.id = l.course_id
       JOIN enrollments e ON e.course_id = c.id AND e.user_id = ?
       WHERE l.published = 1 AND c.published = 1 ORDER BY c.title, l.position, l.id`,
      req.user.id,
    ),
  );
});

// For the player: everyone sees answered questions (a living FAQ), plus their own pending ones.
r.get('/lesson/:lessonId', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.lessonId));
  const rows =
    req.user.role === 'teacher'
      ? all(`${BASE} WHERE q.lesson_id = ? ORDER BY q.t_ms`, lesson.id)
      : all(`${BASE} WHERE q.lesson_id = ? AND (q.answer IS NOT NULL OR q.user_id = ?) ORDER BY q.t_ms`, lesson.id, req.user.id);
  res.json(rows.map((q) => ({ ...q, mine: q.user_id === req.user.id })));
});

r.post('/lesson/:lessonId', (req, res) => {
  const lesson = loadLessonFor(req.user, toInt(req.params.lessonId));
  const body = String(req.body.body || '').trim();
  if (!body) throw httpError(400, 'اكتب سؤالك');
  const { lastInsertRowid } = run(
    'INSERT INTO questions (lesson_id, user_id, t_ms, line, code, body) VALUES (?, ?, ?, ?, ?, ?)',
    lesson.id,
    req.user.id,
    Math.max(0, Math.round(Number(req.body.t_ms) || 0)),
    toInt(req.body.line),
    String(req.body.code || '').slice(0, 50000),
    body.slice(0, 4000),
  );
  res.json({ ...get(`${BASE} WHERE q.id = ?`, lastInsertRowid), mine: true });
});

r.put('/:id/answer', requireTeacher, (req, res) => {
  const answer = String(req.body.answer || '').trim();
  run("UPDATE questions SET answer = ?, answered_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END WHERE id = ?", answer || null, answer || null, toInt(req.params.id));
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  const q = get('SELECT * FROM questions WHERE id = ?', toInt(req.params.id));
  if (!q) throw httpError(404, 'السؤال غير موجود');
  if (req.user.role !== 'teacher' && (q.user_id !== req.user.id || q.answer)) throw httpError(403, 'لا يمكنك حذف هذا السؤال');
  run('DELETE FROM questions WHERE id = ?', q.id);
  res.json({ ok: true });
});

export default r;
