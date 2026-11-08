"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
  email: string | null;
  isActive: boolean;
  isAdmin: boolean;
  createdAt: number;
  lastLoginAt: number | null;
  sandboxStatus: string;
  lastHeartbeatAt: number | null;
  processCount: number;
}

interface HeartbeatRow {
  id: string;
  ranAt: number;
  action: string;
  durationMs: number | null;
  error: string | null;
}

interface RecoveryEvent {
  id: string;
  username: string | null;
  sandboxName: string;
  trigger: string;
  startedAt: number;
  success: boolean;
  processesRestarted: number;
  error: string | null;
}

interface Props { username: string; }
type Tab = "users" | "create" | "supervisor";

function fmt(ts: number | null) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString();
}
function ago(ts: number | null) {
  if (!ts) return "never";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function StatusDot({ status }: { status: string }) {
  const c = status === "running" ? "var(--success)" : status === "starting" ? "var(--warning)" : "var(--text-muted)";
  return <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: c, marginRight: 5, boxShadow: status === "running" ? `0 0 5px ${c}` : "none" }} />;
}

export default function AdminDashboard({ username }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [beats, setBeats] = useState<HeartbeatRow[]>([]);
  const [events, setEvents] = useState<RecoveryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok" | "err" });

  // Create form
  const [newU, setNewU] = useState(""); const [newP, setNewP] = useState("");
  const [newE, setNewE] = useState(""); const [newA, setNewA] = useState(false);
  const [creating, setCreating] = useState(false);

  const setErr = (t: string) => setMsg({ text: t, type: "err" });
  const setOk  = (t: string) => setMsg({ text: t, type: "ok" });

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/users", { credentials: "include" });
      if (r.status === 401) { router.push("/login"); return; }
      if (r.status === 403) { router.push("/terminal"); return; }
      const d = await r.json();
      setUsers(d.users ?? []);
    } finally { setLoading(false); }
  }, [router]);

  const loadSupervisor = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/admin/supervisor", { credentials: "include" });
      const d = await r.json();
      setBeats(d.heartbeats ?? []);
      setEvents(d.recoveryEvents ?? []);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setMsg({ text: "", type: "ok" });
    if (tab === "users" || tab === "create") loadUsers();
    else loadSupervisor();
  }, [tab, loadUsers, loadSupervisor]);

  const patchUser = async (id: string, body: object, successMsg: string) => {
    setMsg({ text: "", type: "ok" });
    const r = await fetch(`/api/admin/user/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      credentials: "include", body: JSON.stringify(body),
    });
    const d = await r.json();
    if (r.ok) { setOk(successMsg); loadUsers(); }
    else setErr(d.error ?? "Failed");
  };

  const deleteUser = async (u: User) => {
    if (!confirm(`Delete "${u.username}" and all data? This cannot be undone.`)) return;
    const r = await fetch(`/api/admin/user/${u.id}`, { method: "DELETE", credentials: "include" });
    const d = await r.json();
    if (r.ok) { setOk(`Deleted ${u.username}`); loadUsers(); }
    else setErr(d.error ?? "Failed");
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
      const r = await fetch("/api/admin/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: newU, password: newP, email: newE || undefined, isAdmin: newA }),
      });
      const d = await r.json();
      if (r.ok) {
        setOk(`User "${d.username}" created`);
        setNewU(""); setNewP(""); setNewE(""); setNewA(false);
        setTab("users");
      } else setErr(d.error ?? "Failed");
    } finally { setCreating(false); }
  };

  // ── Styles ──────────────────────────────────────────────────────────────
  const th: React.CSSProperties = {
    padding: "0.625rem 1rem", fontSize: "0.6875rem", fontWeight: 600,
    color: "var(--text-muted)", textAlign: "left", whiteSpace: "nowrap",
    letterSpacing: "0.06em", textTransform: "uppercase",
  };
  const td: React.CSSProperties = {
    padding: "0.75rem 1rem", fontSize: "0.8125rem", color: "var(--text-secondary)",
    borderBottom: "1px solid var(--border-color)", verticalAlign: "middle",
  };
  const inp: React.CSSProperties = {
    background: "var(--bg-input)", border: "1px solid var(--border-color)",
    borderRadius: "var(--radius-sm)", padding: "0.6rem 0.875rem",
    color: "var(--text-primary)", fontSize: "0.9rem", width: "100%", outline: "none",
    transition: "border-color var(--transition)",
  };
  const btn = (bg: string, color: string, border = "transparent"): React.CSSProperties => ({
    background: bg, color, border: `1px solid ${border}`,
    borderRadius: "var(--radius-sm)", padding: "0.25rem 0.625rem",
    fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
    whiteSpace: "nowrap",
  });

  const tabStyle = (t: Tab): React.CSSProperties => ({
    background: tab === t ? "var(--accent-dim)" : "transparent",
    border: `1px solid ${tab === t ? "rgba(124,58,237,0.4)" : "transparent"}`,
    color: tab === t ? "var(--accent-light)" : "var(--text-muted)",
    borderRadius: "var(--radius-sm)", padding: "0.4rem 1rem",
    fontSize: "0.8125rem", fontWeight: 500, cursor: "pointer",
    transition: "all var(--transition)",
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>
      {/* Header */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1.5rem", height: 56,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-color)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(124,58,237,0.4)",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: "0.9375rem", fontWeight: 700, color: "var(--text-primary)" }}>Admin Dashboard</div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>Debian Web Terminal</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
          <span className="badge badge-purple">{username}</span>
          <button onClick={() => router.push("/terminal")}
            style={btn("var(--accent-dim)", "var(--accent-light)", "rgba(124,58,237,0.3)")}>
            ← Terminal
          </button>
          <button onClick={async () => { await fetch("/api/auth/logout", { method: "POST", credentials: "include" }); router.push("/login"); }}
            style={btn("transparent", "var(--text-secondary)", "var(--border-color)")}>
            Logout
          </button>
        </div>
      </header>

      <main style={{ flex: 1, overflow: "auto", padding: "1.5rem" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1.5rem", padding: "0.375rem", background: "var(--bg-card)", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", width: "fit-content" }}>
          <button style={tabStyle("users")} onClick={() => setTab("users")}>Users ({users.length})</button>
          <button style={tabStyle("create")} onClick={() => setTab("create")}>+ Create User</button>
          <button style={tabStyle("supervisor")} onClick={() => setTab("supervisor")}>Supervisor Logs</button>
        </div>

        {/* Message */}
        {msg.text && (
          <div style={{
            background: msg.type === "ok" ? "var(--success-bg)" : "var(--error-bg)",
            border: `1px solid ${msg.type === "ok" ? "var(--success-border)" : "var(--error-border)"}`,
            borderRadius: "var(--radius-md)", padding: "0.625rem 1rem",
            color: msg.type === "ok" ? "var(--success)" : "#fca5a5",
            fontSize: "0.875rem", marginBottom: "1rem",
            animation: "fade-in 0.2s ease",
          }}>
            {msg.type === "ok" ? "✓" : "⚠"} {msg.text}
          </div>
        )}

        {/* ── Users Tab ──────────────────────────────────── */}
        {tab === "users" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>All Users</h2>
              <button onClick={loadUsers} style={btn("var(--bg-hover)", "var(--text-secondary)", "var(--border-color)")}>↺ Refresh</button>
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {[1, 2, 3].map(i => <div key={i} className="shimmer" style={{ height: 56 }} />)}
              </div>
            ) : (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ background: "var(--bg-secondary)" }}>
                    <tr>
                      {["User", "Role", "Status", "Sandbox", "Last Login", "Processes", "Actions"].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} style={{ transition: "background var(--transition)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}>
                            <div style={{
                              width: 28, height: 28, borderRadius: "50%",
                              background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: "0.6875rem", fontWeight: 700, color: "white", flexShrink: 0,
                            }}>
                              {u.username[0]?.toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>{u.username}</div>
                              {u.email && <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)" }}>{u.email}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={td}>
                          <span className={`badge ${u.isAdmin ? "badge-purple" : "badge-muted"}`}>
                            {u.isAdmin ? "Admin" : "User"}
                          </span>
                        </td>
                        <td style={td}>
                          <span className={`badge ${u.isActive ? "badge-success" : "badge-error"}`}>
                            {u.isActive ? "Active" : "Disabled"}
                          </span>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <StatusDot status={u.sandboxStatus} />
                            <span style={{ fontSize: "0.75rem" }}>{u.sandboxStatus}</span>
                          </div>
                          {u.lastHeartbeatAt && (
                            <div style={{ fontSize: "0.625rem", color: "var(--text-muted)" }}>♥ {ago(u.lastHeartbeatAt)}</div>
                          )}
                        </td>
                        <td style={{ ...td, fontSize: "0.75rem" }}>{ago(u.lastLoginAt)}</td>
                        <td style={{ ...td, textAlign: "center" }}>
                          <span className="badge badge-muted">{u.processCount}</span>
                        </td>
                        <td style={td}>
                          <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                            <button onClick={() => patchUser(u.id, { isActive: !u.isActive }, `${u.isActive ? "Disabled" : "Enabled"} ${u.username}`)}
                              style={btn(u.isActive ? "var(--warning-bg)" : "var(--success-bg)", u.isActive ? "var(--warning)" : "var(--success)")}>
                              {u.isActive ? "Disable" : "Enable"}
                            </button>
                            <button onClick={() => patchUser(u.id, { isAdmin: !u.isAdmin }, `${u.isAdmin ? "Demoted" : "Promoted"} ${u.username}`)}
                              style={btn("var(--accent-dim)", "var(--accent-light)")}>
                              {u.isAdmin ? "Demote" : "Promote"}
                            </button>
                            <button onClick={() => resetPw(u)}
                              style={btn("var(--bg-hover)", "var(--text-secondary)", "var(--border-color)")}>
                              Reset Pw
                            </button>
                            <button onClick={() => deleteUser(u)}
                              style={btn("var(--error-bg)", "#fca5a5")}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <div style={{ textAlign: "center", padding: "3rem", color: "var(--text-muted)" }}>No users found.</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Create Tab ─────────────────────────────────── */}
        {tab === "create" && (
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)", marginBottom: "1.25rem" }}>
              Create New User
            </h2>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-xl)", padding: "2rem", maxWidth: 480 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {[
                  { label: "Username *", ph: "letters, numbers, _ and -", val: newU, set: setNewU, type: "text" },
                  { label: "Password *", ph: "Minimum 8 characters", val: newP, set: setNewP, type: "password" },
                  { label: "Email (optional)", ph: "user@example.com", val: newE, set: setNewE, type: "email" },
                ].map(f => (
                  <div key={f.label}>
                    <label style={{ display: "block", fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-secondary)", marginBottom: "0.4rem" }}>{f.label}</label>
                    <input
                      type={f.type} value={f.val}
                      onChange={e => f.set(e.target.value)}
                      placeholder={f.ph} disabled={creating}
                      style={inp}
                      onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                      onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                    />
                  </div>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: "0.625rem", cursor: "pointer", padding: "0.75rem", background: "var(--bg-hover)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                  <input type="checkbox" checked={newA} onChange={e => setNewA(e.target.checked)} disabled={creating}
                    style={{ accentColor: "var(--accent-primary)", width: 16, height: 16 }} />
                  <div>
                    <div style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-primary)" }}>Grant administrator role</div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>Admin can manage users and view logs</div>
                  </div>
                </label>
                <button onClick={createUser} disabled={creating} style={{
                  background: creating ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "white", border: "none", borderRadius: "var(--radius-md)",
                  padding: "0.8125rem", fontSize: "0.9375rem", fontWeight: 600,
                  cursor: creating ? "not-allowed" : "pointer", width: "100%",
                  boxShadow: creating ? "none" : "0 4px 20px rgba(124,58,237,0.35)",
                  marginTop: "0.25rem",
                }}>
                  {creating ? "Creating…" : "Create User"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Supervisor Tab ─────────────────────────────── */}
        {tab === "supervisor" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>Supervisor Activity</h2>
              <button onClick={loadSupervisor} style={btn("var(--bg-hover)", "var(--text-secondary)", "var(--border-color)")}>↺ Refresh</button>
            </div>

            {/* Setup instructions */}
            <div style={{
              background: "var(--info-bg)", border: "1px solid var(--info-border)",
              borderRadius: "var(--radius-lg)", padding: "1rem 1.25rem", marginBottom: "1.5rem",
              fontSize: "0.8125rem", color: "var(--text-secondary)",
            }}>
              <strong style={{ color: "var(--info)", fontSize: "0.875rem" }}>📡 Scheduler setup (cron-job.org)</strong>
              <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.3rem" }}>
                {[
                  ["URL", "https://debian11.vercel.app/api/internal/supervisor"],
                  ["Method", "POST"],
                  ["Schedule", "*/10 * * * * (every 10 minutes)"],
                  ["Header", "Authorization: Bearer <SUPERVISOR_SECRET>"],
                  ["Body", "{}"],
                  ["Timeout", "60 seconds"],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: "flex", gap: "0.75rem", alignItems: "flex-start" }}>
                    <span style={{ color: "var(--text-muted)", fontWeight: 500, minWidth: 70, flexShrink: 0 }}>{k}:</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", wordBreak: "break-all", color: "var(--text-primary)" }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "0.75rem", color: "var(--text-muted)", fontSize: "0.75rem", padding: "0.5rem 0.75rem", background: "rgba(0,0,0,0.2)", borderRadius: "var(--radius-sm)" }}>
                ⚠ Vercel Hobby: 45-min session limit. Supervisor keeps sandboxes alive and restarts processes — max 10 min downtime between sessions.
              </div>
            </div>

            {/* Heartbeats */}
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Recent Supervisor Runs</h3>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", overflow: "hidden", marginBottom: "1.5rem" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "var(--bg-secondary)" }}>
                  <tr>{["Time", "Action", "Duration", "Error"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {beats.map(h => (
                    <tr key={h.id}>
                      <td style={{ ...td, fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>{fmt(h.ranAt)}</td>
                      <td style={td}>
                        <span className={`badge ${h.action === "check" || h.action === "heartbeat" ? "badge-success" : h.action === "skip" ? "badge-warning" : "badge-error"}`}>
                          {h.action}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: "0.75rem" }}>{h.durationMs ? `${h.durationMs}ms` : "—"}</td>
                      <td style={{ ...td, color: "#fca5a5", fontSize: "0.75rem", maxWidth: 240 }}>{h.error || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {beats.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>
                  No supervisor runs yet. Configure cron-job.org.
                </div>
              )}
            </div>

            {/* Recovery events */}
            <h3 style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-primary)", marginBottom: "0.75rem" }}>Recovery Events</h3>
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ background: "var(--bg-secondary)" }}>
                  <tr>{["Time", "User", "Result", "Processes", "Error"].map(h => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {events.map(e => (
                    <tr key={e.id}>
                      <td style={{ ...td, fontSize: "0.75rem", fontFamily: "var(--font-mono)" }}>{fmt(e.startedAt)}</td>
                      <td style={{ ...td, fontWeight: 600, color: "var(--text-primary)" }}>{e.username ?? "—"}</td>
                      <td style={td}>
                        <span className={`badge ${e.success ? "badge-success" : "badge-error"}`}>
                          {e.success ? "OK" : "Failed"}
                        </span>
                      </td>
                      <td style={{ ...td, fontSize: "0.75rem" }}>↺ {e.processesRestarted}</td>
                      <td style={{ ...td, fontSize: "0.75rem", color: "#fca5a5" }}>{e.error ? e.error.slice(0, 60) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {events.length === 0 && (
                <div style={{ textAlign: "center", padding: "2rem", color: "var(--text-muted)", fontSize: "0.875rem" }}>No events yet.</div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
