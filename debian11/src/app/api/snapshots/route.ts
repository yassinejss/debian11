import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getTursoClient } from "@/lib/turso";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  const db = getTursoClient();
  const r = await db.execute({ sql: "SELECT * FROM workspace_snapshots WHERE user_id=? ORDER BY created_at DESC", args: [session!.userId] });
  const snapshots = r.rows.map(row => ({
    id: String(row.id), name: String(row.name),
    description: row.description ? String(row.description) : null,
    isFavorite: Boolean(row.is_favorite),
    snapshotData: JSON.parse(String(row.snapshot_data)),
    createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    lastRestoredAt: row.last_restored_at ? Number(row.last_restored_at) : null,
  }));
  return NextResponse.json({ snapshots });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  let body: { name?: string; description?: string; snapshotData?: object };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.name?.trim()) return NextResponse.json({ error: "Name required" }, { status: 400 });
  if (!body.snapshotData) return NextResponse.json({ error: "snapshotData required" }, { status: 400 });
  const db = getTursoClient();
  const id = randomUUID();
  await db.execute({
    sql: "INSERT INTO workspace_snapshots (id,user_id,name,description,snapshot_data,created_at,updated_at) VALUES (?,?,?,?,?,unixepoch(),unixepoch())",
    args: [id, session!.userId, body.name.trim(), body.description ?? null, JSON.stringify(body.snapshotData)],
  });
  return NextResponse.json({ success: true, id }, { status: 201 });
}
