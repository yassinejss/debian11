"use client";
import { useState, useEffect, useCallback } from "react";

function fmt(bytes: number) {
  if (!bytes) return "0 B";
  const k = 1024; const sizes = ["B","KB","MB","GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k,i)).toFixed(1)} ${sizes[i]}`;
}
function fmtUptime(s: number) {
  const d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60);
  const parts = []; if(d)parts.push(`${d}d`); if(h)parts.push(`${h}h`); if(m)parts.push(`${m}m`);
  return parts.join(" ") || "<1m";
}

function MeterBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="progress-bar" style={{ height: 6 }}>
      <div className="progress-fill" style={{ width: `${Math.min(100,pct).toFixed(1)}%`, background: color }} />
    </div>
  );
}

function StatCard({ label, value, sub, pct, color }: { label: string; value: string; sub?: string; pct?: number; color?: string }) {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-0)", marginBottom: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "var(--text-2)", marginBottom: pct !== undefined ? 8 : 0 }}>{sub}</div>}
      {pct !== undefined && color && <MeterBar pct={pct} color={color} />}
    </div>
  );
}

export default function SystemMonitor() {
  const [data, setData] = useState<{ sandbox: { status: string; lastHeartbeatAt?: number }; system: { cpu: { usage: number }; memory: { total: number; used: number; free: number }; disk: { total: number; used: number; free: number }; uptime: number; processCount: number; platform: string } | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/system", { credentials: "include" });
      if (r.ok) { setData(await r.json()); setLastUpdated(new Date()); }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 15000); return () => clearInterval(i); }, [load]);

  if (loading) {
    return (
      <div style={{ padding: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16 }}>
          {[1,2,3,4,5,6].map(i => <div key={i} className="shimmer-box" style={{ height: 100 }} />)}
        </div>
      </div>
    );
  }

  const sys = data?.system;
  const sb = data?.sandbox;
  const memPct = sys ? (sys.memory.used / sys.memory.total) * 100 : 0;
  const diskPct = sys ? (sys.disk.used / sys.disk.total) * 100 : 0;
  const cpuColor = sys && sys.cpu.usage > 80 ? "var(--red)" : sys && sys.cpu.usage > 50 ? "var(--yellow)" : "var(--green)";
  const memColor = memPct > 80 ? "var(--red)" : memPct > 60 ? "var(--yellow)" : "var(--green)";
  const diskColor = diskPct > 85 ? "var(--red)" : diskPct > 65 ? "var(--yellow)" : "var(--green)";

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)" }}>System Monitor</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Real-time Debian sandbox metrics</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {lastUpdated && <span style={{ fontSize: 11, color: "var(--text-3)" }}>Updated {lastUpdated.toLocaleTimeString()}</span>}
          <button onClick={load} className="btn btn-secondary btn-sm">↺ Refresh</button>
        </div>
      </div>

      {/* Sandbox status banner */}
      <div className={`alert ${sb?.status === "running" ? "alert-green" : "alert-yellow"}`} style={{ marginBottom: 20 }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: sb?.status === "running" ? "var(--green)" : "var(--yellow)", flexShrink: 0,
          boxShadow: sb?.status === "running" ? "0 0 6px var(--green)" : "none",
          animation: sb?.status !== "running" ? "pulse 1.2s ease-in-out infinite" : "none" }} />
        Sandbox: <strong>{sb?.status ?? "unknown"}</strong>
        {sb?.lastHeartbeatAt && ` · Last heartbeat: ${new Date(sb.lastHeartbeatAt * 1000).toLocaleTimeString()}`}
        <span style={{ marginLeft: "auto", fontSize: 11 }}>Vercel Hobby · 45 min session limit · Auto-recovered by supervisor</span>
      </div>

      {!sys ? (
        <div className="alert alert-yellow">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Could not read system metrics — sandbox may be starting up. Metrics will appear once the sandbox is running.
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: 16, marginBottom: 20 }}>
            <StatCard label="CPU Usage" value={`${sys.cpu.usage.toFixed(1)}%`} pct={sys.cpu.usage} color={cpuColor} />
            <StatCard label="Memory" value={fmt(sys.memory.used)} sub={`of ${fmt(sys.memory.total)} total · ${memPct.toFixed(0)}%`} pct={memPct} color={memColor} />
            <StatCard label="Disk (root)" value={fmt(sys.disk.used)} sub={`of ${fmt(sys.disk.total)} total · ${diskPct.toFixed(0)}%`} pct={diskPct} color={diskColor} />
            <StatCard label="Uptime" value={fmtUptime(sys.uptime)} sub="Since last sandbox start" />
            <StatCard label="Processes" value={String(sys.processCount)} sub="Active system processes" />
            <StatCard label="Platform" value="Debian 11" sub={sys.platform} />
          </div>
          <div style={{ padding: 14, background: "var(--surface-2)", border: "1px solid var(--border-0)", borderRadius: "var(--r-md)", fontSize: 12, color: "var(--text-2)" }}>
            <strong style={{ color: "var(--text-1)" }}>Note:</strong> CPU usage shown is at snapshot time (top -bn1). Memory is from /proc/meminfo. Disk is from df. All metrics reflect the actual Vercel Sandbox container state.
          </div>
        </>
      )}
    </div>
  );
}
