import fs from 'node:fs';
import path from 'node:path';
import { AUDIO_DIR, DATA_DIR, sql } from './db.js';
import { httpError } from './utils.js';

/*
 * Where lesson voice files live.
 *
 * On Vercel the disk (/tmp) is wiped by every cold start and every deploy, so a file that only
 * exists there is lost. With DATABASE_URL set, the voice is therefore also kept in Neon as chunk
 * rows (file, idx, bytes) and rebuilt on disk on demand; without it (local dev) the disk is the store.
 * Uploads arrive in small chunks because a serverless request body is capped at 4.5 MB.
 */

const NAME = /^[A-Za-z0-9_-]+\.webm$/;
export const isAudioName = (name) => NAME.test(String(name || ''));

const CHUNK_DIR = path.join(DATA_DIR, 'audio-chunks');
const localPath = (file) => path.join(AUDIO_DIR, file);

let tableReady = null;
const ensureTable = () =>
  (tableReady ??= sql`CREATE TABLE IF NOT EXISTS audio_chunks (
    file TEXT NOT NULL, idx INT NOT NULL, data BYTEA NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (file, idx)
  )`.catch((err) => {
    tableReady = null;
    throw err;
  }));

export async function putChunk(file, idx, buffer) {
  if (!isAudioName(file)) throw httpError(400, 'اسم ملف الصوت غير صالح');
  if (sql) {
    await ensureTable();
    const b64 = buffer.toString('base64');
    await sql`INSERT INTO audio_chunks (file, idx, data) VALUES (${file}, ${idx}, decode(${b64}, 'base64'))
      ON CONFLICT (file, idx) DO UPDATE SET data = EXCLUDED.data, created_at = CURRENT_TIMESTAMP`;
    return;
  }
  const dir = path.join(CHUNK_DIR, file);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, String(idx)), buffer);
}

// Called once all chunks are up: checks none is missing (and, locally, assembles the file).
export async function finishUpload(file, total) {
  if (!Number.isInteger(total) || total < 1 || total > 500) throw httpError(400, 'عدد أجزاء الصوت غير صالح');
  if (sql) {
    await ensureTable();
    const rows = await sql`SELECT idx, length(data) AS n FROM audio_chunks WHERE file = ${file} ORDER BY idx`;
    if (rows.length !== total || rows.some((row, i) => Number(row.idx) !== i)) throw httpError(400, 'جزء من الصوت ماوصلش — جرّب ترفعه تاني');
    return rows.reduce((sum, row) => sum + Number(row.n), 0);
  }
  const dir = path.join(CHUNK_DIR, file);
  const parts = [];
  for (let i = 0; i < total; i++) {
    const part = path.join(dir, String(i));
    if (!fs.existsSync(part)) throw httpError(400, 'جزء من الصوت ماوصلش — جرّب ترفعه تاني');
    parts.push(fs.readFileSync(part));
  }
  const data = Buffer.concat(parts);
  fs.writeFileSync(localPath(file), data);
  fs.rmSync(dir, { recursive: true, force: true });
  return data.length;
}

const inflight = new Map();

// Makes sure the file exists on this instance's disk, rebuilding it from Neon after a cold start or deploy.
export function ensureLocal(file) {
  if (!isAudioName(file)) return Promise.resolve(false);
  if (fs.existsSync(localPath(file))) return Promise.resolve(true);
  if (!sql) return Promise.resolve(false);
  if (!inflight.has(file)) {
    inflight.set(
      file,
      (async () => {
        await ensureTable();
        const rows = await sql`SELECT idx, encode(data, 'base64') AS b64 FROM audio_chunks WHERE file = ${file} ORDER BY idx`;
        if (!rows.length) return false;
        const data = Buffer.concat(rows.map((row) => Buffer.from(row.b64, 'base64')));
        const tmp = `${localPath(file)}.${process.pid}.tmp`;
        fs.writeFileSync(tmp, data);
        fs.renameSync(tmp, localPath(file)); // atomic: a concurrent range request never sees half a file
        return true;
      })().finally(() => inflight.delete(file)),
    );
  }
  return inflight.get(file);
}

export async function removeAudioFile(file) {
  if (!isAudioName(file)) return;
  fs.rmSync(localPath(file), { force: true });
  fs.rmSync(path.join(CHUNK_DIR, file), { recursive: true, force: true });
  if (sql) {
    try {
      await ensureTable();
      await sql`DELETE FROM audio_chunks WHERE file = ${file}`;
    } catch (err) {
      console.warn('[audio] could not delete from cloud:', err.message);
    }
  }
}
