import { get } from './db.js';
import { httpError } from './utils.js';

export const isEnrolled = (userId, courseId) =>
  !!get('SELECT 1 AS x FROM enrollments WHERE user_id = ? AND course_id = ?', userId, courseId);

// Teachers see everything; students only see published lessons of courses they're enrolled in.
export function loadLessonFor(user, lessonId) {
  const lesson = get(
    `SELECT l.*, c.title AS course_title, c.published AS course_published
     FROM lessons l JOIN courses c ON c.id = l.course_id WHERE l.id = ?`,
    lessonId,
  );
  if (!lesson) throw httpError(404, 'الدرس غير موجود');
  if (user.role !== 'teacher') {
    if (!lesson.published || !lesson.course_published) throw httpError(404, 'الدرس غير موجود');
    if (!isEnrolled(user.id, lesson.course_id)) throw httpError(403, 'اشترك في الكورس أولًا');
  }
  return lesson;
}
