/**
 * POST /api/db/syllabus  — save a parsed syllabus
 * GET  /api/db/syllabus?id=xxx — load a syllabus by id
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, title, source, totalHours, items } = body;

    const db = getDb();
    if (!db) return NextResponse.json({ ok: false, error: 'DB not available in this environment' }, { status: 503 });

    db.prepare(`
      INSERT OR REPLACE INTO syllabi (id, title, source, total_hours, items_json)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, title, source ?? null, totalHours, JSON.stringify(items));

    return NextResponse.json({ ok: true, id });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get('id');
    const db = getDb();
    if (!db) return NextResponse.json({ ok: false, error: 'DB not available in this environment' }, { status: 503 });

    if (id) {
      const row: any = db.prepare('SELECT * FROM syllabi WHERE id = ?').get(id);
      if (!row) return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
      return NextResponse.json({ ok: true, data: { ...row, items: JSON.parse(row.items_json) } });
    }

    // Return all syllabi (latest first)
    const rows: any[] = db.prepare('SELECT id, title, total_hours, created_at FROM syllabi ORDER BY created_at DESC').all();
    return NextResponse.json({ ok: true, data: rows });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
