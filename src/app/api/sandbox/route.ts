/**
 * GET  /api/sandbox  — Get current sandbox status (no side effects)
 * POST /api/sandbox  — Connect to sandbox (returns existing URL if already running)
 *
 * KEY FIX: POST now returns the SAME terminal URL as long as the sandbox
 * session is alive. The browser reconnects to the same ttyd shell, so
 * the user resumes exactly where they left off.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import {
  getUserTerminalUrl,
  getUserSandboxInfo,
  invalidateUserSandboxCache,
} from "@/lib/sandbox";
import { getTursoClient } from "@/lib/turso";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;

  const info = await getUserSandboxInfo(session!.userId);
  return NextResponse.json({ status: info, username: session!.username, isAdmin: session!.isAdmin });
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;

  const userId = session!.userId;

  try {
    // getUserTerminalUrl returns existing URL if sandbox is still running
    // (checks DB heartbeat — no Sandbox API call if already alive)
    const terminalUrl = await getUserTerminalUrl(userId);
    const info = await getUserSandboxInfo(userId);

    // Touch heartbeat so supervisor knows someone is active
    const db = getTursoClient();
    await db.execute({
      sql: "UPDATE user_sandboxes SET last_heartbeat_at=unixepoch() WHERE user_id=?",
      args: [userId],
    });

    return NextResponse.json({
      success: true,
      terminalUrl,
      status: info,
      username: session!.username,
      isAdmin: session!.isAdmin,
    });
  } catch (err) {
    invalidateUserSandboxCache(userId);
    const message = err instanceof Error ? err.message : "Failed to initialize sandbox";
    console.error("[api/sandbox] Error:", err);
    return NextResponse.json({ error: "Sandbox error", message }, { status: 500 });
  }
}
