"use client";
import { useState, useEffect, useCallback } from "react";

interface Process {
  id: string; name: string; command: string; workingDir: string;
  restartPolicy: string; status: string; pid?: number;
  failureCount: number; maxFailures: number; lastError?: string;
  isInteractive: boolean; createdAt: number; lastStartedAt?: number;
}

const PRESETS = [
  { label: "Discord Bot (Python)", command: "python3 /root/bot.py", dir: "/root", icon: "🤖" },
  { label: "Node.js App", command: "node /root/app/index.js", dir: "/root/app", icon: "🟢" },
  { label: "Python Script", command: "python3 /root/script.py", dir: "/root", icon: "🐍" },
  { label: "Cloudflared", command: "cloudflared tunnel run", dir: "/root", icon: "☁️" },
  { label: "Playit.gg", command: "/root/playit-linux-amd64", dir: "/root", icon: "🎮" },
  { label: "Custom Command", command: "", dir: "/root", icon: "⚡" },
];

function statusBadgeClass(s: string) {
  if (s === "running") return "badge badge-green";
  if (s === "failed") return "badge badge-red";
  if (s === "starting") return "badge badge-yellow";
  return "badge badge-muted";
}

function timeAgo(ts?: number) {
  if (!ts) return "—";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ProcessManager() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok" | "err" });
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState(""); const [cmd, setCmd] = useState("");
  const [dir, setDir] = useState("/root"); const [policy, setPolicy] = useState("on-failure");
  const [maxF, setMaxF] = useState(5); const [autoStart, setAutoStart] = useState(true);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState(-1);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/processes", { credentials: "include" });
      const d = await r.json();
      setProcesses(d.processes ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); const i = setInterval(load, 10000); return () => clearInterval(i); }, [load]);

  const action = async (id: string, act: string) => {
    const r = await fetch(`/api/processes/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ action: act }) });
    const d = await r.json();
    setMsg(r.ok ? { text: `${act.charAt(0).toUpperCase() + act.slice(1)}ed`, type: "ok" } : { text: d.error || "Error", type: "err" });
    load();
  };

  const addProcess = async () => {
    if (!name || !cmd) { setMsg({ text: "Name and command required", type: "err" }); return; }
    setAdding(true);
    try {
      const r = await fetch("/api/processes", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name, command: cmd, workingDir: dir, restartPolicy: policy, maxFailures: maxF, autoStart }) });
      const d = await r.json();
      if (r.ok) { setMsg({ text: `"${name}" registered`, type: "ok" }); setName(""); setCmd(""); setShowAdd(false); load(); }
      else setMsg({ text: d.error || "Error", type: "err" });
    } finally { setAdding(false); }
  };

  const applyPreset = (i: number) => {
    setPreset(i);
    const p = PRESETS[i];
    if (p) { setCmd(p.command); setDir(p.dir); if (!name) setName(p.label); }
  };

  const running = processes.filter(p => p.status === "running").length;

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)" }}>Process Manager</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>
            Background services that survive sandbox recovery · {running} running
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={load} className="btn btn-secondary btn-sm">↺ Refresh</button>
          <button onClick={() => setShowAdd(!showAdd)} className="btn btn-primary btn-sm">
            {showAdd ? "✕ Cancel" : "+ Register Process"}
          </button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "ok" ? "alert-green" : "alert-red"}`} style={{ marginBottom: 16 }}>
          {msg.type === "ok" ? "✓" : "⚠"} {msg.text}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div className="card" style={{ marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
          <div className="card-header">
            <span className="card-title">Register Background Process</span>
          </div>
          <div className="card-body">
            {/* Presets */}
            <div style={{ marginBottom: 16 }}>
              <div className="form-label" style={{ marginBottom: 8 }}>Quick presets</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {PRESETS.map((p, i) => (
                  <button key={i} onClick={() => applyPreset(i)}
                    className={`btn btn-sm ${preset === i ? "btn-primary" : "btn-secondary"}`}>
                    {p.icon} {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Process name *</label>
                <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Discord Bot" />
              </div>
              <div className="form-group">
                <label className="form-label">Working directory</label>
                <input className="input" value={dir} onChange={e => setDir(e.target.value)} placeholder="/root" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Start command *</label>
              <input className="input" value={cmd} onChange={e => setCmd(e.target.value)} placeholder="python3 /root/bot.py" style={{ fontFamily: "var(--font-mono)", fontSize: 12 }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">Restart policy</label>
                <select className="input" value={policy} onChange={e => setPolicy(e.target.value)}>
                  <option value="on-failure">on-failure</option>
                  <option value="always">always</option>
                  <option value="never">never</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Max failures</label>
                <input className="input" type="number" min={1} max={20} value={maxF} onChange={e => setMaxF(Number(e.target.value))} />
              </div>
              <div className="form-group" style={{ justifyContent: "flex-end" }}>
                <label className="form-label">&nbsp;</label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-1)", cursor: "pointer", height: 34 }}>
                  <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} style={{ accentColor: "var(--brand)", width: 14, height: 14 }} />
                  Start immediately
                </label>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button className="btn btn-primary" onClick={addProcess} disabled={adding}>
                {adding ? "Registering…" : "Register Process"}
              </button>
              <button className="btn btn-secondary" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
            <div className="alert alert-blue" style={{ marginTop: 12, fontSize: 12 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Processes with restart policy are automatically restarted by the supervisor every 10 minutes, even when no one is on the site. Max downtime after a 45-min Sandbox session: ~10 minutes.
            </div>
          </div>
        </div>
      )}

      {/* Process list */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1,2,3].map(i => <div key={i} className="shimmer-box" style={{ height: 80 }} />)}
        </div>
      ) : processes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-2)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚙</div>
          <p style={{ fontWeight: 500, fontSize: 14, color: "var(--text-1)" }}>No processes registered</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Register a background service above to keep it running 24/7</p>
        </div>
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Command</th><th>Status</th><th>Restart</th><th>Failures</th><th>Last Start</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {processes.map(p => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "var(--text-0)", fontSize: 13 }}>{p.name}</div>
                    <div style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "var(--font-mono)" }}>{p.workingDir}</div>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: 12, maxWidth: 220 }}>
                    <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={p.command}>
                      {p.command}
                    </span>
                    {p.lastError && <span style={{ color: "var(--red)", fontSize: 11, display: "block", marginTop: 2 }}>{p.lastError.slice(0, 50)}</span>}
                  </td>
                  <td><span className={statusBadgeClass(p.status)}>{p.status}{p.pid ? ` · ${p.pid}` : ""}</span></td>
                  <td><span className="badge badge-muted">{p.restartPolicy}</span></td>
                  <td style={{ fontSize: 12 }}>
                    <span style={{ color: p.failureCount >= p.maxFailures ? "var(--red)" : "var(--text-2)" }}>
                      {p.failureCount}/{p.maxFailures}
                    </span>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{timeAgo(p.lastStartedAt)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {p.status !== "running" && !p.isInteractive && (
                        <button className="btn btn-success btn-sm" onClick={() => action(p.id, "start")}>▶</button>
                      )}
                      {p.status === "running" && (
                        <button className="btn btn-sm" style={{ background: "var(--yellow-bg)", color: "var(--yellow)", border: "1px solid var(--yellow-border)" }} onClick={() => action(p.id, "stop")}>⏹</button>
                      )}
                      <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${p.name}"?`)) action(p.id, "delete"); }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 20, padding: 14, background: "var(--surface-2)", border: "1px solid var(--border-0)", borderRadius: "var(--r-md)", fontSize: 12, color: "var(--text-2)", lineHeight: 1.7 }}>
        <strong style={{ color: "var(--text-1)" }}>Recovery architecture:</strong> The external supervisor (cron-job.org, every 10 min) calls <code style={{ fontFamily: "var(--font-mono)", background: "var(--surface-3)", padding: "1px 4px", borderRadius: 3 }}>/api/internal/supervisor</code> with your <code style={{ fontFamily: "var(--font-mono)", background: "var(--surface-3)", padding: "1px 4px", borderRadius: 3 }}>SUPERVISOR_SECRET</code>. It resumes expired sandboxes and restarts all eligible processes — even when no one is visiting the website.
      </div>
    </div>
  );
}
