/**
 * Sandbox library — per-user Vercel Sandbox management
 *
 * Core fixes in v3:
 * 1. Sandbox sessions STAY ALIVE by being pinged every ~10min via supervisor
 *    even when no user is visiting the website.
 * 2. ttyd reconnects to the SAME session — stored URL in DB, returned to client
 *    so the browser reconnects to the existing shell, not a new one.
 * 3. Process recovery runs proactively in the supervisor, not only on user visit.
 * 4. Sandbox.getOrCreate with resume:true means same filesystem always.
 */

import { Sandbox } from "@vercel/sandbox";
import { getTursoClient } from "./turso";
import { randomUUID } from "crypto";

export const TERMINAL_PORT = 7681;

// In-memory cache: maps userId -> { sandbox, terminalUrl }
const sandboxCache = new Map<string, { sandbox: Sandbox; terminalUrl: string }>();
const initInProgress = new Set<string>();

const SANDBOX_IMAGE =
  process.env.SANDBOX_IMAGE || "debian-11-terminal:latest";

// Vercel Hobby max session: 45 minutes
// We set it slightly under so we can proactively resume before it dies
const SANDBOX_TIMEOUT_MS = 44 * 60 * 1000;

export interface SandboxInfo {
  sandboxName: string;
  status: "running" | "stopped" | "starting" | "unknown";
  terminalUrl?: string;
  lastStartedAt?: number;
  lastHeartbeatAt?: number;
  ttydReady: boolean;
}

export interface ManagedProcess {
  id: string;
  userId: string;
  name: string;
  command: string;
  workingDir: string;
  restartPolicy: "always" | "on-failure" | "never";
  logFile?: string;
  status: "running" | "stopped" | "failed" | "starting";
  pid?: number;
  failureCount: number;
  maxFailures: number;
  createdAt: number;
  lastStartedAt?: number;
  lastError?: string;
  isInteractive: boolean;
}

/** Derive a stable, unique sandbox name for a user. */
export function userSandboxName(userId: string): string {
  const short = userId.replace(/-/g, "").substring(0, 16);
  return `dwt-${short}`;
}

/** Ensure the user_sandboxes DB row exists. */
async function ensureUserSandboxRow(userId: string): Promise<void> {
  const db = getTursoClient();
  const name = userSandboxName(userId);
  await db.execute({
    sql: `INSERT OR IGNORE INTO user_sandboxes
            (id, user_id, sandbox_name, status, ttyd_port, image, created_at, updated_at)
          VALUES (?, ?, ?, 'unknown', ?, ?, unixepoch(), unixepoch())`,
    args: [randomUUID(), userId, name, TERMINAL_PORT, SANDBOX_IMAGE],
  });
}

/** Update sandbox DB row. */
async function setSandboxStatus(
  userId: string,
  status: string,
  extras?: {
    lastStartedAt?: number;
    terminalUrl?: string;
    lastHeartbeatAt?: number;
    ttydReady?: boolean;
  }
): Promise<void> {
  try {
    const db = getTursoClient();
    let extraSql = "";
    const args: (string | number | null)[] = [status];

    if (extras?.lastStartedAt !== undefined) {
      extraSql += ", last_started_at = ?";
      args.push(extras.lastStartedAt);
    }
    if (extras?.terminalUrl !== undefined) {
      extraSql += ", terminal_url = ?";
      args.push(extras.terminalUrl);
    }
    if (extras?.lastHeartbeatAt !== undefined) {
      extraSql += ", last_heartbeat_at = ?";
      args.push(extras.lastHeartbeatAt);
    }
    args.push(userId);

    await db.execute({
      sql: `UPDATE user_sandboxes
              SET status = ?, updated_at = unixepoch()${extraSql}
              WHERE user_id = ?`,
      args,
    });
  } catch (err) {
    console.error("[sandbox] setSandboxStatus error:", err);
  }
}

/**
 * Kill any existing ttyd, install if missing, start fresh, wait until ready.
 * Returns the ttyd port it's listening on.
 */
