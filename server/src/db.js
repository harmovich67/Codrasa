import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(root, process.env.DATA_DIR)
  : process.env.VERCEL
    ? '/tmp/data'
    : path.resolve(root, 'data');
export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const AUDIO_DIR = path.join(UPLOADS_DIR, 'audio');
fs.mkdirSync(AUDIO_DIR, { recursive: true });

const seedDb = path.join(root, 'data', 'codrasa.db');
const targetDb = path.join(DATA_DIR, 'codrasa.db');

// Cloud snapshot sync is optional: without DATABASE_URL the app runs on the local SQLite file only.
let sqlClient = null;
if (process.env.DATABASE_URL) {
  try {
    sqlClient = neon(process.env.DATABASE_URL);
  } catch (e) {
    console.warn('[DB] Neon client init error:', e.message);
  }
} else {
  console.warn('[DB] DATABASE_URL not set — cloud sync disabled, using local database only.');
}

export async function syncFromCloud() {
  if (!sqlClient) return false;
  try {
    const rows = await sqlClient`SELECT db_base64 FROM codrasa_db_sync WHERE id = 1`;
    if (rows && rows.length > 0 && rows[0].db_base64 && rows[0].db_base64.length > 100) {
      const buf = Buffer.from(rows[0].db_base64, 'base64');
      fs.writeFileSync(targetDb, buf);
      console.log(`[DB Sync] Restored database from cloud sync (${buf.length} bytes)`);
      return true;
    }
  } catch (err) {
    console.warn('[DB Sync] Could not restore from cloud:', err.message);
  }
  return false;
}

export async function syncToCloud() {
  if (!sqlClient || !fs.existsSync(targetDb)) return;
  try {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    const buf = fs.readFileSync(targetDb);
    const b64 = buf.toString('base64');
    try {
      await sqlClient`INSERT INTO codrasa_db_sync (id, db_base64, updated_at) VALUES (1, ${b64}, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET db_base64 = EXCLUDED.db_base64, updated_at = CURRENT_TIMESTAMP`;
    } catch (e) {
      if (e.message && e.message.includes('relation "codrasa_db_sync" does not exist')) {
        await sqlClient`CREATE TABLE IF NOT EXISTS codrasa_db_sync (id INT PRIMARY KEY, db_base64 TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
        await sqlClient`INSERT INTO codrasa_db_sync (id, db_base64, updated_at) VALUES (1, ${b64}, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET db_base64 = EXCLUDED.db_base64, updated_at = CURRENT_TIMESTAMP`;
      } else {
        throw e;
      }
    }
    console.log(`[DB Sync] Persisted database to cloud sync (${buf.length} bytes)`);
  } catch (err) {
    console.error('[DB Sync] Failed to persist to cloud:', err.message);
  }
}

// 1. Try to restore latest DB from cloud snapshot
let restored = false;
if (sqlClient) {
  try {
    restored = await syncFromCloud();
  } catch (e) {
    console.warn('[DB Sync] Initial restore failed:', e.message);
  }
}

// 2. If not restored, copy seed if available
if (!restored && process.env.VERCEL && fs.existsSync(seedDb) && !fs.existsSync(targetDb)) {
  try {
    fs.copyFileSync(seedDb, targetDb);
  } catch {}
}

export const db = new DatabaseSync(targetDb);
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('teacher', 'student')),
  phone TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#7c5cff',
  price REAL NOT NULL DEFAULT 0,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lessons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  notes TEXT,
  summary TEXT,
  language TEXT NOT NULL DEFAULT 'javascript',
  recording TEXT,
  audio_file TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  quiz TEXT,
  published INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);

CREATE TABLE IF NOT EXISTS enrollments (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS progress (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  position_ms INTEGER NOT NULL DEFAULT 0,
  completed INTEGER NOT NULL DEFAULT 0,
  quiz_score INTEGER,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER REFERENCES courses(id) ON DELETE SET NULL,
  amount REAL NOT NULL,
  method TEXT,
  note TEXT,
  paid_at TEXT NOT NULL DEFAULT (date('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  t_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_lesson ON events(lesson_id);

CREATE TABLE IF NOT EXISTS questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  t_ms INTEGER NOT NULL DEFAULT 0,
  line INTEGER,
  code TEXT,
  body TEXT NOT NULL,
  answer TEXT,
  answered_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS forks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER REFERENCES lessons(id) ON DELETE SET NULL,
  t_ms INTEGER,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'javascript',
  code TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ai_usage (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS enrollment_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reply TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON enrollment_requests(status);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS checkpoint_attempts (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id INTEGER NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  checkpoint_id TEXT NOT NULL,
  revision TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  code TEXT,
  output TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, lesson_id, checkpoint_id, revision)
);
CREATE INDEX IF NOT EXISTS idx_checkpoint_attempts_lesson ON checkpoint_attempts(lesson_id);
`);

// Lightweight migrations for databases created before a column existed.
const hasColumn = (table, column) => db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
// private = hidden from the public catalogue; only students the teacher opens it for can see it.
if (!hasColumn('courses', 'private')) db.exec('ALTER TABLE courses ADD COLUMN private INTEGER NOT NULL DEFAULT 0');
if (!hasColumn('lessons', 'checkpoints')) db.exec('ALTER TABLE lessons ADD COLUMN checkpoints TEXT');
// ai_mode: NULL = follow the platform setting, 'on' / 'off' = the teacher's override for this lesson's student assistant.
if (!hasColumn('lessons', 'ai_mode')) db.exec('ALTER TABLE lessons ADD COLUMN ai_mode TEXT');

// node:sqlite rejects undefined and booleans, so normalize params first.
const clean = (params) => params.map((v) => (v === undefined ? null : typeof v === 'boolean' ? Number(v) : v));

export const all = (sql, ...params) => db.prepare(sql).all(...clean(params));
export const get = (sql, ...params) => db.prepare(sql).get(...clean(params));
export const run = (sql, ...params) => db.prepare(sql).run(...clean(params));

export function tx(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export const getSetting = (key, fallback = null) =>
  get('SELECT value FROM settings WHERE key = ?', key)?.value ?? fallback;

export const setSetting = (key, value) =>
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value == null ? null : String(value),
  );
