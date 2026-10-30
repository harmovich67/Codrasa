import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';
import { isEnrolled } from '../access.js';
import { httpError, toInt } from '../utils.js';
import { defaultSubjectId } from './subjects.js';

const r = Router();
r.use(requireAuth);

const PAYMENT_METHODS = ['فودافون كاش', 'إنستاباي'];

const LESSON_LIST_COLUMNS = `id, title, position, published, duration_ms, language, description,
  (recording IS NOT NULL) AS has_recording, (quiz IS NOT NULL) AS has_quiz`;

r.get('/', (req, res) => {
  if (req.user.role === 'teacher') {
    return res.json(
      all(`SELECT c.*, s.name AS subject_name, s.kind AS subject_kind,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id) AS lesson_count,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id) AS student_count
      FROM courses c LEFT JOIN subjects s ON s.id = c.subject_id ORDER BY c.created_at DESC`),
    );
  }
  res.json(
    all(
      `SELECT c.id, c.title, c.description, c.color, c.price, c.private, s.name AS subject_name, s.kind AS subject_kind,
        (SELECT COUNT(*) FROM lessons l WHERE l.course_id = c.id AND l.published = 1) AS lesson_count,
        EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?) AS enrolled,
        (SELECT r.status FROM enrollment_requests r WHERE r.course_id = c.id AND r.user_id = ? ORDER BY r.id DESC LIMIT 1) AS request_status,
        (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id = p.lesson_id
          WHERE l.course_id = c.id AND l.published = 1 AND p.user_id = ? AND p.completed = 1) AS completed_count
      FROM courses c LEFT JOIN subjects s ON s.id = c.subject_id
      WHERE c.published = 1
        AND (c.private = 0 OR EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.user_id = ?))
      ORDER BY c.created_at DESC`,
      req.user.id,
      req.user.id,
      req.user.id,
      req.user.id,
    ),
  );
});

function courseFields(body) {
  const title = String(body.title || '').trim();
  if (!title) throw httpError(400, 'عنوان الكورس مطلوب');
  const subjectId = body.subject_id ? toInt(body.subject_id) : defaultSubjectId();
  if (!get('SELECT id FROM subjects WHERE id = ?', subjectId)) throw httpError(400, 'اختار مادة صالحة للكورس');
  return [
    title,
    body.description?.trim() || null,
    /^#[0-9a-f]{6}$/i.test(body.color || '') ? body.color : '#7c5cff',
    Math.max(0, Number(body.price) || 0),
    body.published ? 1 : 0,
    body.private ? 1 : 0,
    subjectId,
  ];
}

r.post('/', requireTeacher, (req, res) => {
  const { lastInsertRowid } = run(
    'INSERT INTO courses (title, description, color, price, published, private, subject_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ...courseFields(req.body),
  );
  res.json(get('SELECT * FROM courses WHERE id = ?', lastInsertRowid));
});

r.put('/:id', requireTeacher, (req, res) => {
  const id = toInt(req.params.id);
  const fields = courseFields(req.body);
  // Lessons are recorded for one kind (editor events vs board strokes), so a course with lessons can't switch kind.
  const kindOf = (subjectId) => get('SELECT kind FROM subjects WHERE id = ?', subjectId)?.kind;
  const current = get('SELECT subject_id FROM courses WHERE id = ?', id);
  if (current && current.subject_id !== fields.at(-1) && kindOf(current.subject_id) !== kindOf(fields.at(-1)) && get('SELECT 1 AS x FROM lessons WHERE course_id = ? LIMIT 1', id)) {
    throw httpError(409, 'الكورس فيه دروس مسجّلة — مينفعش تنقله لمادة بنوع مختلف (برمجة ↔ سبورة)');
  }
  run('UPDATE courses SET title = ?, description = ?, color = ?, price = ?, published = ?, private = ?, subject_id = ? WHERE id = ?', ...fields, id);
  res.json(get('SELECT * FROM courses WHERE id = ?', id));
});

r.delete('/:id', requireTeacher, (req, res) => {
  run('DELETE FROM courses WHERE id = ?', toInt(req.params.id));
  res.json({ ok: true });
});

