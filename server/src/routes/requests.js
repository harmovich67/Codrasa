import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { httpError, toInt } from '../utils.js';

const r = Router();
r.use(requireAuth, requireTeacher);

r.get('/', (req, res) => {
  const where = req.query.status === 'all' ? '' : "WHERE r.status = 'pending'";
  res.json(
    all(`SELECT r.*, u.name AS student_name, u.email AS student_email, u.phone AS student_phone,
        c.title AS course_title, c.price AS course_price, c.color AS course_color
      FROM enrollment_requests r JOIN users u ON u.id = r.user_id JOIN courses c ON c.id = r.course_id
      ${where} ORDER BY (r.status = 'pending') DESC, r.created_at DESC LIMIT 200`),
  );
});

function loadPending(id) {
  const request = get('SELECT * FROM enrollment_requests WHERE id = ?', id);
  if (!request) throw httpError(404, 'الطلب غير موجود');
  if (request.status !== 'pending') throw httpError(409, 'تم البت في هذا الطلب بالفعل');
  return request;
}

// Approving enrolls the student; optionally records the payment in the same step.
r.post('/:id/approve', (req, res) => {
  const request = loadPending(toInt(req.params.id));
  const amount = Number(req.body.amount);
  if (req.body.recordPayment && !(amount > 0)) throw httpError(400, 'اكتب مبلغ الدفعة أو ألغِ تسجيل الدفعة');
  tx(() => {
    run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', request.user_id, request.course_id);
    if (req.body.recordPayment) {
      run('INSERT INTO payments (user_id, course_id, amount, method, note) VALUES (?, ?, ?, ?, ?)', request.user_id, request.course_id, amount, req.body.method || null, 'من طلب اشتراك');
    }
    run("UPDATE enrollment_requests SET status = 'approved', decided_at = datetime('now'), reply = ? WHERE id = ?", String(req.body.reply || '').trim() || null, request.id);
  });
  res.json({ ok: true });
});

r.post('/:id/reject', (req, res) => {
  const request = loadPending(toInt(req.params.id));
  run("UPDATE enrollment_requests SET status = 'rejected', decided_at = datetime('now'), reply = ? WHERE id = ?", String(req.body.reply || '').trim() || null, request.id);
  res.json({ ok: true });
});

export default r;
