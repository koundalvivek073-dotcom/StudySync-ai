/**
 * lib/db.ts
 * SQLite database layer using better-sqlite3.
 * Works locally. On Netlify/serverless, returns a no-op stub.
 */

// Detect serverless environment (Netlify, Vercel, etc.)
const IS_SERVERLESS = process.env.DISABLE_SQLITE === 'true' ||
  process.env.NETLIFY === 'true' ||
  process.env.VERCEL === '1';

let _db: any = null;

export function getDb(): any {
  if (IS_SERVERLESS) return null; // DB disabled in serverless
  if (_db) return _db;

  // Dynamically import to avoid bundling issues
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3');
  const path = require('path');

  const DB_PATH = path.join(process.cwd(), 'syllabiq.db');
  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db: any) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS syllabi (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      source      TEXT,
      total_hours REAL NOT NULL,
      items_json  TEXT NOT NULL,
      created_at  INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id          TEXT PRIMARY KEY,
      syllabus_id TEXT REFERENCES syllabi(id),
      data_json   TEXT NOT NULL,
      created_at  INTEGER DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS schedule_blocks (
      id            TEXT PRIMARY KEY,
      session_id    TEXT NOT NULL,
      syllabus_id   TEXT REFERENCES syllabi(id),
      date          TEXT NOT NULL,
      start_time    TEXT NOT NULL,
      end_time      TEXT NOT NULL,
      type          TEXT NOT NULL,
      label         TEXT NOT NULL,
      color         TEXT,
      status        TEXT DEFAULT 'upcoming',
      original_date TEXT,
      extra_json    TEXT,
      created_at    INTEGER DEFAULT (unixepoch()),
      updated_at    INTEGER DEFAULT (unixepoch())
    );

    CREATE INDEX IF NOT EXISTS idx_blocks_session ON schedule_blocks(session_id);
    CREATE INDEX IF NOT EXISTS idx_blocks_date    ON schedule_blocks(date);
  `);
}
