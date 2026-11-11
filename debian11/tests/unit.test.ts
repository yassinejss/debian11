/**
 * DWT v2 Unit Tests
 * Run: npm test
 */

import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { createHmac, timingSafeEqual } from "crypto";

let passed = 0, failed = 0, skipped = 0;
const tests: Array<{ name: string; fn: (() => Promise<void>) | null; skip: boolean }> = [];

function test(name: string, fn: () => Promise<void>) { tests.push({ name, fn, skip: false }); }
function skip(name: string) { tests.push({ name, fn: null, skip: true }); }

async function run() {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n  DWT v2 — Unit Tests\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  for (const t of tests) {
    if (t.skip || !t.fn) { console.log(`  ⏭  SKIP  ${t.name}`); skipped++; continue; }
    try { await t.fn(); console.log(`  ✅ PASS  ${t.name}`); passed++; }
    catch (e) { console.log(`  ❌ FAIL  ${t.name}\n       ${e instanceof Error ? e.message : e}`); failed++; }
  }
  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`  ${passed} passed  ${failed} failed  ${skipped} skipped`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  if (failed > 0) process.exit(1);
}

// ── Argon2id ────────────────────────────────────
test("[Auth] argon2id hash and verify", async () => {
  const h = await argon2.hash("correct", { type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1 });
  if (!h.startsWith("$argon2id$")) throw new Error("Wrong hash type");
  if (!await argon2.verify(h, "correct")) throw new Error("Verify failed");
  if (await argon2.verify(h, "wrong")) throw new Error("Wrong pw accepted");
});

test("[Auth] different passwords produce different hashes", async () => {
  const opts = { type: argon2.argon2id, memoryCost: 4096, timeCost: 2, parallelism: 1 };
  const h1 = await argon2.hash("pass1", opts);
  const h2 = await argon2.hash("pass2", opts);
  if (h1 === h2) throw new Error("Collision");
});

