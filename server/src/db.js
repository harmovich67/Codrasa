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

// The cloud snapshot version (its updated_at) that the local file currently matches.
// Every Vercel instance keeps its own copy in /tmp, so each one pulls again whenever this changes.
let localVersion = null;

// Swap the database file under the open connection: close it, drop the stale WAL, reopen.
function replaceDbFile(buf) {
  db?.close();
  for (const suffix of ['-wal', '-shm']) fs.rmSync(targetDb + suffix, { force: true });
  fs.writeFileSync(targetDb, buf);
  db = openDb();
}

export async function syncFromCloud() {
  if (!sqlClient) return false;
  try {
    const [meta] = await sqlClient`SELECT updated_at::text AS version FROM codrasa_db_sync WHERE id = 1`;
    if (!meta || meta.version === localVersion) return false;
    const [row] = await sqlClient`SELECT db_base64, updated_at::text AS version FROM codrasa_db_sync WHERE id = 1`;
    if (row?.db_base64 && row.db_base64.length > 100) {
      const buf = Buffer.from(row.db_base64, 'base64');
      replaceDbFile(buf);
      localVersion = row.version;
      console.log(`[DB Sync] Restored database from cloud sync (${buf.length} bytes)`);
      return true;
    }
  } catch (err) {
    console.warn('[DB Sync] Could not restore from cloud:', err.message);
  }
  return false;
}

// Pull a newer snapshot before serving a request; bursts of requests share one check.
let lastCheck = 0;
let inflight = null;
export function refreshFromCloud() {
  if (!sqlClient) return Promise.resolve(false);
  if (inflight) return inflight;
  if (Date.now() - lastCheck < 1500) return Promise.resolve(false);
  lastCheck = Date.now();
  inflight = syncFromCloud().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function syncToCloud() {
  if (!sqlClient || !fs.existsSync(targetDb)) return;
  try {
    try {
      db.exec('PRAGMA wal_checkpoint(TRUNCATE);');
    } catch {}
    const buf = fs.readFileSync(targetDb);
    const b64 = buf.toString('base64');
    const upsert = () =>
      sqlClient`INSERT INTO codrasa_db_sync (id, db_base64, updated_at) VALUES (1, ${b64}, CURRENT_TIMESTAMP) ON CONFLICT (id) DO UPDATE SET db_base64 = EXCLUDED.db_base64, updated_at = CURRENT_TIMESTAMP RETURNING updated_at::text AS version`;
    let rows;
    try {
      rows = await upsert();
    } catch (e) {
      if (e.message && e.message.includes('relation "codrasa_db_sync" does not exist')) {
        await sqlClient`CREATE TABLE IF NOT EXISTS codrasa_db_sync (id INT PRIMARY KEY, db_base64 TEXT, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`;
        rows = await upsert();
      } else {
        throw e;
      }
    }
    // Our own push is now the latest snapshot, so don't download it back.
    localVersion = rows[0]?.version ?? localVersion;
    console.log(`[DB Sync] Persisted database to cloud sync (${buf.length} bytes)`);
  } catch (err) {
    console.error('[DB Sync] Failed to persist to cloud:', err.message);
  }
}

const SCHEMA = `
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

-- A subject decides what a lesson is recorded on: 'code' = Monaco editor, 'board' = whiteboard.
CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'code' CHECK (kind IN ('code', 'board')),
  color TEXT NOT NULL DEFAULT '#6c4cf6',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

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
`;

function openDb() {
  const conn = new DatabaseSync(targetDb);
  conn.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  conn.exec(SCHEMA);

  // Lightweight migrations for databases created before a column existed.
  const hasColumn = (table, column) => conn.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
  // private = hidden from the public catalogue; only students the teacher opens it for can see it.
  if (!hasColumn('courses', 'private')) conn.exec('ALTER TABLE courses ADD COLUMN private INTEGER NOT NULL DEFAULT 0');
  if (!hasColumn('lessons', 'checkpoints')) conn.exec('ALTER TABLE lessons ADD COLUMN checkpoints TEXT');
  // ai_mode: NULL = follow the platform setting, 'on' / 'off' = the teacher's override for this lesson's student assistant.
  if (!hasColumn('lessons', 'ai_mode')) conn.exec('ALTER TABLE lessons ADD COLUMN ai_mode TEXT');
  // status: 'pending' = self-registered student waiting for the teacher's approval; 'active' = can log in.
  if (!hasColumn('users', 'status')) conn.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'");
  // How the student says they paid for a requested course, so the teacher can match the transfer.
  if (!hasColumn('enrollment_requests', 'payment_method')) conn.exec('ALTER TABLE enrollment_requests ADD COLUMN payment_method TEXT');
  if (!hasColumn('enrollment_requests', 'payment_ref')) conn.exec('ALTER TABLE enrollment_requests ADD COLUMN payment_ref TEXT');
  // Subjects: every course belongs to one; the first run seeds "programming" (the code editor).
  if (!hasColumn('courses', 'subject_id')) conn.exec('ALTER TABLE courses ADD COLUMN subject_id INTEGER REFERENCES subjects(id)');
  if (!conn.prepare('SELECT 1 FROM subjects LIMIT 1').get()) {
    conn.exec("INSERT INTO subjects (name, kind, color) VALUES ('البرمجة', 'code', '#6c4cf6')");
  }
  conn.exec("UPDATE courses SET subject_id = (SELECT id FROM subjects ORDER BY (kind = 'code') DESC, id LIMIT 1) WHERE subject_id IS NULL");
  // Lessons recorded in several sittings keep one audio part per sitting: [{ file, start, dur }].
  if (!hasColumn('lessons', 'audio_parts')) conn.exec('ALTER TABLE lessons ADD COLUMN audio_parts TEXT');
  // questions_mode: NULL = follow the platform setting, 'on' / 'off' = the teacher's override for this lesson's interactive questions.
  if (!hasColumn('lessons', 'questions_mode')) conn.exec('ALTER TABLE lessons ADD COLUMN questions_mode TEXT');
  return conn;
}

// `let` so a newer cloud snapshot can replace the connection; importers see the live binding.
export let db;

// 1. Try to restore latest DB from cloud snapshot (this also opens it)
const restored = await syncFromCloud();

// 2. If not restored, copy seed if available
if (!restored && process.env.VERCEL && fs.existsSync(seedDb) && !fs.existsSync(targetDb)) {
  try {
    fs.copyFileSync(seedDb, targetDb);
  } catch {}
}
if (!db) db = openDb();

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
