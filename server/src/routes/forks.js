import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth } from '../auth.js';
import { httpError, toInt } from '../utils.js';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  res.json(
    all(
      `SELECT f.id, f.title, f.language, f.lesson_id, f.t_ms, f.updated_at, l.title AS lesson_title
       FROM forks f LEFT JOIN lessons l ON l.id = f.lesson_id WHERE f.user_id = ? ORDER BY f.updated_at DESC`,
      req.user.id,
    ),
  );
});

function loadOwn(req) {
  const fork = get('SELECT * FROM forks WHERE id = ? AND user_id = ?', toInt(req.params.id), req.user.id);
  if (!fork) throw httpError(404, 'الملف غير موجود');
  return fork;
}

r.get('/:id', (req, res) => res.json(loadOwn(req)));

r.post('/', (req, res) => {
  const title = String(req.body.title || '').trim() || 'تجربة جديدة';
  const { lastInsertRowid } = run(
    'INSERT INTO forks (user_id, lesson_id, t_ms, title, language, code) VALUES (?, ?, ?, ?, ?, ?)',
    req.user.id,
    toInt(req.body.lessonId),
    toInt(req.body.t_ms),
    title.slice(0, 200),
    req.body.language || 'javascript',
    String(req.body.code || ''),
  );
  res.json({ id: Number(lastInsertRowid) });
});

r.put('/:id', (req, res) => {
  const fork = loadOwn(req);
  run(
    "UPDATE forks SET title = ?, language = ?, code = ?, updated_at = datetime('now') WHERE id = ?",
    String(req.body.title ?? fork.title).trim() || fork.title,
    req.body.language || fork.language,
    String(req.body.code ?? fork.code),
    fork.id,
  );
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  run('DELETE FROM forks WHERE id = ?', loadOwn(req).id);
  res.json({ ok: true });
});

export default r;
