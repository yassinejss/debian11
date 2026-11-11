#!/usr/bin/env tsx
/**
 * Database setup script: runs all migrations and seeds the initial admin user.
 * Run with: npm run db:migrate
 */

import { createClient } from "@libsql/client";
import { readFileSync } from "fs";
import { join } from "path";
import * as argon2 from "argon2";
import { randomUUID } from "crypto";

function userSandboxName(userId: string): string {
  const short = userId.replace(/-/g, "").substring(0, 16);
  return `dwt-${short}`;
}

async function runMigration(client: ReturnType<typeof createClient>, path: string) {
  const sql = readFileSync(path, "utf-8");
  const statements = sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  for (const stmt of statements) {
    try {
      await client.execute(stmt);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("already exists") && !msg.includes("duplicate")) {
        console.warn(`⚠️  Statement warning: ${msg.substring(0, 100)}`);
      }
    }
  }
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;
  const adminUsername = process.env.INITIAL_ADMIN_USERNAME;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!url || !authToken) {
    console.error("❌ Missing TURSO_DATABASE_URL or TURSO_AUTH_TOKEN");
    process.exit(1);
  }
  if (!adminUsername || !adminPassword) {
    console.error("❌ Missing INITIAL_ADMIN_USERNAME or INITIAL_ADMIN_PASSWORD");
    process.exit(1);
  }

  console.log("🔌 Connecting to Turso database...");
  const client = createClient({ url, authToken });

  console.log("📦 Running migration 001 (initial schema)...");
  await runMigration(client, join(process.cwd(), "src/database/migrations/001_initial.sql"));
  console.log("✅ Migration 001 complete");

  console.log("📦 Running migration 002 (multi-user + supervisor)...");
  await runMigration(client, join(process.cwd(), "src/database/migrations/002_multiuser_supervisor.sql"));
  console.log("✅ Migration 002 complete");

  // Create or update admin user
  const existing = await client.execute({
    sql: "SELECT id FROM users WHERE username = ?",
    args: [adminUsername],
  });

  let adminId: string;

  if (existing.rows.length > 0) {
    adminId = String(existing.rows[0].id);
    console.log(`ℹ️  Admin user '${adminUsername}' exists (id: ${adminId})`);
  } else {
    console.log(`🔐 Creating admin user '${adminUsername}'...`);
    const passwordHash = await argon2.hash(adminPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });
    adminId = randomUUID();
    await client.execute({
      sql: `INSERT INTO users (id, username, password_hash, is_active, is_admin, created_at, updated_at)
            VALUES (?, ?, ?, 1, 1, unixepoch(), unixepoch())`,
      args: [adminId, adminUsername, passwordHash],
    });
    console.log(`✅ Admin user '${adminUsername}' created`);
  }

  // Ensure admin has a user_sandboxes row
  const sandboxName = userSandboxName(adminId);
  await client.execute({
    sql: `INSERT OR IGNORE INTO user_sandboxes
            (id, user_id, sandbox_name, status, ttyd_port, created_at, updated_at)
          VALUES (?, ?, ?, 'unknown', 7681, unixepoch(), unixepoch())`,
    args: [randomUUID(), adminId, sandboxName],
  });

  // Ensure supervisor lock row exists
  await client.execute({
    sql: `INSERT OR IGNORE INTO supervisor_lock (id) VALUES ('global')`,
    args: [],
  });

  console.log("✅ Database setup complete");
  console.log(`\n📋 Summary:`);
  console.log(`   Admin user: ${adminUsername}`);
  console.log(`   Admin sandbox: ${sandboxName}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Database setup failed:", err);
  process.exit(1);
});
