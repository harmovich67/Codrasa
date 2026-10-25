import { Router } from 'express';
import { all } from '../db.js';
import { requireAuth } from '../auth.js';
import { checkpointRevision } from '../checkpoints.js';
import { parseJSON } from '../utils.js';

const router = Router();
router.use(requireAuth);

router.get('/', (req, res) => {
  const lessons = all(
    `SELECT l.id, l.title, l.position, l.course_id, l.checkpoints, c.title AS course_title, c.color
     FROM lessons l JOIN courses c ON c.id = l.course_id JOIN enrollments e ON e.course_id = c.id
     WHERE e.user_id = ? AND c.published = 1 AND l.published = 1 AND l.checkpoints IS NOT NULL
     ORDER BY c.id, l.position, l.id`, req.user.id,
  );
  const attempts = all('SELECT lesson_id, checkpoint_id, revision, passed, attempts FROM checkpoint_attempts WHERE user_id = ?', req.user.id);
  const attemptIndex = new Map(attempts.map((attempt) => [`${attempt.lesson_id}:${attempt.checkpoint_id}:${attempt.revision}`, attempt]));
  const skillIndex = new Map();
  for (const lesson of lessons) {
    for (const checkpoint of parseJSON(lesson.checkpoints, [])) {
      const key = checkpoint.skill.toLocaleLowerCase();
      if (!skillIndex.has(key)) skillIndex.set(key, { name: checkpoint.skill, total: 0, passed: 0, attempts: 0, lessons: [] });
      const skill = skillIndex.get(key);
      const attempt = attemptIndex.get(`${lesson.id}:${checkpoint.id}:${checkpointRevision(checkpoint)}`);
      skill.total++;
      skill.passed += attempt?.passed ? 1 : 0;
      skill.attempts += attempt?.attempts || 0;
      skill.lessons.push({ lesson_id: lesson.id, lesson_title: lesson.title, course_id: lesson.course_id, course_title: lesson.course_title, color: lesson.color, checkpoint_id: checkpoint.id, title: checkpoint.title, t_ms: checkpoint.t_ms, passed: !!attempt?.passed, attempts: attempt?.attempts || 0 });
    }
  }
  const skills = [...skillIndex.values()].map((skill) => ({ ...skill, percent: Math.round(skill.passed / skill.total * 100), status: skill.passed === skill.total ? 'mastered' : skill.attempts ? 'practicing' : 'new' }));
  const pending = skills.flatMap((skill) => skill.lessons.filter((lesson) => !lesson.passed).map((lesson) => ({ ...lesson, skill: skill.name })));
  const recommendations = pending.sort((first, second) => Number(second.attempts > 0) - Number(first.attempts > 0)).slice(0, 3).map((item) => ({ ...item, reason: item.attempts ? 'جرّبت التحدي ولسه محتاج محاولة؛ راجع اللحظة دي وجرّب تاني.' : 'خطوتك الجاية: طبّق المهارة في التحدي ده.' }));
  res.json({ skills, recommendations, totals: { skills: skills.length, mastered: skills.filter((skill) => skill.status === 'mastered').length, passed: skills.reduce((sum, skill) => sum + skill.passed, 0), challenges: skills.reduce((sum, skill) => sum + skill.total, 0) } });
});

export default router;
