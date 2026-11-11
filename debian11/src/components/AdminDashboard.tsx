"use client";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User { id: string; username: string; email: string | null; isActive: boolean; isAdmin: boolean; createdAt: number; lastLoginAt: number | null; sandboxStatus: string; lastHeartbeatAt: number | null; processCount: number; }

function ago(ts: number | null) { if(!ts)return"—"; const s=Math.floor(Date.now()/1000)-ts; if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; }

type Tab = "users" | "create" | "supervisor";

export default function AdminDashboard({ username }: { username: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [beats, setBeats] = useState<{ ranAt: number; action: string; durationMs: number | null; error: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok"|"err" });
  const [newU, setNewU] = useState(""); const [newP, setNewP] = useState(""); const [newE, setNewE] = useState(""); const [newA, setNewA] = useState(false); const [creating, setCreating] = useState(false);

  const setErr = (t: string) => setMsg({ text: t, type: "err" });
  const setOk = (t: string) => setMsg({ text: t, type: "ok" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/admin/users", { credentials: "include" }); if(r.status===401){router.push("/login");return;} if(r.status===403){router.push("/dashboard/terminal");return;} const d = await r.json(); setUsers(d.users ?? []); }
    finally { setLoading(false); }
  }, [router]);

  const loadSupervisor = useCallback(async () => {
    setLoading(true);
    try { const r = await fetch("/api/admin/supervisor", { credentials: "include" }); const d = await r.json(); setBeats(d.heartbeats ?? []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { setMsg({ text: "", type: "ok" }); if(tab==="supervisor") loadSupervisor(); else loadUsers(); }, [tab, loadUsers, loadSupervisor]);

  const patchUser = async (id: string, body: object, ok: string) => {
    const r = await fetch(`/api/admin/user/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
    const d = await r.json();
    if (r.ok) { setOk(ok); loadUsers(); } else setErr(d.error || "Failed");
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete "${u.username}" and all data?`)) return;
    const r = await fetch(`/api/admin/user/${u.id}`, { method: "DELETE", credentials: "include" });
    if (r.ok) { setOk(`Deleted ${u.username}`); loadUsers(); } else setErr("Failed");
  };

  const resetPw = async (u: User) => {
    const pw = prompt(`New password for "${u.username}" (min 8 chars):`);
    if (!pw || pw.length < 8) { alert("Password must be ≥8 chars"); return; }
    await patchUser(u.id, { newPassword: pw }, `Password reset for ${u.username}`);
  };

  const createUser = async () => {
    if (!newU || !newP) { setErr("Username and password required"); return; }
    setCreating(true);
    try {
      const r = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username: newU, password: newP, email: newE || undefined, isAdmin: newA }) });
      const d = await r.json();
      if (r.ok) { setOk(`Created "${d.username}"`); setNewU(""); setNewP(""); setNewE(""); setNewA(false); setTab("users"); }
      else setErr(d.error || "Failed");
    } finally { setCreating(false); }
  };

  const TabBtn = ({ id, label }: { id: Tab; label: string }) => (
    <button onClick={() => setTab(id)} style={{ background: tab===id ? "var(--surface-4)" : "transparent", border: "1px solid "+(tab===id ? "var(--border-1)" : "transparent"), color: tab===id ? "var(--text-0)" : "var(--text-2)", borderRadius: "var(--r-sm)", padding: "5px 12px", fontSize: 12, cursor: "pointer" }}>{label}</button>
  );

  const statusColor = (s: string) => s==="running" ? "var(--green)" : s==="starting" ? "var(--yellow)" : "var(--text-3)";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--surface-0)", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 52, background: "var(--surface-1)", borderBottom: "1px solid var(--border-0)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-0)" }}>Admin Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <span className="badge badge-brand">{username}</span>
          <button className="btn btn-secondary btn-sm" onClick={() => router.push("/dashboard/terminal")}>← Terminal</button>
          <button className="btn btn-ghost btn-sm" onClick={async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); router.push("/login"); }}>Logout</button>
        </div>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 24 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 20 }}>
          <TabBtn id="users" label={`Users (${users.length})`} />
          <TabBtn id="create" label="+ Create User" />
          <TabBtn id="supervisor" label="Supervisor" />
        </div>

        {msg.text && <div className={`alert ${msg.type === "ok" ? "alert-green" : "alert-red"}`} style={{ marginBottom: 16 }}>{msg.type === "ok" ? "✓" : "⚠"} {msg.text}</div>}

        {tab === "users" && (
          <>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
              <button onClick={loadUsers} className="btn btn-secondary btn-sm">↺ Refresh</button>
            </div>
            <div className="card">
              {loading ? (
                <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>{[1,2,3].map(i => <div key={i} className="shimmer-box" style={{ height: 44 }} />)}</div>
              ) : (
                <table className="data-table">
                  <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Sandbox</th><th>Last Login</th><th>Processes</th><th>Actions</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg,#7c3aed,#22d3ee)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "white", flexShrink: 0 }}>{u.username[0]?.toUpperCase()}</div>
                            <div><div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-0)" }}>{u.username}</div>{u.email && <div style={{ fontSize: 11, color: "var(--text-3)" }}>{u.email}</div>}</div>
                          </div>
                        </td>
                        <td><span className={`badge ${u.isAdmin ? "badge-brand" : "badge-muted"}`}>{u.isAdmin ? "Admin" : "User"}</span></td>
                        <td><span className={`badge ${u.isActive ? "badge-green" : "badge-red"}`}>{u.isActive ? "Active" : "Disabled"}</span></td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor(u.sandboxStatus) }} /><span style={{ fontSize: 12 }}>{u.sandboxStatus}</span></div>
                          {u.lastHeartbeatAt && <div style={{ fontSize: 10, color: "var(--text-3)" }}>♥ {ago(u.lastHeartbeatAt)}</div>}
                        </td>
                        <td style={{ fontSize: 12, color: "var(--text-2)" }}>{ago(u.lastLoginAt)}</td>
                        <td><span className="badge badge-muted">{u.processCount}</span></td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button className={`btn btn-sm ${u.isActive ? "btn-secondary" : "btn-success"}`} onClick={() => patchUser(u.id, { isActive: !u.isActive }, `${u.isActive?"Disabled":"Enabled"} ${u.username}`)}>{u.isActive ? "Disable" : "Enable"}</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => patchUser(u.id, { isAdmin: !u.isAdmin }, `Updated ${u.username}`)}>{u.isAdmin ? "Demote" : "Promote"}</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => resetPw(u)}>Reset Pw</button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteUser(u)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}

        {tab === "create" && (
          <div style={{ maxWidth: 480 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">Create New User</span></div>
              <div className="card-body">
                {[{ label: "Username *", val: newU, set: setNewU, type: "text", ph: "letters, numbers, _ and -" }, { label: "Password *", val: newP, set: setNewP, type: "password", ph: "Min 8 characters" }, { label: "Email (optional)", val: newE, set: setNewE, type: "email", ph: "user@example.com" }].map(f => (
                  <div key={f.label} className="form-group">
                    <label className="form-label">{f.label}</label>
                    <input className="input" type={f.type} value={f.val} onChange={e => f.set(e.target.value)} placeholder={f.ph} />
                  </div>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-1)", cursor: "pointer", marginBottom: 16 }}>
                  <input type="checkbox" checked={newA} onChange={e => setNewA(e.target.checked)} style={{ accentColor: "var(--brand)" }} />
                  Grant administrator role
                </label>
                <button className="btn btn-primary" onClick={createUser} disabled={creating}>{creating ? "Creating…" : "Create User"}</button>
              </div>
            </div>
          </div>
        )}

        {tab === "supervisor" && (
          <>
            <div className="alert alert-blue" style={{ marginBottom: 16, fontSize: 12 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <div>
                <strong>Scheduler:</strong> cron-job.org → POST {typeof window !== "undefined" ? window.location.origin : "https://your-app.vercel.app"}/api/internal/supervisor · Every 10 min · Header: Authorization: Bearer &lt;SUPERVISOR_SECRET&gt;
              </div>
            </div>
            <div className="card">
              <table className="data-table">
                <thead><tr><th>Time</th><th>Action</th><th>Duration</th><th>Error</th></tr></thead>
                <tbody>
                  {beats.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", color: "var(--text-2)", padding: "32px 0" }}>No supervisor runs recorded. Configure cron-job.org to call this endpoint.</td></tr>
                  ) : beats.map((b, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: 12 }}>{new Date(b.ranAt * 1000).toLocaleString()}</td>
                      <td><span className={`badge ${b.action === "check" || b.action === "heartbeat" ? "badge-green" : b.action === "skip" ? "badge-yellow" : "badge-red"}`}>{b.action}</span></td>
                      <td style={{ fontSize: 12 }}>{b.durationMs ? `${b.durationMs}ms` : "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--red)" }}>{b.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
