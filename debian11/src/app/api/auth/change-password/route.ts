import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getTursoClient } from "@/lib/turso";
import * as argon2 from "argon2";

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  let body: { oldPassword?: string; newPassword?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (!body.oldPassword || !body.newPassword) return NextResponse.json({ error: "Both passwords required" }, { status: 400 });
  if (body.newPassword.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
  const db = getTursoClient();
  const r = await db.execute({ sql: "SELECT password_hash FROM users WHERE id=?", args: [session!.userId] });
  if (!r.rows.length) return NextResponse.json({ error: "User not found" }, { status: 404 });
  const hash = String(r.rows[0].password_hash);
  const valid = await argon2.verify(hash, body.oldPassword);
  if (!valid) return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
  const newHash = await argon2.hash(body.newPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
  await db.execute({ sql: "UPDATE users SET password_hash=?, updated_at=unixepoch() WHERE id=?", args: [newHash, session!.userId] });
  return NextResponse.json({ success: true });
}
