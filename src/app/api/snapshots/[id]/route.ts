import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getTursoClient } from "@/lib/turso";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  const { id } = await params;
  let body: { name?: string; description?: string; isFavorite?: boolean; lastRestoredAt?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const db = getTursoClient();
  const parts: string[] = ["updated_at=unixepoch()"];
  const args: (string | number | null)[] = [];
  if (body.name !== undefined) { parts.push("name=?"); args.push(body.name); }
  if (body.description !== undefined) { parts.push("description=?"); args.push(body.description); }
  if (body.isFavorite !== undefined) { parts.push("is_favorite=?"); args.push(body.isFavorite ? 1 : 0); }
  if (body.lastRestoredAt !== undefined) { parts.push("last_restored_at=?"); args.push(body.lastRestoredAt); }
  args.push(id, session!.userId);
  await db.execute({ sql: `UPDATE workspace_snapshots SET ${parts.join(",")} WHERE id=? AND user_id=?`, args });
  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  const { id } = await params;
  const db = getTursoClient();
  await db.execute({ sql: "DELETE FROM workspace_snapshots WHERE id=? AND user_id=?", args: [id, session!.userId] });
  return NextResponse.json({ success: true });
}
