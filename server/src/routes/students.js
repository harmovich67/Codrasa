import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth, requireTeacher, createUser, hashPassword } from '../auth.js';
import { httpError, toInt } from '../utils.js';

const r = Router();
r.use(requireAuth, requireTeacher);

r.get('/', (req, res) => {
  res.json(
    all(`SELECT u.id, u.name, u.email, u.phone, u.created_at,
      (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS course_count,
      (SELECT COALESCE(SUM(amount), 0) FROM payments p WHERE p.user_id = u.id) AS total_paid,
      (SELECT MAX(updated_at) FROM progress pr WHERE pr.user_id = u.id) AS last_active,
      (SELECT COUNT(*) FROM progress pr WHERE pr.user_id = u.id AND pr.completed = 1) AS completed_lessons,
      (SELECT COUNT(*) FROM questions q WHERE q.user_id = u.id AND q.answer IS NULL) AS pending_questions
    FROM users u WHERE u.role = 'student' AND u.status = 'active' ORDER BY u.created_at DESC`),
  );
});

// Self-registered students waiting for approval.
r.get('/pending', (req, res) => {
  res.json(all("SELECT id, name, email, phone, created_at FROM users WHERE role = 'student' AND status = 'pending' ORDER BY created_at DESC"));
});

function loadPendingStudent(id) {
  const user = get("SELECT id, name FROM users WHERE id = ? AND role = 'student' AND status = 'pending'", id);
  if (!user) throw httpError(404, 'طلب التسجيل غير موجود أو اتبت فيه');
  return user;
}

r.post('/:id/approve', (req, res) => {
  const user = loadPendingStudent(toInt(req.params.id));
  run("UPDATE users SET status = 'active' WHERE id = ?", user.id);
  res.json({ ok: true });
});

// Rejecting removes the account, so the same email can register again later.
r.post('/:id/reject', (req, res) => {
  const user = loadPendingStudent(toInt(req.params.id));
  run('DELETE FROM users WHERE id = ?', user.id);
  res.json({ ok: true });
});

r.post('/', (req, res) => {
  const user = createUser({ ...req.body, role: 'student' });
  if (req.body.notes) run('UPDATE users SET notes = ? WHERE id = ?', req.body.notes, user.id);
  res.json({ id: user.id });
});

function loadStudent(id) {
  const user = get("SELECT id, name, email, phone, notes, created_at FROM users WHERE id = ? AND role = 'student' AND status = 'active'", id);
  if (!user) throw httpError(404, 'الطالب غير موجود');
  return user;
}

r.get('/:id', (req, res) => {
  const user = loadStudent(toInt(req.params.id));
  const courses = all(
    `SELECT c.id, c.title, c.color, e.created_at AS enrolled_at,
      (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.published = 1) AS lesson_count,
      (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id = p.lesson_id
        WHERE l.course_id = c.id AND p.user_id = e.user_id AND p.completed = 1) AS completed_count,
      (SELECT ROUND(AVG(p.quiz_score)) FROM progress p JOIN lessons l ON l.id = p.lesson_id
        WHERE l.course_id = c.id AND p.user_id = e.user_id AND p.quiz_score IS NOT NULL) AS avg_quiz
    FROM enrollments e JOIN courses c ON c.id = e.course_id WHERE e.user_id = ? ORDER BY e.created_at DESC`,
    user.id,
  );
  const payments = all(
    `SELECT p.*, c.title AS course_title FROM payments p LEFT JOIN courses c ON c.id = p.course_id
     WHERE p.user_id = ? ORDER BY p.paid_at DESC, p.id DESC`,
    user.id,
  );
  const questions = all(
    `SELECT q.id, q.body, q.answer, q.t_ms, q.created_at, l.id AS lesson_id, l.title AS lesson_title
     FROM questions q JOIN lessons l ON l.id = q.lesson_id WHERE q.user_id = ? ORDER BY q.created_at DESC LIMIT 20`,
    user.id,
  );
  const activity = all(
    `SELECT p.updated_at, p.completed, p.quiz_score, l.id AS lesson_id, l.title AS lesson_title
     FROM progress p JOIN lessons l ON l.id = p.lesson_id WHERE p.user_id = ? ORDER BY p.updated_at DESC LIMIT 15`,
    user.id,
  );
  res.json({ ...user, courses, payments, questions, activity });
});

r.put('/:id', (req, res) => {
  const user = loadStudent(toInt(req.params.id));
  const { name, email, phone, notes, password } = req.body;
  if (!String(name || '').trim()) throw httpError(400, 'الاسم مطلوب');
  const normalized = String(email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(normalized)) throw httpError(400, 'البريد الإلكتروني غير صحيح');
  if (get('SELECT id FROM users WHERE email = ? AND id != ?', normalized, user.id)) throw httpError(409, 'البريد مستخدم بالفعل');
  run('UPDATE users SET name = ?, email = ?, phone = ?, notes = ? WHERE id = ?', name.trim(), normalized, phone || null, notes || null, user.id);
  if (password) {
    if (password.length < 6) throw httpError(400, 'كلمة المرور 6 أحرف على الأقل');
    run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), user.id);
  }
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  const user = loadStudent(toInt(req.params.id));
  run('DELETE FROM users WHERE id = ?', user.id);
  res.json({ ok: true });
});

r.post('/:id/enroll', (req, res) => {
  const user = loadStudent(toInt(req.params.id));
  const courseId = toInt(req.body.courseId);
  if (!get('SELECT id FROM courses WHERE id = ?', courseId)) throw httpError(404, 'الكورس غير موجود');
  run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', user.id, courseId);
  res.json({ ok: true });
});

r.delete('/:id/enroll/:courseId', (req, res) => {
  run('DELETE FROM enrollments WHERE user_id = ? AND course_id = ?', toInt(req.params.id), toInt(req.params.courseId));
  res.json({ ok: true });
});

export default r;