async function startTtyd(sandbox: Sandbox, port: number): Promise<void> {
  console.log("[sandbox] startTtyd: killing old instance...");

  // Kill old ttyd
  await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", "pkill -x ttyd 2>/dev/null || true; sleep 0.5"],
    sudo: true,
  });

  // Check if installed
  const checkResult = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", "command -v ttyd >/dev/null 2>&1 && echo FOUND || echo MISSING"],
  });
  const installed = (await checkResult.stdout()).includes("FOUND");

  if (!installed) {
    console.log("[sandbox] Installing ttyd...");
    const r = await sandbox.runCommand({
      cmd: "bash",
      args: [
        "-c",
        "curl -fsSL --retry 5 --retry-delay 2 " +
          "https://github.com/tsl0922/ttyd/releases/download/1.7.7/ttyd.x86_64 " +
          "-o /usr/local/bin/ttyd && chmod 0755 /usr/local/bin/ttyd",
      ],
      sudo: true,
      timeoutMs: 120000,
    });
    if (r.exitCode !== 0) {
      throw new Error(`ttyd install failed: ${await r.stderr()}`);
    }
    console.log("[sandbox] ttyd installed");
  }

  // Start ttyd in background — write PID so we can check/kill it later
  const launchScript = `
nohup /usr/local/bin/ttyd \\
  --port ${port} \\
  --interface 0.0.0.0 \\
  --writable \\
  --client-option titleFixed=Terminal \\
  --client-option enableZmodem=false \\
  bash -l \\
  > /tmp/ttyd.log 2>&1 &
echo $! > /tmp/ttyd.pid
echo "launched pid=$!"
`.trim();

  const startR = await sandbox.runCommand({
    cmd: "bash",
    args: ["-c", launchScript],
    sudo: true,
    detached: true,
  });

  if (startR.exitCode !== 0) {
    throw new Error(`ttyd start failed: ${await startR.stderr()}`);
  }

  // Poll until listening (up to 30 seconds)
  let ready = false;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 1000));
    const v = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", `ss -tln 2>/dev/null | grep -q ':${port} ' && echo READY || echo WAIT`],
    });
    if ((await v.stdout()).includes("READY")) {
      ready = true;
      break;
    }
  }

  if (!ready) {
    const log = await sandbox.runCommand({ cmd: "bash", args: ["-c", "cat /tmp/ttyd.log 2>/dev/null || echo none"] });
    throw new Error(`ttyd not listening on :${port}. Log: ${await log.stdout()}`);
  }

  console.log(`[sandbox] ttyd ready on port ${port}`);
}

/**
 * Check if ttyd is currently running inside the sandbox (without restarting).
 * Used by the heartbeat to avoid unnecessary restarts.
 */
async function isTtydAlive(sandbox: Sandbox, port: number): Promise<boolean> {
  try {
    const r = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", `ss -tln 2>/dev/null | grep -q ':${port} ' && echo YES || echo NO`],
    });
    return (await r.stdout()).includes("YES");
  } catch {
    return false;
  }
}

/**
 * Core function: get or create a sandbox for a user.
 * Uses in-memory cache first, then Sandbox.getOrCreate with resume:true.
 * On resume, only restarts ttyd if it's not already listening.
 */
export async function getOrCreateUserSandbox(
  userId: string
): Promise<{ sandbox: Sandbox; terminalUrl: string }> {
  // Return cached
  const cached = sandboxCache.get(userId);
  if (cached) return cached;

  // Deduplication
  if (initInProgress.has(userId)) {
    let waited = 0;
    while (initInProgress.has(userId) && waited < 120000) {
      await new Promise((r) => setTimeout(r, 500));
      waited += 500;
    }
    const c = sandboxCache.get(userId);
    if (c) return c;
    throw new Error("Sandbox init timed out waiting for another invocation");
  }

  initInProgress.add(userId);

  try {
    await ensureUserSandboxRow(userId);
    const sandboxName = userSandboxName(userId);
    console.log(`[sandbox] getOrCreate: ${sandboxName}`);
    await setSandboxStatus(userId, "starting");

    let ttydStartedInCallback = false;

    const sandbox = await Sandbox.getOrCreate({
      name: sandboxName,
      image: SANDBOX_IMAGE,
      ports: [TERMINAL_PORT],
      timeout: SANDBOX_TIMEOUT_MS,
      persistent: true,
      resume: true,

      onCreate: async (sbx) => {
        console.log(`[sandbox] onCreate: ${sandboxName} — fresh container`);
        // Brand new container: install & start ttyd
        await startTtyd(sbx, TERMINAL_PORT);
        ttydStartedInCallback = true;
      },

      onResume: async (sbx) => {
        console.log(`[sandbox] onResume: ${sandboxName} — checking ttyd`);
        // Resumed container: ttyd may already be running from previous session
        // Only restart if it's dead
        const alive = await isTtydAlive(sbx, TERMINAL_PORT);
        if (!alive) {
          console.log(`[sandbox] ttyd dead after resume — restarting`);
          await startTtyd(sbx, TERMINAL_PORT);
        } else {
          console.log(`[sandbox] ttyd already alive — skipping restart`);
        }
        ttydStartedInCallback = true;
      },
    });

    // If callbacks didn't fire (edge case), ensure ttyd is running
    if (!ttydStartedInCallback) {
      const alive = await isTtydAlive(sandbox, TERMINAL_PORT);
      if (!alive) {
        await startTtyd(sandbox, TERMINAL_PORT);
      }
    }

    // Build terminal URL
    const rawDomain = String(sandbox.domain(TERMINAL_PORT)).trim();
    const hostname = rawDomain.replace(/^(https?:\/\/)+/i, "").replace(/\/+$/, "");
    if (!hostname) throw new Error("Sandbox returned empty domain");
    const terminalUrl = `https://${hostname}`;

    const now = Math.floor(Date.now() / 1000);
    await setSandboxStatus(userId, "running", {
      lastStartedAt: now,
      terminalUrl,
      lastHeartbeatAt: now,
    });

    // Cache it
    const entry = { sandbox, terminalUrl };
    sandboxCache.set(userId, entry);

    console.log(`[sandbox] Ready: ${terminalUrl}`);
    return entry;
  } catch (err) {
    sandboxCache.delete(userId);
    await setSandboxStatus(userId, "unknown");
    throw err;
  } finally {
    initInProgress.delete(userId);
  }
}

