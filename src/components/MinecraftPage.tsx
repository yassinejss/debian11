"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface ServerStatus {
  running: boolean; starting: boolean; pid?: number;
  uptime?: number; version?: string; players?: string; maxPlayers?: number;
  error?: string;
}

function timeAgo(secs: number) {
  if (!secs) return "—";
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = Math.floor(secs % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function MinecraftPage() {
  const [status, setStatus] = useState<ServerStatus>({ running: false, starting: false });
  const [logs, setLogs] = useState<string[]>([]);
  const [cmd, setCmd] = useState("");
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok" | "err" });
  const [tab, setTab] = useState<"console" | "config" | "setup">("console");
  const logsRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const r = await fetch("/api/minecraft", { credentials: "include" });
      if (r.ok) {
        const d = await r.json();
        setStatus(d.status);
        if (d.logs) setLogs(d.logs);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadStatus();
    pollRef.current = setInterval(loadStatus, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadStatus]);

  useEffect(() => {
    if (logsRef.current) logsRef.current.scrollTop = logsRef.current.scrollHeight;
  }, [logs]);

  const control = async (action: string, extra: object = {}) => {
    setMsg({ text: "", type: "ok" });
    const r = await fetch("/api/minecraft", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action, ...extra }),
    });
    const d = await r.json();
    if (r.ok) { setMsg({ text: d.message || "Done", type: "ok" }); loadStatus(); }
    else setMsg({ text: d.error || "Error", type: "err" });
  };

  const sendCmd = async () => {
    if (!cmd.trim()) return;
    await control("command", { command: cmd.trim() });
    setCmd("");
  };

  const logColor = (line: string) => {
    if (line.includes("[ERROR]") || line.includes("WARN]") && line.includes("ERROR")) return "var(--red)";
    if (line.includes("[WARN]")) return "var(--yellow)";
    if (line.includes("joined the game") || line.includes("logged in")) return "var(--green)";
    if (line.includes("left the game")) return "var(--yellow)";
    if (line.includes("[INFO]")) return "var(--text-1)";
    return "var(--text-2)";
  };

  const Tab = ({ id, label }: { id: typeof tab; label: string }) => (
    <button onClick={() => setTab(id)} style={{
      background: tab === id ? "var(--surface-4)" : "transparent",
      border: "1px solid " + (tab === id ? "var(--border-1)" : "transparent"),
      color: tab === id ? "var(--text-0)" : "var(--text-2)",
      borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 12, cursor: "pointer",
    }}>{label}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 22 }}>⛏</span> Minecraft Manager
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Manage your Minecraft server on Debian 11</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {!status.running && !status.starting && (
            <button className="btn btn-success btn-sm" onClick={() => control("start")}>▶ Start Server</button>
          )}
          {status.starting && (
            <button className="btn btn-sm" style={{ background: "var(--yellow-bg)", color: "var(--yellow)", border: "1px solid var(--yellow-border)" }} disabled>
              <span style={{ display: "inline-block", width: 10, height: 10, border: "2px solid currentColor", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              Starting…
            </button>
          )}
          {status.running && (
            <>
              <button className="btn btn-sm" style={{ background: "var(--yellow-bg)", color: "var(--yellow)", border: "1px solid var(--yellow-border)" }} onClick={() => control("restart")}>↺ Restart</button>
              <button className="btn btn-danger btn-sm" onClick={() => { if (confirm("Stop the Minecraft server?")) control("stop"); }}>⏹ Stop</button>
            </>
          )}
          <button onClick={loadStatus} className="btn btn-ghost btn-sm">↺</button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "ok" ? "alert-green" : "alert-red"}`} style={{ marginBottom: 16, flexShrink: 0 }}>
          {msg.type === "ok" ? "✓" : "⚠"} {msg.text}
        </div>
      )}

      {/* Status cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 12, marginBottom: 20, flexShrink: 0 }}>
        {[
          { label: "Status", value: status.starting ? "Starting…" : status.running ? "Online" : "Offline", color: status.running ? "var(--green)" : status.starting ? "var(--yellow)" : "var(--red)" },
          { label: "Version", value: status.version || "—", color: "var(--text-0)" },
          { label: "Players", value: status.players !== undefined ? `${status.players}/${status.maxPlayers ?? "?"}` : "—", color: "var(--text-0)" },
          { label: "Uptime", value: status.uptime ? timeAgo(status.uptime) : "—", color: "var(--text-0)" },
          { label: "PID", value: status.pid ? String(status.pid) : "—", color: "var(--text-0)" },
        ].map(card => (
          <div key={card.label} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{card.label}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: card.color }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12, flexShrink: 0 }}>
        <Tab id="console" label="Console" />
        <Tab id="config" label="Quick Config" />
        <Tab id="setup" label="Setup Guide" />
      </div>

      {/* Console tab */}
      {tab === "console" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div ref={logsRef} style={{
            flex: 1, overflow: "auto", background: "var(--term-bg)", borderRadius: "var(--r-md)",
            padding: 12, fontFamily: "var(--font-mono)", fontSize: 12, lineHeight: 1.5,
            border: "1px solid var(--border-0)",
          }}>
            {logs.length === 0 ? (
              <span style={{ color: "var(--text-3)" }}>
                {status.running ? "Waiting for log output…" : "Server is not running. Start it to see output."}
              </span>
            ) : logs.map((line, i) => (
              <div key={i} style={{ color: logColor(line), marginBottom: 1 }}>{line}</div>
            ))}
          </div>
          {status.running && (
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexShrink: 0 }}>
              <span style={{ display: "flex", alignItems: "center", color: "var(--text-2)", fontSize: 13, flexShrink: 0 }}>&gt;</span>
              <input className="input" value={cmd} onChange={e => setCmd(e.target.value)} placeholder="Enter Minecraft command (without /)" style={{ fontFamily: "var(--font-mono)" }}
                onKeyDown={e => { if (e.key === "Enter") sendCmd(); }} />
              <button className="btn btn-primary btn-sm" onClick={sendCmd}>Send</button>
            </div>
          )}
        </div>
      )}

      {/* Config tab */}
      {tab === "config" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          <div className="alert alert-blue" style={{ marginBottom: 16, fontSize: 12 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            To edit server.properties, use the File Manager at /root/server/server.properties or use the terminal.
          </div>
          <div className="card" style={{ padding: 16 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>Common Commands</div>
            {[
              { cmd: "op <player>", desc: "Give operator status" },
              { cmd: "deop <player>", desc: "Remove operator status" },
              { cmd: "whitelist add <player>", desc: "Add to whitelist" },
              { cmd: "whitelist remove <player>", desc: "Remove from whitelist" },
              { cmd: "kick <player> [reason]", desc: "Kick a player" },
              { cmd: "ban <player> [reason]", desc: "Ban a player" },
              { cmd: "pardon <player>", desc: "Unban a player" },
              { cmd: "save-all", desc: "Save the world now" },
              { cmd: "time set day", desc: "Set time to day" },
              { cmd: "weather clear", desc: "Clear weather" },
              { cmd: "difficulty <level>", desc: "Set difficulty (peaceful/easy/normal/hard)" },
            ].map(({ cmd: c, desc }) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 12, padding: "7px 0", borderBottom: "1px solid var(--border-0)" }}>
                <code style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--brand-light)", minWidth: 220 }}>{c}</code>
                <span style={{ fontSize: 12, color: "var(--text-2)" }}>{desc}</span>
                {status.running && (
                  <button className="btn btn-ghost btn-sm" style={{ marginLeft: "auto", fontSize: 11 }}
                    onClick={() => { setCmd(c.replace("<player>", "").replace("[reason]", "").replace("<level>", "normal").trim()); setTab("console"); }}>
                    Use ↗
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Setup tab */}
      {tab === "setup" && (
        <div style={{ flex: 1, overflow: "auto" }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Setup Guide — Paper/Spigot on Debian 11</span></div>
            <div className="card-body">
              <div className="alert alert-yellow" style={{ marginBottom: 16, fontSize: 12 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Minecraft requires a tunnel (Cloudflared or Playit.gg) for players to connect — Vercel Sandbox does not support inbound TCP. Players connect through the tunnel URL, not an IP.
              </div>
              {[
                { title: "1. Install Java 17", cmd: "apt-get update && apt-get install -y openjdk-17-jre-headless" },
                { title: "2. Create server directory", cmd: "mkdir -p /root/server && cd /root/server" },
                { title: "3. Download Paper (1.21)", cmd: "cd /root/server && curl -o server.jar 'https://api.papermc.io/v2/projects/paper/versions/1.21.1/builds/68/downloads/paper-1.21.1-68.jar'" },
                { title: "4. Accept EULA", cmd: "cd /root/server && echo 'eula=true' > eula.txt" },
                { title: "5. First run (generates config)", cmd: "cd /root/server && java -Xmx1G -Xms512M -jar server.jar nogui" },
                { title: "6. Register as managed process", desc: "In Processes tab: command = java -Xmx1G -Xms512M -jar /root/server/server.jar nogui, dir = /root/server, restart = on-failure" },
                { title: "7. Set up tunnel", desc: "Install Cloudflared or Playit.gg (see Network tab). Players will connect via tunnel URL on port 25565." },
              ].map((step, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-0)", marginBottom: 6 }}>{step.title}</div>
                  {step.cmd && <code style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-1)", background: "var(--surface-3)", padding: "8px 12px", borderRadius: "var(--r-sm)", wordBreak: "break-all", lineHeight: 1.6 }}>{step.cmd}</code>}
                  {step.desc && <p style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>{step.desc}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
