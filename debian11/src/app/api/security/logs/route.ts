import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getTursoClient } from "@/lib/turso";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  const db = getTursoClient();
  try {
    const [auditR, loginR] = await Promise.all([
      db.execute({ sql: "SELECT * FROM audit_logs WHERE user_id=? ORDER BY created_at DESC LIMIT 100", args: [session!.userId] }),
      db.execute({ sql: "SELECT * FROM login_attempts WHERE username=? ORDER BY created_at DESC LIMIT 50", args: [session!.username] }),
    ]);
    return NextResponse.json({
      auditLogs: auditR.rows.map(r => ({ id: String(r.id), userId: String(r.user_id), action: String(r.action), resource: r.resource ? String(r.resource) : null, details: r.details ? String(r.details) : null, ipAddress: r.ip_address ? String(r.ip_address) : null, createdAt: Number(r.created_at) })),
      loginAttempts: loginR.rows.map(r => ({ id: String(r.id), username: String(r.username), success: Number(r.success), ipAddress: String(r.ip_address || ""), createdAt: Number(r.created_at) })),
    });
  } catch { return NextResponse.json({ auditLogs: [], loginAttempts: [] }); }
}
