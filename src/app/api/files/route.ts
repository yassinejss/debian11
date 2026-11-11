import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getOrCreateUserSandbox } from "@/lib/sandbox";

function sanitizePath(p: string): string {
  // Prevent path traversal: resolve to absolute within allowed roots
  const clean = p.replace(/\.\./g, "").replace(/\/+/g, "/").trim();
  if (!clean.startsWith("/")) return "/root/" + clean;
  // Allow /root, /home, /tmp, /workspace — block system dirs
  const allowed = ["/root", "/home", "/tmp", "/workspace", "/var/log"];
  if (!allowed.some(a => clean.startsWith(a))) return "/root";
  return clean;
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  const url = new URL(req.url);
  const rawPath = url.searchParams.get("path") || "/root";
  const path = sanitizePath(rawPath);

  try {
    const { sandbox } = await getOrCreateUserSandbox(session!.userId);
    const r = await sandbox.runCommand({
      cmd: "bash",
      args: ["-c", `ls -lA --time-style=+%s "${path}" 2>/dev/null | tail -n +2 | awk '{print $1,$2,$5,$6,$7,$NF}'`],
    });
    const output = (await r.stdout()).trim();
    const entries = output.split("\n").filter(Boolean).map(line => {
      const parts = line.split(" ");
      const perms = parts[0] || "";
      const links = parts[1] || "1";
      const size = parseInt(parts[2]) || 0;
      const mtime = parseInt(parts[3]) || 0;
      const name = parts.slice(4).join(" ");
      const isDir = perms.startsWith("d");
      const isLink = perms.startsWith("l");
      return { name, path: path.replace(/\/+$/, "") + "/" + name, isDir, isLink, size, mtime, perms };
    }).filter(e => e.name && e.name !== "." && e.name !== "..");

    return NextResponse.json({ path, entries });
  } catch (err) {
    return NextResponse.json({ error: "Cannot list directory", path, entries: [] }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;
  let body: { action: string; path?: string; name?: string; content?: string; newPath?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const path = body.path ? sanitizePath(body.path) : "/root";

  try {
    const { sandbox } = await getOrCreateUserSandbox(session!.userId);

    if (body.action === "mkdir") {
      const name = (body.name || "").replace(/[^a-zA-Z0-9._-]/g, "");
      if (!name) return NextResponse.json({ error: "Invalid folder name" }, { status: 400 });
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `mkdir -p "${path}/${name}"`] });
      return NextResponse.json({ success: true });
    }

    if (body.action === "touch") {
      const name = (body.name || "").replace(/[^a-zA-Z0-9._-]/g, "");
      if (!name) return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `touch "${path}/${name}"`] });
      return NextResponse.json({ success: true });
    }

    if (body.action === "delete") {
      // Extra safety: never delete root-level dirs
      const danger = ["/root", "/home", "/tmp", "/etc", "/usr", "/var", "/bin", "/sbin", "/lib"];
      if (danger.includes(path)) return NextResponse.json({ error: "Refusing to delete protected path" }, { status: 400 });
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `rm -rf "${path}"`] });
      return NextResponse.json({ success: true });
    }

    if (body.action === "rename") {
      const newPath = body.newPath ? sanitizePath(body.newPath) : null;
      if (!newPath) return NextResponse.json({ error: "newPath required" }, { status: 400 });
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `mv "${path}" "${newPath}"`] });
      return NextResponse.json({ success: true });
    }

    if (body.action === "read") {
      const r = await sandbox.runCommand({ cmd: "bash", args: ["-c", `cat "${path}" 2>/dev/null | head -c 262144`] });
      const content = await r.stdout();
      return NextResponse.json({ success: true, content });
    }

    if (body.action === "write") {
      const content = body.content ?? "";
      const escaped = content.replace(/'/g, "'\\''");
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `printf '%s' '${escaped}' > "${path}"`] });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Operation failed" }, { status: 500 });
  }
}
