import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { get, run, getSetting, setSetting } from './db.js';
import { httpError } from './utils.js';

let secret = process.env.JWT_SECRET || getSetting('jwt_secret');
if (!secret) {
  secret = crypto.randomBytes(32).toString('hex');
  setSetting('jwt_secret', secret);
}

export const signToken = (user) => jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '30d' });

export const publicUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, phone: u.phone });

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  let user = null;
  if (token) {
    try {
      const payload = jwt.verify(token, secret);
      user = get('SELECT id, name, email, role, phone FROM users WHERE id = ?', payload.id);
    } catch {
      user = null;
    }
  }
  if (!user) return res.status(401).json({ error: 'سجّل الدخول من جديد' });
  req.user = user;
  next();
}

export function requireTeacher(req, res, next) {
  if (req.user?.role !== 'teacher') return res.status(403).json({ error: 'هذه الصفحة للمدرّس فقط' });
  next();
}

export function createUser({ name, email, password, role, phone }) {
  if (!name?.trim()) throw httpError(400, 'الاسم مطلوب');
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw httpError(400, 'البريد الإلكتروني غير صحيح');
  if ((password || '').length < 6) throw httpError(400, 'كلمة المرور 6 أحرف على الأقل');
  const normalized = email.trim().toLowerCase();
  if (get('SELECT id FROM users WHERE email = ?', normalized)) throw httpError(409, 'البريد مستخدم بالفعل');
  const { lastInsertRowid } = run(
    'INSERT INTO users (name, email, password_hash, role, phone) VALUES (?, ?, ?, ?, ?)',
    name.trim(),
    normalized,
    bcrypt.hashSync(password, 10),
    role,
    phone?.trim() || null,
  );
  return get('SELECT * FROM users WHERE id = ?', lastInsertRowid);
}

export const hashPassword = (password) => bcrypt.hashSync(password, 10);
export const checkPassword = (password, hash) => bcrypt.compareSync(password || '', hash);