r.get('/:id', (req, res) => {
  const id = toInt(req.params.id);
  const course = get('SELECT c.*, s.name AS subject_name, s.kind AS subject_kind FROM courses c LEFT JOIN subjects s ON s.id = c.subject_id WHERE c.id = ?', id);
  const hidden = req.user.role !== 'teacher' && (!course?.published || (course.private && !isEnrolled(req.user.id, id)));
  if (!course || hidden) throw httpError(404, 'الكورس غير موجود');

  if (req.user.role === 'teacher') {
    const lessons = all(`SELECT ${LESSON_LIST_COLUMNS} FROM lessons WHERE course_id = ? ORDER BY position, id`, id);
    const students = all(
      `SELECT u.id, u.name, u.email, e.created_at AS enrolled_at,
        (SELECT COUNT(*) FROM progress p JOIN lessons l ON l.id = p.lesson_id
          WHERE l.course_id = ? AND p.user_id = u.id AND p.completed = 1) AS completed_count
      FROM enrollments e JOIN users u ON u.id = e.user_id WHERE e.course_id = ? ORDER BY e.created_at DESC`,
      id,
      id,
    );
    return res.json({ ...course, lessons, students });
  }

  const lessons = all(
    `SELECT l.id, l.title, l.position, l.duration_ms, l.language, l.description,
      (l.quiz IS NOT NULL) AS has_quiz,
      COALESCE(p.completed, 0) AS completed, COALESCE(p.position_ms, 0) AS position_ms, p.quiz_score
    FROM lessons l LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = ?
    WHERE l.course_id = ? AND l.published = 1 ORDER BY l.position, l.id`,
    req.user.id,
    id,
  );
  const request = get('SELECT status, reply FROM enrollment_requests WHERE user_id = ? AND course_id = ? ORDER BY id DESC LIMIT 1', req.user.id, id);
  res.json({ ...course, lessons, enrolled: isEnrolled(req.user.id, id), request_status: request?.status ?? null, request_reply: request?.reply ?? null });
});

// A student asks to join a paid (or private) course; the teacher approves it from the requests page.
r.post('/:id/request', (req, res) => {
  const course = get('SELECT * FROM courses WHERE id = ? AND published = 1', toInt(req.params.id));
  if (!course || (course.private && !isEnrolled(req.user.id, course.id))) throw httpError(404, 'الكورس غير موجود');
  if (isEnrolled(req.user.id, course.id)) throw httpError(409, 'أنت مشترك في الكورس بالفعل');
  if (get("SELECT id FROM enrollment_requests WHERE user_id = ? AND course_id = ? AND status = 'pending'", req.user.id, course.id)) {
    throw httpError(409, 'طلبك قيد المراجعة بالفعل');
  }
  // Paid courses: the student must say which wallet they used and the number they sent from (or the transaction ref).
  let method = null;
  let ref = null;
  if (course.price > 0) {
    method = String(req.body.paymentMethod || '');
    ref = String(req.body.paymentRef || '').trim().slice(0, 100);
    if (!PAYMENT_METHODS.includes(method)) throw httpError(400, 'اختار طريقة الدفع: فودافون كاش أو إنستاباي');
    if (!ref) throw httpError(400, 'اكتب الرقم اللي حوّلت منه أو رقم العملية');
  }
  run(
    'INSERT INTO enrollment_requests (user_id, course_id, message, payment_method, payment_ref) VALUES (?, ?, ?, ?, ?)',
    req.user.id,
    course.id,
    String(req.body.message || '').trim().slice(0, 1000) || null,
    method,
    ref,
  );
  res.json({ ok: true });
});

// Students can self-enroll in free courses; paid ones are enrolled by the teacher after payment.
r.post('/:id/enroll', (req, res) => {
  const course = get('SELECT * FROM courses WHERE id = ? AND published = 1', toInt(req.params.id));
  if (!course || (course.private && req.user.role !== 'teacher')) throw httpError(404, 'الكورس غير موجود');
  if (course.price > 0 && req.user.role !== 'teacher') throw httpError(402, 'هذا الكورس مدفوع — اطلب الاشتراك وهيراجعه المدرّس');
  run('INSERT OR IGNORE INTO enrollments (user_id, course_id) VALUES (?, ?)', req.user.id, course.id);
  res.json({ ok: true });
});

r.post('/:id/lessons', requireTeacher, (req, res) => {
  const courseId = toInt(req.params.id);
  if (!get('SELECT id FROM courses WHERE id = ?', courseId)) throw httpError(404, 'الكورس غير موجود');
  const title = String(req.body.title || '').trim();
  if (!title) throw httpError(400, 'عنوان الدرس مطلوب');
  const next = get('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM lessons WHERE course_id = ?', courseId).p;
  const kind = get('SELECT s.kind FROM courses c LEFT JOIN subjects s ON s.id = c.subject_id WHERE c.id = ?', courseId)?.kind;
  const { lastInsertRowid } = run(
    'INSERT INTO lessons (course_id, title, position, language) VALUES (?, ?, ?, ?)',
    courseId,
    title,
    next,
    kind === 'board' ? 'board' : req.body.language || 'javascript',
  );
  res.json({ id: Number(lastInsertRowid) });
});

r.put('/:id/lessons/order', requireTeacher, (req, res) => {
  const courseId = toInt(req.params.id);
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(toInt) : [];
  tx(() => ids.forEach((lessonId, i) => run('UPDATE lessons SET position = ? WHERE id = ? AND course_id = ?', i, lessonId, courseId)));
  res.json({ ok: true });
});

export default r;
