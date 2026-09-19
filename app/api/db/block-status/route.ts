/**
 * PATCH /api/db/block-status — update status of a single block
 * Body: { id: string, status: 'completed' | 'pending' | 'upcoming' }
 */
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(req: NextRequest) {
  try {
    const { id, status } = await req.json();
    if (!id || !status) {
      return NextResponse.json({ ok: false, error: 'id and status required' }, { status: 400 });
    }

    const db = getDb();
    if (!db) return NextResponse.json({ ok: false, error: 'DB not available in this environment' }, { status: 503 });
    const result = db.prepare(
      'UPDATE schedule_blocks SET status = ?, updated_at = unixepoch() WHERE id = ?'
    ).run(status, id);

    if (result.changes === 0) {
      return NextResponse.json({ ok: false, error: 'Block not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, id, status });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