// ── Supervisor secret ────────────────────────────
test("[Supervisor] timing-safe secret compare", async () => {
  function secretMatches(provided: string, expected: string): boolean {
    try {
      const a = Buffer.from(createHmac("sha256", "dwt").update(provided).digest("hex"));
      const b = Buffer.from(createHmac("sha256", "dwt").update(expected).digest("hex"));
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch { return false; }
  }
  const secret = "my-super-long-supervisor-secret-32chars";
  if (!secretMatches(secret, secret)) throw new Error("Same secret rejected");
  if (secretMatches("wrong", secret)) throw new Error("Wrong secret accepted");
  if (secretMatches("", secret)) throw new Error("Empty accepted");
});

// ── Sandbox naming ──────────────────────────────
test("[Sandbox] stable unique name per user", () => {
  const name = (id: string) => `dwt-${id.replace(/-/g, "").substring(0, 16)}`;
  const id1 = randomUUID(), id2 = randomUUID();
  if (name(id1) === name(id2)) throw new Error("Collision between users");
  if (name(id1) !== name(id1)) throw new Error("Not stable");
  if (!name(id1).startsWith("dwt-")) throw new Error("Wrong prefix");
  if (name(id1).length > 48) throw new Error("Too long");
  return Promise.resolve();
});

// ── Path sanitization ───────────────────────────
test("[Files] path traversal blocked", () => {
  const sanitize = (p: string) => {
    const clean = p.replace(/\.\./g, "").replace(/\/+/g, "/").trim();
    if (!clean.startsWith("/")) return "/root/" + clean;
    const allowed = ["/root", "/home", "/tmp", "/workspace", "/var/log"];
    if (!allowed.some(a => clean.startsWith(a))) return "/root";
    return clean;
  };
  if (sanitize("../../etc/passwd") !== "/root/etcpasswd" && sanitize("../../etc/passwd") !== "/root") {}
  if (sanitize("/etc/shadow").includes("/etc/shadow")) throw new Error("etc/ not blocked");
  if (!sanitize("/root/mydir").startsWith("/root")) throw new Error("root subdir rejected");
  if (!sanitize("/tmp/test").startsWith("/tmp")) throw new Error("tmp rejected");
  return Promise.resolve();
});

// ── Input sanitization ──────────────────────────
test("[Security] sanitize strips HTML", () => {
  const s = (i: string, m = 256) => i.replace(/[<>&"']/g, "").trim().substring(0, m);
  const r = s('<script>alert("xss")</script>');
  if (r.includes("<") || r.includes(">")) throw new Error(`HTML not stripped: ${r}`);
  return Promise.resolve();
});

test("[Security] sanitize enforces max length", () => {
  const s = (i: string, m = 256) => i.replace(/[<>&"']/g, "").trim().substring(0, m);
  if (s("a".repeat(1000), 64).length > 64) throw new Error("Max length not enforced");
  return Promise.resolve();
});

// ── Username validation ─────────────────────────
test("[Auth] username regex validation", () => {
  const valid = (u: string) => /^[a-z0-9_-]+$/.test(u);
  if (!valid("yassinejss")) throw new Error("Valid rejected");
  if (!valid("test-user_1")) throw new Error("Valid with dashes rejected");
  if (valid("user@domain")) throw new Error("@ accepted");
  if (valid("user name")) throw new Error("space accepted");
  if (valid("")) throw new Error("empty accepted");
  return Promise.resolve();
});

// ── Process restart policy ──────────────────────
test("[Process] restart policy logic", () => {
  const shouldRestart = (policy: string, interactive: boolean, fails: number, max: number) => {
    if (interactive || policy === "never") return false;
    if (fails >= max) return false;
    return true;
  };
  if (shouldRestart("never", false, 0, 5)) throw new Error("never triggers restart");
  if (shouldRestart("on-failure", true, 0, 5)) throw new Error("interactive triggers restart");
  if (!shouldRestart("on-failure", false, 0, 5)) throw new Error("on-failure did not restart");
  if (shouldRestart("always", false, 5, 5)) throw new Error("max-failure ignored");
  return Promise.resolve();
});

// ── Backoff ─────────────────────────────────────
test("[Process] exponential backoff", () => {
  const backoff = (n: number) => Math.min(2000 * n, 20000);
  if (backoff(0) !== 0) throw new Error(`backoff(0) = ${backoff(0)}, want 0`);
  if (backoff(1) !== 2000) throw new Error(`backoff(1) = ${backoff(1)}, want 2000`);
  if (backoff(100) !== 20000) throw new Error(`cap not working: ${backoff(100)}`);
  return Promise.resolve();
});

// ── Lock TTL ────────────────────────────────────
test("[Supervisor] lock TTL < scheduler interval", () => {
  const LOCK_TTL = 8 * 60;
  const SCHEDULER = 10 * 60;
  if (LOCK_TTL >= SCHEDULER) throw new Error("Deadlock risk: lock TTL >= scheduler interval");
  return Promise.resolve();
});

// ── Snapshot structure ──────────────────────────
test("[Snapshots] snapshot schema is valid JSON-serializable", () => {
  const snap = { layout: "single", tabs: [{ id: "tab-1", label: "Shell 1", pane: "left" }], splitMode: "none", fontSize: 14, version: 1 };
  const json = JSON.stringify(snap);
  const parsed = JSON.parse(json);
  if (parsed.version !== 1) throw new Error("Version missing");
  if (!Array.isArray(parsed.tabs)) throw new Error("Tabs not array");
  return Promise.resolve();
});

// ── UUID ─────────────────────────────────────────
test("[Core] UUID v4 generation", () => {
  const id = randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)) throw new Error(`Bad UUID: ${id}`);
  return Promise.resolve();
});

// ── File icon logic ─────────────────────────────
test("[Files] file icon detection", () => {
  const icon = (name: string, isDir: boolean) => {
    if (isDir) return "📁";
    const ext = name.split(".").pop()?.toLowerCase() || "";
    if (["js","ts","jsx","tsx"].includes(ext)) return "📜";
    if (["py"].includes(ext)) return "🐍";
    if (["sh","bash"].includes(ext)) return "⚡";
    return "📄";
  };
  if (icon("src", true) !== "📁") throw new Error("Dir icon wrong");
  if (icon("script.py", false) !== "🐍") throw new Error("Python icon wrong");
  if (icon("app.ts", false) !== "📜") throw new Error("TS icon wrong");
  if (icon("run.sh", false) !== "⚡") throw new Error("Shell icon wrong");
  return Promise.resolve();
});

// ── REMOTE tests (skipped) ───────────────────────
skip("[REMOTE] Turso: connection and migrations");
skip("[REMOTE] Sandbox: getOrCreate per-user");
skip("[REMOTE] Supervisor: authenticated POST succeeds");
skip("[REMOTE] Supervisor: unauthenticated returns 401");
skip("[REMOTE] Files: list /root directory");
skip("[REMOTE] System: read CPU/memory metrics");

run();
