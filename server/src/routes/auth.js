import { Router } from 'express';
import { get, getSetting, syncFromCloud } from '../db.js';
import { signToken, publicUser, requireAuth, createUser, checkPassword } from '../auth.js';
import { httpError } from '../utils.js';

const r = Router();

const teacherExists = () => !!get("SELECT 1 AS x FROM users WHERE role = 'teacher' LIMIT 1");

r.get('/setup-needed', async (req, res) => {
  let needed = !teacherExists();
  if (needed) {
    await syncFromCloud();
    needed = !teacherExists();
  }
  res.json({ needed });
});

// First run: the very first account becomes the teacher (platform owner).
r.post('/setup', (req, res) => {
  if (teacherExists()) throw httpError(409, 'تم إعداد المنصة بالفعل');
  const user = createUser({ ...req.body, role: 'teacher' });
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.post('/register', (req, res) => {
  if (getSetting('allow_registration', '1') !== '1') throw httpError(403, 'التسجيل مغلق حاليًا — تواصل مع المدرّس');
  // New students wait for the teacher's approval before they can log in.
  createUser({ ...req.body, role: 'student' }, { status: 'pending' });
  res.json({ pending: true });
});

r.post('/login', async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  let user = get('SELECT * FROM users WHERE email = ?', email);
  if (!user) {
    await syncFromCloud();
    user = get('SELECT * FROM users WHERE email = ?', email);
  }
  if (!user || !checkPassword(req.body.password, user.password_hash)) {
    throw httpError(401, 'البريد أو كلمة المرور غير صحيحة');
  }
  if (user.status === 'pending') throw httpError(403, 'حسابك مستني موافقة المدرّس — هتقدر تدخل أول ما يوافق');
  res.json({ token: signToken(user), user: publicUser(user) });
});

r.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));

export default r;
