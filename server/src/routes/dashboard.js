import { Router } from 'express';
import { all, get } from '../db.js';
import { requireAuth, requireTeacher } from '../auth.js';

const r = Router();
r.use(requireAuth, requireTeacher);

r.get('/', (req, res) => {
  const stats = get(`SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
    (SELECT COUNT(*) FROM courses) AS courses,
    (SELECT COUNT(*) FROM lessons) AS lessons,
    (SELECT COUNT(*) FROM questions WHERE answer IS NULL) AS pending_questions,
    (SELECT COUNT(*) FROM enrollment_requests WHERE status = 'pending') AS pending_requests,
    (SELECT COUNT(DISTINCT user_id) FROM progress WHERE updated_at >= datetime('now', '-7 days')) AS active_7d,
    (SELECT COALESCE(SUM(amount), 0) FROM payments WHERE strftime('%Y-%m', paid_at) = strftime('%Y-%m', 'now')) AS revenue_month,
    (SELECT COALESCE(SUM(amount), 0) FROM payments) AS revenue_total,
    (SELECT COUNT(*) FROM progress WHERE completed = 1) AS completions`);

  const hotLessons = all(`SELECT l.id, l.title, c.title AS course_title, COUNT(*) AS signals
    FROM (SELECT lesson_id FROM events WHERE created_at >= datetime('now', '-30 days')
          UNION ALL SELECT lesson_id FROM questions WHERE created_at >= datetime('now', '-30 days')) s
    JOIN lessons l ON l.id = s.lesson_id JOIN courses c ON c.id = l.course_id
    GROUP BY l.id ORDER BY signals DESC LIMIT 5`);

  const pendingQuestions = all(`SELECT q.id, q.body, q.t_ms, q.created_at, u.name AS student_name, l.title AS lesson_title
    FROM questions q JOIN users u ON u.id = q.user_id JOIN lessons l ON l.id = q.lesson_id
    WHERE q.answer IS NULL ORDER BY q.created_at DESC LIMIT 5`);

  const recentEnrollments = all(`SELECT e.created_at, u.id AS user_id, u.name, c.title AS course_title
    FROM enrollments e JOIN users u ON u.id = e.user_id JOIN courses c ON c.id = e.course_id
    ORDER BY e.created_at DESC LIMIT 6`);

  // Enrolled students who haven't touched any lesson in 7+ days.
  const atRisk = all(`SELECT u.id, u.name, MAX(p.updated_at) AS last_active
    FROM users u JOIN enrollments e ON e.user_id = u.id LEFT JOIN progress p ON p.user_id = u.id
    WHERE u.role = 'student' GROUP BY u.id
    HAVING last_active IS NULL OR last_active < datetime('now', '-7 days')
    ORDER BY last_active LIMIT 6`);

  res.json({ stats, hotLessons, pendingQuestions, recentEnrollments, atRisk });
});

export default r;
