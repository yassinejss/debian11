/**
 * POST /api/internal/supervisor
 *
 * Called every 10 minutes by cron-job.org — even when NO user is on the site.
 *
 * What it does:
 * 1. Authenticates via SUPERVISOR_SECRET (Bearer token).
 * 2. Acquires DB lock (prevents duplicate concurrent runs).
 * 3. Finds ALL active users (not just stale ones) and heartbeats their sandboxes.
 * 4. For each sandbox: resume if expired, restart ttyd if dead, restart processes.
 * 5. Records heartbeat + recovery events.
 * 6. Releases lock.
 *
 * KEY CHANGE from v2: We now heartbeat ALL active sandboxes every run,
 * not just stale ones. This keeps sandboxes alive continuously without
 * anyone visiting the website.
 */

import { NextRequest, NextResponse } from "next/server";
import { getTursoClient } from "@/lib/turso";
import {
  heartbeatUserSandbox,
  recoverManagedProcesses,
  invalidateUserSandboxCache,
  getUserSandboxInfo,
} from "@/lib/sandbox";
import { randomUUID } from "crypto";
import { timingSafeEqual, createHmac } from "crypto";

const LOCK_TTL_SECONDS = 8 * 60; // 8 min — must be < scheduler interval (10 min)

function secretMatches(provided: string, expected: string): boolean {
  try {
    const a = Buffer.from(createHmac("sha256", "dwt").update(provided).digest("hex"));
    const b = Buffer.from(createHmac("sha256", "dwt").update(expected).digest("hex"));
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

async function acquireLock(requestId: string): Promise<boolean> {
  const db = getTursoClient();
  const now = Math.floor(Date.now() / 1000);
  try {
    const r = await db.execute({
      sql: `UPDATE supervisor_lock
              SET locked_at=?, lock_expires_at=?, locked_by=?
              WHERE id='global' AND (locked_at IS NULL OR lock_expires_at < ?)`,
      args: [now, now + LOCK_TTL_SECONDS, requestId, now],
    });
    return (r.rowsAffected ?? 0) > 0;
  } catch {
    return false;
  }
}

async function releaseLock(requestId: string): Promise<void> {
  try {
    const db = getTursoClient();
    await db.execute({
      sql: `UPDATE supervisor_lock
              SET locked_at=NULL, lock_expires_at=NULL, locked_by=NULL
              WHERE id='global' AND locked_by=?`,
      args: [requestId],
    });
  } catch {}
}

async function recordHeartbeat(
  action: string,
  result: unknown,
  durationMs: number,
  error?: string
): Promise<void> {
  try {
    const db = getTursoClient();
    await db.execute({
      sql: `INSERT INTO supervisor_heartbeats
              (id, ran_at, action, result, duration_ms, error)
            VALUES (?, unixepoch(), ?, ?, ?, ?)`,
      args: [randomUUID(), action, JSON.stringify(result), durationMs, error ?? null],
    });
  } catch {}
}

async function recordRecoveryEvent(opts: {
  userId?: string;
  sandboxName: string;
  trigger: string;
  startedAt: number;
  success: boolean;
  processesRestarted: number;
  processesFailed: number;
  error?: string;
  details?: string;
}): Promise<void> {
  try {
    const db = getTursoClient();
    await db.execute({
      sql: `INSERT INTO recovery_events
              (id, user_id, sandbox_name, trigger, started_at, completed_at,
               success, processes_restarted, processes_failed, error, details)
            VALUES (?, ?, ?, ?, ?, unixepoch(), ?, ?, ?, ?, ?)`,
      args: [
        randomUUID(), opts.userId ?? null, opts.sandboxName,
        opts.trigger, opts.startedAt,
        opts.success ? 1 : 0, opts.processesRestarted, opts.processesFailed,
        opts.error ?? null, opts.details ?? null,
      ],
    });
  } catch {}
}

export async function POST(req: NextRequest) {
  const start = Date.now();
  const requestId = randomUUID();

  // ── 1. Auth ──────────────────────────────────────────────────────────────
  const supervisorSecret = process.env.SUPERVISOR_SECRET;
  if (!supervisorSecret) {
    return NextResponse.json({ error: "Supervisor not configured" }, { status: 503 });
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";

  if (!provided || !secretMatches(provided, supervisorSecret)) {
    console.warn("[supervisor] Unauthorized from:", req.headers.get("x-forwarded-for") ?? "?");
    await recordHeartbeat("auth-failure", {}, Date.now() - start, "unauthorized");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Lock ──────────────────────────────────────────────────────────────
  const acquired = await acquireLock(requestId);
  if (!acquired) {
    await recordHeartbeat("skip", { reason: "locked" }, Date.now() - start);
    return NextResponse.json({ action: "skip", reason: "locked", requestId });
  }

  const results: Array<{
    userId: string;
    sandboxName: string;
    action: string;
    ttydRestarted: boolean;
    processesRestarted: number;
    processesFailed: number;
    error?: string;
  }> = [];

  try {
    const db = getTursoClient();

    // ── 3. Get ALL active users who have a sandbox row ───────────────────
    // We heartbeat ALL of them — this is what keeps processes alive without
    // anyone visiting the website.
    const usersResult = await db.execute({
      sql: `SELECT us.user_id, us.sandbox_name, us.status, us.last_heartbeat_at
              FROM user_sandboxes us
              JOIN users u ON us.user_id = u.id
              WHERE u.is_active = 1
              ORDER BY us.last_heartbeat_at ASC NULLS FIRST
              LIMIT 20`,
      args: [],
    });

    console.log(`[supervisor] Heartbeating ${usersResult.rows.length} sandboxes`);

    // ── 4. Heartbeat each sandbox ─────────────────────────────────────────
    for (const row of usersResult.rows) {
      const userId = String(row.user_id);
      const sandboxName = String(row.sandbox_name);
      const evtStart = Math.floor(Date.now() / 1000);
      let processesRestarted = 0;
      let processesFailed = 0;
      let recError: string | undefined;

      try {
        // Heartbeat: resume if needed, check ttyd
        const hbResult = await heartbeatUserSandbox(userId);

        // Recover managed processes (always — supervisor is the keeper)
        const procResult = await recoverManagedProcesses(userId);
        processesRestarted = procResult.restarted;
        processesFailed = procResult.failed;

        results.push({
          userId,
          sandboxName,
          action: hbResult.action,
          ttydRestarted: hbResult.ttydRestarted,
          processesRestarted,
          processesFailed,
        });

        // Only log recovery events when something actually happened
        if (hbResult.action === "resumed" || hbResult.ttydRestarted || processesRestarted > 0) {
          await recordRecoveryEvent({
            userId,
            sandboxName,
            trigger: "supervisor",
            startedAt: evtStart,
            success: true,
            processesRestarted,
            processesFailed,
            details: procResult.details.join("; "),
          });
        }

        console.log(
          `[supervisor] ✓ ${sandboxName}: action=${hbResult.action}`,
          `ttydRestarted=${hbResult.ttydRestarted}`,
          `processes=${processesRestarted}`
        );
      } catch (err) {
        recError = err instanceof Error ? err.message : String(err);
        console.error(`[supervisor] ✗ ${sandboxName}:`, recError);
        invalidateUserSandboxCache(userId);

        results.push({
          userId,
          sandboxName,
          action: "error",
          ttydRestarted: false,
          processesRestarted: 0,
          processesFailed: 0,
          error: recError,
        });

        await recordRecoveryEvent({
          userId,
          sandboxName,
          trigger: "supervisor",
          startedAt: evtStart,
          success: false,
          processesRestarted: 0,
          processesFailed: 0,
          error: recError,
        });
      }
    }

    const duration = Date.now() - start;
    const summary = {
      action: "heartbeat",
      sandboxesProcessed: usersResult.rows.length,
      results,
      durationMs: duration,
      requestId,
    };

    await recordHeartbeat("check", summary, duration);
    return NextResponse.json(summary);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[supervisor] Fatal error:", msg);
    const duration = Date.now() - start;
    await recordHeartbeat("error", {}, duration, msg);
    return NextResponse.json({ error: "Supervisor error", requestId }, { status: 500 });
  } finally {
    await releaseLock(requestId);
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
}
