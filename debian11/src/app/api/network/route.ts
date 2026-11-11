import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getOrCreateUserSandbox } from "@/lib/sandbox";

export async function GET(req: NextRequest) {
  const { session, error } = await requireAuth(req);
  if (error) return error;

  try {
    const { sandbox } = await getOrCreateUserSandbox(session!.userId);

    const [ifaceR, publicR, listenR, dnsR] = await Promise.all([
      sandbox.runCommand({ cmd: "bash", args: ["-c", "ip -4 addr show 2>/dev/null | grep -E 'inet ' | awk '{print $NF\": \"$2}' | head -10 || echo 'unavailable'"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "curl -sf --max-time 5 https://api.ipify.org 2>/dev/null || echo 'unavailable'"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "ss -tlnp 2>/dev/null | tail -n +2 | awk '{print $1,\": \",$4}' | head -20 || echo 'unavailable'"] }),
      sandbox.runCommand({ cmd: "bash", args: ["-c", "cat /etc/resolv.conf 2>/dev/null | grep nameserver | awk '{print $2}' || echo 'unavailable'"] }),
    ]);

    const interfaces = (await ifaceR.stdout()).trim().split("\n").filter(Boolean);
    const publicIp = (await publicR.stdout()).trim();
    const listening = (await listenR.stdout()).trim().split("\n").filter(Boolean);
    const dns = (await dnsR.stdout()).trim().split("\n").filter(Boolean);

    return NextResponse.json({
      interfaces,
      publicIp: publicIp === "unavailable" ? null : publicIp,
      listeningPorts: listening,
      dns,
      note: "Public IP shown is outbound NAT IP from Vercel Sandbox. Inbound TCP connections are not supported on Vercel Hobby — use Cloudflared or Playit for tunneling.",
    });
  } catch (err) {
    return NextResponse.json({ error: "Could not read network info", interfaces: [], publicIp: null, listeningPorts: [], dns: [] });
  }
}
