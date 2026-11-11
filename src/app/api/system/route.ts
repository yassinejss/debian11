import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getUserSandboxInfo } from "@/lib/sandbox";
import { getOrCreateUserSandbox } from "@/lib/sandbox";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;

  try {
    const entry = await getOrCreateUserSandbox(session!.userId);
    const sandbox = entry.sandbox;

    // Run system info commands
    const [cpuR, memR, diskR, uptimeR, procR] = await Promise.all([
      sandbox.runCommand({ cmd: "bash", args: ["-c", "top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | tr -d '%us,' 2>/dev/null || echo 0"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "free -b | awk 'NR==2{printf \"%s %s %s\", $2,$3,$4}' 2>/dev/null || echo '0 0 0'"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "df -B1 /root 2>/dev/null | awk 'NR==2{printf \"%s %s %s\",$2,$3,$4}' || df -B1 / | awk 'NR==2{printf \"%s %s %s\",$2,$3,$4}'"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "cat /proc/uptime | awk '{print $1}' 2>/dev/null || echo 0"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "ps aux --no-headers 2>/dev/null | wc -l || echo 0"] }),
    ]);

    const cpuUsage = parseFloat((await cpuR.stdout()).trim()) || 0;
    const memParts = (await memR.stdout()).trim().split(" ").map(Number);
    const diskParts = (await diskR.stdout()).trim().split(" ").map(Number);
    const uptimeSeconds = parseFloat((await uptimeR.stdout()).trim()) || 0;
    const processCount = parseInt((await procR.stdout()).trim()) || 0;

    const info = await getUserSandboxInfo(session!.userId);

    return NextResponse.json({
      sandbox: info,
      system: {
        cpu: { usage: cpuUsage },
        memory: { total: memParts[0] || 0, used: memParts[1] || 0, free: memParts[2] || 0 },
        disk: { total: diskParts[0] || 0, used: diskParts[1] || 0, free: diskParts[2] || 0 },
        uptime: uptimeSeconds,
        processCount,
        platform: "Debian GNU/Linux 11 (Bullseye)",
        kernel: "linux",
      },
    });
  } catch (err) {
    const info = await getUserSandboxInfo(session!.userId);
    return NextResponse.json({ sandbox: info, system: null, error: "Could not read system metrics" });
  }
}
