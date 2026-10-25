import { Router } from 'express';
import { get, getSetting } from '../db.js';
import { signToken, publicUser, requireAuth, createUser, checkPassword } from '../auth.js';
import { httpError } from '../utils.js';

const r = Router();

const teacherExists = () => !!get("SELECT 1 AS x FROM users WHERE role = 'teacher' LIMIT 1");

r.get('/setup-needed', (req, res) => res.json({ needed: !teacherExists() }));

// First run: the very first account becomes the teacher (platform owner).
r.post('/setup', (req, res) => {
  if (teacherExists()) throw httpError(409, 'تم إعداد المنصة بالفعل');
  const user = createUser({ ...req.body, role: 'teacher' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/register', (req, res) => {
  if (getSetting('allow_registration', '1') !== '1') throw httpError(403, 'التسجيل مغلق حاليًا — تواصل مع المدرّس');
  const user = createUser({ ...req.body, role: 'student' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/login', (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user || !checkPassword(req.body.password, user.password_hash)) {
    throw httpError(401, 'البريد أو كلمة المرور غير صحيحة');
  }
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default r;
