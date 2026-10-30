import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { httpError, toInt } from '../utils.js';

const r = Router();
r.use(requireAuth);

export const defaultSubjectId = () => get("SELECT id FROM subjects ORDER BY (kind = 'code') DESC, id LIMIT 1")?.id ?? null;

const COLOR = /^#[0-9a-f]{6}$/i;

r.get('/', (req, res) => {
  res.json(all('SELECT s.*, (SELECT COUNT(*) FROM courses c WHERE c.subject_id = s.id) AS course_count FROM subjects s ORDER BY s.id'));
});

r.post('/', requireTeacher, (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name || name.length > 60) throw httpError(400, 'اسم المادة مطلوب (حتى 60 حرف)');
  if (!['code', 'board'].includes(req.body.kind)) throw httpError(400, 'اختار نوع المادة: برمجة (محرر كود) أو سبورة');
  if (get('SELECT id FROM subjects WHERE name = ?', name)) throw httpError(409, 'فيه مادة بنفس الاسم');
  const { lastInsertRowid } = run('INSERT INTO subjects (name, kind, color) VALUES (?, ?, ?)', name, req.body.kind, COLOR.test(req.body.color || '') ? req.body.color : '#6c4cf6');
  res.json(get('SELECT * FROM subjects WHERE id = ?', lastInsertRowid));
});

// The kind is fixed once created: a course's lessons are recorded for one kind (editor events vs board strokes).
r.put('/:id', requireTeacher, (req, res) => {
  const id = toInt(req.params.id);
  const subject = get('SELECT * FROM subjects WHERE id = ?', id);
  if (!subject) throw httpError(404, 'المادة غير موجودة');
  const name = String(req.body.name ?? subject.name).trim();
  if (!name || name.length > 60) throw httpError(400, 'اسم المادة مطلوب (حتى 60 حرف)');
  if (get('SELECT id FROM subjects WHERE name = ? AND id != ?', name, id)) throw httpError(409, 'فيه مادة بنفس الاسم');
  run('UPDATE subjects SET name = ?, color = ? WHERE id = ?', name, COLOR.test(req.body.color || '') ? req.body.color : subject.color, id);
  res.json(get('SELECT * FROM subjects WHERE id = ?', id));
});

r.delete('/:id', requireTeacher, (req, res) => {
  const id = toInt(req.params.id);
  if (!get('SELECT id FROM subjects WHERE id = ?', id)) throw httpError(404, 'المادة غير موجودة');
  if (get('SELECT 1 AS x FROM courses WHERE subject_id = ? LIMIT 1', id)) throw httpError(409, 'فيه كورسات تابعة للمادة دي — انقلها لمادة تانية أو احذفها الأول');
  run('DELETE FROM subjects WHERE id = ?', id);
  res.json({ ok: true });
});

export default r;
