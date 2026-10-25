import { Router } from 'express';
import { all, get, run } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { httpError, toInt } from '../utils.js';

const r = Router();
r.use(requireAuth, requireTeacher);

r.get('/', (req, res) => {
  const items = all(
    `SELECT p.*, u.name AS student_name, c.title AS course_title
     FROM payments p JOIN users u ON u.id = p.user_id LEFT JOIN courses c ON c.id = p.course_id
     ORDER BY p.paid_at DESC, p.id DESC`,
  );
  const totals = get(
    `SELECT COALESCE(SUM(amount), 0) AS total,
      COALESCE(SUM(CASE WHEN strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now') THEN amount END), 0) AS this_month,
      COUNT(*) AS count
     FROM payments`,
  );
  const monthly = all(
    `SELECT strftime('%Y-%m', paid_at) AS month, SUM(amount) AS total FROM payments
     WHERE paid_at >= date('now', 'start of month', '-11 months') GROUP BY month ORDER BY month`,
  );
  const byCourse = all(
    `SELECT COALESCE(c.title, 'بدون كورس') AS title, SUM(p.amount) AS total
     FROM payments p LEFT JOIN courses c ON c.id = p.course_id GROUP BY p.course_id ORDER BY total DESC`,
  );
  res.json({ items, totals, monthly, byCourse });
});

r.post('/', (req, res) => {
  const userId = toInt(req.body.userId);
  const courseId = toInt(req.body.courseId);
  const amount = Number(req.body.amount);
  if (!get("SELECT id FROM users WHERE id = ? AND role = 'student'", userId)) throw httpError(400, 'اختر الطالب');
  if (!(amount > 0)) throw httpError(400, 'المبلغ لازم يكون أكبر من صفر');
  const paidAt = /^\d{4}-\d{2}-\d{2}$/.test(req.body.paidAt || '') ? req.body.paidAt : new Date().toISOString().slice(0, 10);
  run(
    'INSERT INTO payments (user_id, course_id, amount, method, note, paid_at) VALUES (?, ?, ?, ?, ?, ?)',
    userId,
    courseId,
    amount,
    req.body.method || null,
    req.body.note || null,
    paidAt,
  );
  // Paying for a course enrolls the student automatically.
  if (courseId && req.body.enroll !== false) {
    run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', userId, courseId);
  }
  res.json({ ok: true });
});

r.delete('/:id', (req, res) => {
  run('DELETE FROM payments WHERE id = ?', toInt(req.params.id));
  res.json({ ok: true });
});

export default r;
