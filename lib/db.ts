/**
 * lib/db.ts
 * SQLite database layer using better-sqlite3.
 * The .db file is created automatically at the project root.
 * Only runs on the server (Next.js API routes).
 */

import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = path.join(process.cwd(), 'syllabiq.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');

  initSchema(_db);
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    -- Stored syllabi
    CREATE TABLE IF NOT EXISTS syllabi (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      source      TEXT,
      total_hours REAL NOT NULL,
      items_json  TEXT NOT NULL,
      created_at  INTEGER DEFAULT (unixepoch())
    );

    -- Lifestyle profiles
    CREATE TABLE IF NOT EXISTS profiles (
      id          TEXT PRIMARY KEY,
      syllabus_id TEXT REFERENCES syllabi(id),
      data_json   TEXT NOT NULL,
      created_at  INTEGER DEFAULT (unixepoch())
    );

    -- Generated schedule blocks
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
