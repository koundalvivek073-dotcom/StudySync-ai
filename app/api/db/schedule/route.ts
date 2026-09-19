/**
 * POST /api/db/schedule  — save a full schedule (bulk upsert)
 * GET  /api/db/schedule?sessionId=xxx — load schedule for a session
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { sessionId, syllabusId, blocks } = await req.json();
    const db = getDb();
    if (!db) return NextResponse.json({ ok: false, error: 'DB not available in this environment' }, { status: 503 });

    const upsert = db.prepare(`
      INSERT OR REPLACE INTO schedule_blocks
        (id, session_id, syllabus_id, date, start_time, end_time, type, label, color, status, original_date, extra_json, updated_at)
      VALUES
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    `);

    const insertMany = db.transaction((rows: any[]) => {
      for (const b of rows) {
        upsert.run(
          b.id, sessionId, syllabusId ?? null,
          b.date, b.startTime, b.endTime,
          b.type, b.label, b.color ?? null,
          b.status ?? 'upcoming', b.originalDate ?? null,
          JSON.stringify({ syllabusItemId: b.syllabusItemId, notes: b.notes }),
        );
      }
    });

    insertMany(blocks);
    return NextResponse.json({ ok: true, saved: blocks.length });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId');
    if (!sessionId) return NextResponse.json({ ok: false, error: 'sessionId required' }, { status: 400 });

    const db = getDb();
    const rows: any[] = db.prepare(
      'SELECT * FROM schedule_blocks WHERE session_id = ? ORDER BY date, start_time'
    ).all(sessionId);

    const blocks = rows.map((r) => {
      const extra = r.extra_json ? JSON.parse(r.extra_json) : {};
      return {
        id: r.id,
        date: r.date,
        startTime: r.start_time,
        endTime: r.end_time,
        type: r.type,
        label: r.label,
        color: r.color,
        status: r.status,
        originalDate: r.original_date,
        ...extra,
      };
    });

    return NextResponse.json({ ok: true, data: blocks });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
