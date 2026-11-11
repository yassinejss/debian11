#!/usr/bin/env tsx
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";

function userSandboxName(userId: string): string {
  return `dwt-${userId.replace(/-/g, "").substring(0, 16)}`;
}

async function runMigration(client: ReturnType<typeof createClient>, path: string) {
  const sql = readFileSync(path, "utf-8");
  const statements = sql.split(";").map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith("--"));
  for (const stmt of statements) {
    try { await client.execute(stmt); }
    catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already exists") && !msg.includes("duplicate") && !msg.includes("no such column")) {
        console.warn(`⚠  ${msg.substring(0, 120)}`);
      }
    }
  }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!url || !authToken) { console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN"); process.exit(1); }
  if (!adminUsername || !adminPassword) { console.error("❌ Missing INITIAL_ADMIN_USERNAME or INITIAL_ADMIN_PASSWORD"); process.exit(1); }

  console.log("🔌 Connecting to Turso...");
  const client = createClient({ url, authToken });

  for (const migration of ["001_initial.sql", "002_multiuser_supervisor.sql", "003_platform_v2.sql"]) {
    const path = join(process.cwd(), "src/database/migrations", migration);
    console.log(`📦 Running ${migration}...`);
    await runMigration(client, path);
    console.log(`✅ ${migration} done`);
  }

  const existing = await client.execute({ sql: "SELECT id FROM users WHERE username=?", args: [adminUsername] });
  let adminId: string;
  if (existing.rows.length > 0) {
    adminId = String(existing.rows[0].id);
    console.log(`ℹ  Admin "${adminUsername}" exists (${adminId})`);
  } else {
    adminId = randomUUID();
    const hash = await argon2.hash(adminPassword, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 });
    await client.execute({ sql: "INSERT INTO users (id,username,password_hash,is_active,is_admin,created_at,updated_at) VALUES (?,?,?,1,1,unixepoch(),unixepoch())", args: [adminId, adminUsername, hash] });
    console.log(`✅ Admin "${adminUsername}" created`);
  }

  const sandboxName = userSandboxName(adminId);
  await client.execute({ sql: "INSERT OR IGNORE INTO user_sandboxes (id,user_id,sandbox_name,status,ttyd_port,created_at,updated_at) VALUES (?,?,?,'unknown',7681,unixepoch(),unixepoch())", args: [randomUUID(), adminId, sandboxName] });
  await client.execute({ sql: "INSERT OR IGNORE INTO supervisor_lock (id) VALUES ('global')", args: [] });

  console.log(`\n✅ Database ready · Admin: ${adminUsername} · Sandbox: ${sandboxName}`);
  process.exit(0);
}

main().catch(err => { console.error("❌", err); process.exit(1); });