/**
 * Get terminal URL — starts sandbox if needed.
 * Returns the SAME URL as long as the sandbox session is alive,
 * so the browser reconnects to the same shell.
 */
export async function getUserTerminalUrl(userId: string): Promise<string> {
  // Try DB first (fastest path — no sandbox call needed if already running)
  const db = getTursoClient();
  const row = await db.execute({
    sql: "SELECT terminal_url, status, last_heartbeat_at FROM user_sandboxes WHERE user_id = ?",
    args: [userId],
  });

  if (row.rows.length > 0) {
    const r = row.rows[0];
    const status = String(r.status ?? "");
    const url = r.terminal_url ? String(r.terminal_url) : "";
    const heartbeat = r.last_heartbeat_at ? Number(r.last_heartbeat_at) : 0;
    const ageSeconds = Math.floor(Date.now() / 1000) - heartbeat;

    // If running, recently heartbeated (<40min), and URL exists — return it
    if (status === "running" && url && ageSeconds < 40 * 60) {
      // Update heartbeat timestamp
      await db.execute({
        sql: "UPDATE user_sandboxes SET last_heartbeat_at = unixepoch() WHERE user_id = ?",
        args: [userId],
      });
      return url;
    }
  }

  // Otherwise start/resume the sandbox
  const { terminalUrl } = await getOrCreateUserSandbox(userId);
  return terminalUrl;
}

/**
 * Heartbeat: called by the supervisor to keep sandboxes alive and
 * restart ttyd + processes if the session expired.
 *
 * Returns what was done.
 */
export async function heartbeatUserSandbox(userId: string): Promise<{
  action: "kept-alive" | "resumed" | "skipped";
  terminalUrl?: string;
  ttydRestarted: boolean;
}> {
  const db = getTursoClient();
  const row = await db.execute({
    sql: "SELECT terminal_url, status, last_heartbeat_at FROM user_sandboxes WHERE user_id = ?",
    args: [userId],
  });

  const r = row.rows[0];
  if (!r) return { action: "skipped", ttydRestarted: false };

  const ageSeconds = r.last_heartbeat_at
    ? Math.floor(Date.now() / 1000) - Number(r.last_heartbeat_at)
    : 999999;

  // If sandbox was recently heartbeated AND we have an in-memory cache,
  // just touch the heartbeat — no Sandbox API call needed
  const cached = sandboxCache.get(userId);
  if (cached && ageSeconds < 35 * 60) {
    // Verify ttyd is still alive
    const alive = await isTtydAlive(cached.sandbox, TERMINAL_PORT);
    if (alive) {
      await db.execute({
        sql: "UPDATE user_sandboxes SET last_heartbeat_at = unixepoch() WHERE user_id = ?",
        args: [userId],
      });
      return { action: "kept-alive", terminalUrl: cached.terminalUrl, ttydRestarted: false };
    }
    // ttyd died — restart it
    await startTtyd(cached.sandbox, TERMINAL_PORT);
    await db.execute({
      sql: "UPDATE user_sandboxes SET last_heartbeat_at = unixepoch() WHERE user_id = ?",
      args: [userId],
    });
    return { action: "kept-alive", terminalUrl: cached.terminalUrl, ttydRestarted: true };
  }

  // Need full resume
  invalidateUserSandboxCache(userId);
  const { terminalUrl } = await getOrCreateUserSandbox(userId);
  return { action: "resumed", terminalUrl, ttydRestarted: true };
}

