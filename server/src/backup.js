import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR, get } from './db.js';

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const KEEP = 7;

// VACUUM INTO writes a consistent snapshot even while the WAL has unflushed writes.
function snapshot() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const file = path.join(BACKUP_DIR, `codrasa-${new Date().toISOString().slice(0, 10)}.db`);
  if (fs.existsSync(file)) fs.rmSync(file);
  db.exec(`VACUUM INTO '${file.replaceAll("'", "''")}'`);
  const old = fs.readdirSync(BACKUP_DIR).filter((name) => /^codrasa-.*\.db$/.test(name)).sort().slice(0, -KEEP);
  for (const name of old) fs.rmSync(path.join(BACKUP_DIR, name), { force: true });
}

export function startBackups() {
  const users = get('SELECT COUNT(*) AS n FROM users').n;
  console.log(`Database → ${path.join(DATA_DIR, 'codrasa.db')} (${users} users)`);
  const run = () => {
    try {
      snapshot();
    } catch (err) {
      console.error('Backup failed:', err.message);
    }
  };
  run();
  setInterval(run, 24 * 60 * 60 * 1000).unref();
}
