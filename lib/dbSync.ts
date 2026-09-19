/**
 * lib/dbSync.ts
 * Client-side helper functions that call the Next.js API routes
 * to persist data in SQLite without requiring a cloud account.
 */

import { ParsedSyllabus, AvailabilityProfile, ScheduleBlock, BlockStatus } from '@/lib/types';

// ─── Session ID ───────────────────────────────────────────────────────────────
// A random ID stored in localStorage identifies this user's data.

export function getSessionId(): string {
  if (typeof window === 'undefined') return 'server';
  let id = localStorage.getItem('syllabiq_session_id');
  if (!id) {
    id = 'sess_' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
    localStorage.setItem('syllabiq_session_id', id);
  }
  return id;
}

// ─── Save syllabus ────────────────────────────────────────────────────────────

export async function saveSyllabus(syllabus: ParsedSyllabus): Promise<void> {
  try {
    await fetch('/api/db/syllabus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: syllabus.id,
        title: syllabus.title,
        source: syllabus.source ?? 'upload',
        totalHours: syllabus.totalHours,
        items: syllabus.items,
      }),
    });
  } catch (e) {
    console.warn('[DB] saveSyllabus failed (offline?):', e);
  }
}

// ─── Save full schedule ───────────────────────────────────────────────────────

export async function saveSchedule(
  blocks: ScheduleBlock[],
  syllabusId: string,
): Promise<void> {
  try {
    const sessionId = getSessionId();
    await fetch('/api/db/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, syllabusId, blocks }),
    });
  } catch (e) {
    console.warn('[DB] saveSchedule failed (offline?):', e);
  }
}

// ─── Load schedule from DB ────────────────────────────────────────────────────

export async function loadScheduleFromDb(): Promise<ScheduleBlock[] | null> {
  try {
    const sessionId = getSessionId();
    const res = await fetch(`/api/db/schedule?sessionId=${sessionId}`);
    const json = await res.json();
    if (json.ok && json.data.length > 0) return json.data as ScheduleBlock[];
    return null;
  } catch (e) {
    console.warn('[DB] loadSchedule failed (offline?):', e);
    return null;
  }
}

// ─── Update a single block's status ──────────────────────────────────────────

export async function persistBlockStatus(id: string, status: BlockStatus): Promise<void> {
  try {
    await fetch('/api/db/block-status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
  } catch (e) {
    console.warn('[DB] persistBlockStatus failed (offline?):', e);
  }
}