/** Read sandbox info from DB without starting anything. */
export async function getUserSandboxInfo(userId: string): Promise<SandboxInfo> {
  try {
    await ensureUserSandboxRow(userId);
    const db = getTursoClient();
    const result = await db.execute({
      sql: `SELECT sandbox_name, status, last_started_at, last_heartbeat_at, terminal_url
              FROM user_sandboxes WHERE user_id = ?`,
      args: [userId],
    });
    if (result.rows.length === 0) {
      return { sandboxName: userSandboxName(userId), status: "unknown", ttydReady: false };
    }
    const row = result.rows[0];
    const ageSeconds = row.last_heartbeat_at
      ? Math.floor(Date.now() / 1000) - Number(row.last_heartbeat_at)
      : 999999;
    const isRecent = ageSeconds < 50 * 60;

    return {
      sandboxName: String(row.sandbox_name),
      status: (isRecent ? String(row.status) : "unknown") as SandboxInfo["status"],
      terminalUrl: row.terminal_url ? String(row.terminal_url) : undefined,
      lastStartedAt: row.last_started_at ? Number(row.last_started_at) : undefined,
      lastHeartbeatAt: row.last_heartbeat_at ? Number(row.last_heartbeat_at) : undefined,
      ttydReady: isRecent && String(row.status) === "running",
    };
  } catch (err) {
    console.error("[sandbox] getSandboxInfo error:", err);
    return { sandboxName: userSandboxName(userId), status: "unknown", ttydReady: false };
  }
}

/** Invalidate in-memory cache for a user. */
export function invalidateUserSandboxCache(userId: string): void {
  sandboxCache.delete(userId);
}

// =============================================================================
// Managed Process Manager
// =============================================================================

export async function registerManagedProcess(
  userId: string,
  opts: {
    name: string;
    command: string;
    workingDir?: string;
    restartPolicy?: "always" | "on-failure" | "never";
    logFile?: string;
    maxFailures?: number;
    isInteractive?: boolean;
  }
): Promise<string> {
  const db = getTursoClient();
  const id = randomUUID();
  const logFile = opts.logFile || `/tmp/proc-${id.substring(0, 8)}.log`;

  await db.execute({
    sql: `INSERT INTO managed_processes
            (id, user_id, name, command, working_dir, restart_policy, log_file,
             status, failure_count, max_failures, is_interactive, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'stopped', 0, ?, ?, unixepoch(), unixepoch())`,
    args: [
      id, userId, opts.name, opts.command,
      opts.workingDir ?? "/root",
      opts.restartPolicy ?? "on-failure",
      logFile,
      opts.maxFailures ?? 5,
      opts.isInteractive ? 1 : 0,
    ],
  });

  return id;
}

export async function listManagedProcesses(userId: string): Promise<ManagedProcess[]> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: `SELECT id, user_id, name, command, working_dir, restart_policy,
                 log_file, status, pid, failure_count, max_failures,
                 created_at, last_started_at, last_error, is_interactive
            FROM managed_processes WHERE user_id = ? ORDER BY created_at ASC`,
    args: [userId],
  });
  return result.rows.map((r) => ({
    id: String(r.id),
    userId: String(r.user_id),
    name: String(r.name),
    command: String(r.command),
    workingDir: String(r.working_dir),
    restartPolicy: String(r.restart_policy) as ManagedProcess["restartPolicy"],
    logFile: r.log_file ? String(r.log_file) : undefined,
    status: String(r.status) as ManagedProcess["status"],
    pid: r.pid ? Number(r.pid) : undefined,
    failureCount: Number(r.failure_count),
    maxFailures: Number(r.max_failures),
    createdAt: Number(r.created_at),
    lastStartedAt: r.last_started_at ? Number(r.last_started_at) : undefined,
    lastError: r.last_error ? String(r.last_error) : undefined,
    isInteractive: Boolean(r.is_interactive),
  }));
}

/**
 * Start a managed process inside the user's sandbox.
 * Checks if already running by PID before starting.
 */
