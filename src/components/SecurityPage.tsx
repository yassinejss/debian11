"use client";
import { useState, useEffect, useCallback } from "react";

interface AuditLog { id: string; userId: string; action: string; resource?: string; details?: string; ipAddress?: string; createdAt: number; }
interface LoginAttempt { id: string; username: string; success: number; ipAddress: string; createdAt: number; }

function fmt(ts: number) { return new Date(ts * 1000).toLocaleString(); }
function ago(ts: number) { const s = Math.floor(Date.now()/1000)-ts; if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; return`${Math.floor(s/3600)}h ago`; }

export default function SecurityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [attempts, setAttempts] = useState<LoginAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"audit" | "logins">("audit");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/supervisor", { credentials: "include" });
      // Also load audit logs
      const auditR = await fetch("/api/security/logs", { credentials: "include" });
      if (auditR.ok) {
        const d = await auditR.json();
        setLogs(d.auditLogs ?? []);
        setAttempts(d.loginAttempts ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const Tab = ({ id, label }: { id: typeof tab; label: string }) => (
    <button onClick={() => setTab(id)} style={{ background: tab === id ? "var(--surface-4)" : "transparent", border: "1px solid " + (tab === id ? "var(--border-1)" : "transparent"), color: tab === id ? "var(--text-0)" : "var(--text-2)", borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{label}</button>
  );

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)" }}>Security & Audit</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Authentication events and audit trail</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">↺ Refresh</button>
      </div>

      {/* Security overview */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Login Attempts", value: attempts.length, color: "var(--text-0)" },
          { label: "Failed Logins", value: attempts.filter(a => !a.success).length, color: attempts.filter(a=>!a.success).length > 5 ? "var(--red)" : "var(--text-0)" },
          { label: "Audit Events", value: logs.length, color: "var(--text-0)" },
          { label: "Session", value: "Active", color: "var(--green)" },
        ].map(c => (
          <div key={c.label} className="card" style={{ padding: 14 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 6 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        <Tab id="audit" label={`Audit Log (${logs.length})`} />
        <Tab id="logins" label={`Login Attempts (${attempts.length})`} />
      </div>

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shimmer-box" style={{ height: 44 }} />)}</div>
      ) : (
        <div className="card">
          {tab === "audit" && (
            logs.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-2)" }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>🔒</div>
                <p>No audit events yet. Activity will appear here as you use the terminal.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Time</th><th>Action</th><th>Details</th><th>IP</th></tr></thead>
                <tbody>
                  {logs.slice(0, 100).map(log => (
                    <tr key={log.id}>
                      <td style={{ fontSize: 11, color: "var(--text-2)", whiteSpace: "nowrap" }}>{ago(log.createdAt)}</td>
                      <td><span className="badge badge-muted" style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}>{log.action}</span></td>
                      <td style={{ fontSize: 12, color: "var(--text-1)" }}>{log.details || log.resource || "—"}</td>
                      <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>{log.ipAddress || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {tab === "logins" && (
            attempts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-2)" }}>
                <p>No login attempts recorded yet.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Time</th><th>Username</th><th>Result</th><th>IP</th></tr></thead>
                <tbody>
                  {attempts.slice(0, 100).map(a => (
                    <tr key={a.id}>
                      <td style={{ fontSize: 11, color: "var(--text-2)" }}>{ago(a.createdAt)}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{a.username}</td>
                      <td><span className={`badge ${a.success ? "badge-green" : "badge-red"}`}>{a.success ? "Success" : "Failed"}</span></td>
                      <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>{a.ipAddress}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
        </div>
      )}
    </div>
  );
}
