import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getOrCreateUserSandbox } from "@/lib/sandbox";

const SERVER_DIR = "/root/server";
const JAR = "server.jar";
const SCREEN_NAME = "minecraft";

async function runSandboxCmd(sandbox: Awaited<ReturnType<typeof getOrCreateUserSandbox>>["sandbox"], cmd: string) {
  const r = await sandbox.runCommand({ cmd: "bash", args: ["-c", cmd] });
  return (await r.stdout()).trim();
}

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;

  try {
    const { sandbox } = await getOrCreateUserSandbox(session!.userId);

    const [pidOut, uptimeOut, versionOut, logsOut] = await Promise.all([
      runSandboxCmd(sandbox, `pgrep -f "${JAR}" | head -1`),
      runSandboxCmd(sandbox, `ps -o etimes= -p $(pgrep -f "${JAR}" | head -1) 2>/dev/null || echo 0`),
      runSandboxCmd(sandbox, `grep -m1 'Starting minecraft server' ${SERVER_DIR}/logs/latest.log 2>/dev/null | grep -oP '\\d+\\.\\d+\\.\\d+' || echo unknown`),
      runSandboxCmd(sandbox, `tail -40 ${SERVER_DIR}/logs/latest.log 2>/dev/null || echo "No log file found"`),
    ]);

    const pid = parseInt(pidOut) || 0;
    const running = pid > 0;
    const uptime = parseInt(uptimeOut) || 0;

    // Try to get player count from latest.log
    const playersLine = await runSandboxCmd(sandbox, `grep -c 'joined the game' ${SERVER_DIR}/logs/latest.log 2>/dev/null || echo 0`);

    const logs = logsOut.split("\n").filter(Boolean);

    return NextResponse.json({
      status: { running, starting: false, pid: running ? pid : undefined, uptime: running ? uptime : 0, version: versionOut !== "unknown" ? versionOut : undefined, players: "0", maxPlayers: 20 },
      logs,
    });
  } catch (err) {
    return NextResponse.json({ status: { running: false, starting: false }, logs: [], error: "Cannot read server state" });
  }
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;

  let body: { action: string; command?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  try {
    const { sandbox } = await getOrCreateUserSandbox(session!.userId);

    if (body.action === "start") {
      // Check not already running
      const pid = await runSandboxCmd(sandbox, `pgrep -f "${JAR}" | head -1`);
      if (pid) return NextResponse.json({ error: "Server is already running", pid: parseInt(pid) }, { status: 409 });

      // Check server.jar exists
      const exists = await runSandboxCmd(sandbox, `test -f ${SERVER_DIR}/${JAR} && echo yes || echo no`);
      if (exists !== "yes") return NextResponse.json({ error: `${SERVER_DIR}/${JAR} not found. Follow the Setup Guide to install Paper.` }, { status: 400 });

      // Start in screen/background
      await sandbox.runCommand({
        cmd: "bash",
        args: ["-c", `cd ${SERVER_DIR} && nohup java -Xmx1G -Xms512M -jar ${JAR} nogui > ${SERVER_DIR}/logs/latest.log 2>&1 &`],
        detached: true,
      });

      return NextResponse.json({ success: true, message: "Server starting. Check the console for output." });
    }

    if (body.action === "stop") {
      const pid = await runSandboxCmd(sandbox, `pgrep -f "${JAR}" | head -1`);
      if (!pid) return NextResponse.json({ error: "Server is not running" }, { status: 400 });
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `kill -SIGTERM ${pid}`] });
      return NextResponse.json({ success: true, message: "Stop signal sent" });
    }

    if (body.action === "restart") {
      const pid = await runSandboxCmd(sandbox, `pgrep -f "${JAR}" | head -1`);
      if (pid) {
        await sandbox.runCommand({ cmd: "bash", args: ["-c", `kill -SIGTERM ${pid}`] });
        await new Promise(r => setTimeout(r, 3000));
      }
      await sandbox.runCommand({ cmd: "bash", args: ["-c", `cd ${SERVER_DIR} && nohup java -Xmx1G -Xms512M -jar ${JAR} nogui > ${SERVER_DIR}/logs/latest.log 2>&1 &`], detached: true });
      return NextResponse.json({ success: true, message: "Server restarting" });
    }

    if (body.action === "command") {
      // Send command via RCON or screen - fallback: write to stdin via mkfifo if available
      const cmd = (body.command || "").replace(/['"\\]/g, "");
      if (!cmd) return NextResponse.json({ error: "Empty command" }, { status: 400 });
      // We can only send via a named pipe if the server was started with one
      return NextResponse.json({ success: false, error: "Direct command injection requires RCON (not configured). Use the terminal to send commands to the Minecraft process." }, { status: 400 });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