export async function startManagedProcess(
  userId: string,
  processId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT * FROM managed_processes WHERE id = ? AND user_id = ?",
    args: [processId, userId],
  });

  if (result.rows.length === 0) return { success: false, error: "Process not found" };
  const proc = result.rows[0];
  if (Boolean(proc.is_interactive)) return { success: false, error: "Interactive processes cannot be auto-started" };

  try {
    // Get sandbox (don't create if not needed — use cached)
    const entry = await getOrCreateUserSandbox(userId);
    const sandbox = entry.sandbox;

    const command = String(proc.command);
    const workingDir = String(proc.working_dir);
    const logFile = String(proc.log_file);

    // Check if already running
    if (proc.pid) {
      const ck = await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `kill -0 ${proc.pid} 2>/dev/null && echo RUN || echo DEAD`],
      });
      if ((await ck.stdout()).includes("RUN")) return { success: true };
    }

    // Launch in background
    const launchCmd =
      `cd "${workingDir}" && ` +
      `nohup bash -c ${JSON.stringify(command)} >> "${logFile}" 2>&1 & echo $!`;

    const sr = await sandbox.runCommand({
      cmd: "bash", args: ["-c", launchCmd], detached: true,
    });

    const pidStr = (await sr.stdout()).trim();
    const pid = parseInt(pidStr, 10);
    if (isNaN(pid)) throw new Error(`Bad PID: "${pidStr}"`);

    await db.execute({
      sql: `UPDATE managed_processes
              SET status='running', pid=?, last_started_at=unixepoch(),
                  last_error=NULL, updated_at=unixepoch()
              WHERE id=?`,
      args: [pid, processId],
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await db.execute({
      sql: `UPDATE managed_processes
              SET status='failed', last_error=?,
                  failure_count=failure_count+1, updated_at=unixepoch()
              WHERE id=?`,
      args: [msg.substring(0, 500), processId],
    });
    return { success: false, error: msg };
  }
}

export async function stopManagedProcess(
  userId: string,
  processId: string
): Promise<{ success: boolean; error?: string }> {
  const db = getTursoClient();
  const result = await db.execute({
    sql: "SELECT pid FROM managed_processes WHERE id=? AND user_id=?",
    args: [processId, userId],
  });
  if (result.rows.length === 0) return { success: false, error: "Process not found" };

  try {
    const pid = result.rows[0].pid;
    if (pid) {
      const cached = sandboxCache.get(userId);
      if (cached) {
        await cached.sandbox.runCommand({
          cmd: "bash",
          args: ["-c", `kill -TERM ${pid} 2>/dev/null || true; sleep 1; kill -9 ${pid} 2>/dev/null || true`],
        });
      }
    }
    await db.execute({
      sql: `UPDATE managed_processes
              SET status='stopped', pid=NULL, last_stopped_at=unixepoch(), updated_at=unixepoch()
              WHERE id=?`,
      args: [processId],
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteManagedProcess(userId: string, processId: string): Promise<boolean> {
  await stopManagedProcess(userId, processId);
  const db = getTursoClient();
  const r = await db.execute({
    sql: "DELETE FROM managed_processes WHERE id=? AND user_id=?",
    args: [processId, userId],
  });
  return (r.rowsAffected ?? 0) > 0;
}

/**
 * Recover managed processes after sandbox resume.
 * Called by the supervisor — works even without a user visiting the site.
 */
export async function recoverManagedProcesses(
  userId: string
): Promise<{ restarted: number; failed: number; details: string[] }> {
  const processes = await listManagedProcesses(userId);
  const details: string[] = [];
  let restarted = 0;
  let failed = 0;

  for (const proc of processes) {
    if (proc.isInteractive || proc.restartPolicy === "never") {
      details.push(`SKIP ${proc.name}: policy=${proc.restartPolicy} interactive=${proc.isInteractive}`);
      continue;
    }
    if (proc.failureCount >= proc.maxFailures) {
      details.push(`SKIP ${proc.name}: max failures (${proc.failureCount}/${proc.maxFailures})`);
      continue;
    }

    // Exponential backoff between restarts
    if (proc.failureCount > 0) {
      await new Promise((r) => setTimeout(r, Math.min(2000 * proc.failureCount, 20000)));
    }

    const res = await startManagedProcess(userId, proc.id);
    if (res.success) {
      restarted++;
      details.push(`STARTED ${proc.name}`);
    } else {
      failed++;
      details.push(`FAILED ${proc.name}: ${res.error}`);
    }
  }

  return { restarted, failed, details };
}

// Legacy compat
export async function getSandboxStatus() {
  return { name: "shared", status: "unknown" as const };
}
export function invalidateSandboxCache() {
  sandboxCache.clear();
}
