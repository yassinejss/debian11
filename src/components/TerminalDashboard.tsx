"use client";

/**
 * TerminalDashboard v3
 *
 * Key fixes:
 * 1. On page load, calls POST /api/sandbox which RETURNS EXISTING URL if sandbox running.
 *    The user reconnects to the SAME shell session — not a new one.
 * 2. Auto-refresh: polls /api/sandbox every 30s to update the URL if it changed
 *    (e.g. after supervisor recovery). The iframe src updates automatically.
 * 3. Process manager panel with live status.
 * 4. Premium dark UI design.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import TerminalClient from "./TerminalClient";

interface Props { username: string; isAdmin: boolean; }

type ConnStatus = "idle" | "starting" | "connected" | "recovering" | "error";
type Panel = "none" | "processes";

interface ManagedProcess {
  id: string;
  name: string;
  command: string;
  workingDir: string;
  restartPolicy: string;
  status: "running" | "stopped" | "failed" | "starting";
  pid?: number;
  failureCount: number;
  maxFailures: number;
  lastError?: string;
  isInteractive: boolean;
}

function timeAgo(ts?: number): string {
  if (!ts) return "never";
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function TerminalDashboard({ username, isAdmin }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<ConnStatus>("idle");
  const [terminalUrl, setTerminalUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [panel, setPanel] = useState<Panel>("none");
  const [sandboxStatus, setSandboxStatus] = useState<string>("unknown");
  const [lastHeartbeat, setLastHeartbeat] = useState<number | undefined>();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Process manager
  const [processes, setProcesses] = useState<ManagedProcess[]>([]);
  const [procLoading, setProcLoading] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCmd, setNewCmd] = useState("");
  const [newDir, setNewDir] = useState("/root");
  const [newPolicy, setNewPolicy] = useState("on-failure");
  const [autoStart, setAutoStart] = useState(false);
  const [addingProc, setAddingProc] = useState(false);
  const [procMsg, setProcMsg] = useState({ text: "", type: "ok" as "ok" | "err" });

  /**
   * Connect to sandbox.
   * POST /api/sandbox returns existing URL if sandbox is still running.
   * This means the user reconnects to the SAME shell, not a new one.
   */
  const connectSandbox = useCallback(async (isReconnect = false) => {
    setStatus(isReconnect ? "recovering" : "starting");
    setErrorMsg("");
    try {
      const res = await fetch("/api/sandbox", { method: "POST", credentials: "include" });
      if (res.status === 401) { router.push("/login"); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to start sandbox");

      const url: string = data.terminalUrl;
      setSandboxStatus(data.status?.status ?? "running");
      setLastHeartbeat(data.status?.lastHeartbeatAt);

      // If URL changed (after supervisor recovery), update iframe src
      setTerminalUrl(url);
      setStatus("connected");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    }
  }, [router]);

  // Initial connect
  useEffect(() => { connectSandbox(false); }, [connectSandbox]);

  // Poll every 30s to update terminal URL if supervisor recovered the sandbox
  useEffect(() => {
    if (status !== "connected") return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/sandbox", { method: "POST", credentials: "include" });
        if (!res.ok) return;
        const data = await res.json();
        const newUrl: string = data.terminalUrl;
        setSandboxStatus(data.status?.status ?? "running");
        setLastHeartbeat(data.status?.lastHeartbeatAt);
        // Only update if URL changed (avoid unnecessary iframe reload)
        if (newUrl && newUrl !== terminalUrl) {
          console.log("[terminal] URL changed after recovery, updating iframe");
          setTerminalUrl(newUrl);
        }
      } catch {}
    }, 30000);

    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [status, terminalUrl]);

  const loadProcesses = useCallback(async () => {
    setProcLoading(true);
    try {
      const r = await fetch("/api/processes", { credentials: "include" });
      const d = await r.json();
      setProcesses(d.processes ?? []);
    } finally {
      setProcLoading(false);
    }
  }, []);

  useEffect(() => { if (panel === "processes") loadProcesses(); }, [panel, loadProcesses]);

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  };

  const procAction = async (id: string, action: "start" | "stop" | "delete") => {
    setProcMsg({ text: "", type: "ok" });
    const r = await fetch(`/api/processes/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ action }),
    });
    const d = await r.json();
    if (r.ok) {
      setProcMsg({ text: `${action.charAt(0).toUpperCase() + action.slice(1)}ed`, type: "ok" });
      loadProcesses();
    } else {
      setProcMsg({ text: d.error ?? "Error", type: "err" });
    }
  };

  const addProcess = async () => {
    if (!newName || !newCmd) { setProcMsg({ text: "Name and command required", type: "err" }); return; }
    setAddingProc(true);
    setProcMsg({ text: "", type: "ok" });
    try {
      const r = await fetch("/api/processes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: newName, command: newCmd, workingDir: newDir, restartPolicy: newPolicy, autoStart }),
      });
      const d = await r.json();
      if (r.ok) {
        setProcMsg({ text: `"${newName}" registered`, type: "ok" });
        setNewName(""); setNewCmd(""); setNewDir("/root"); setAutoStart(false);
        loadProcesses();
      } else {
        setProcMsg({ text: d.error ?? "Error", type: "err" });
      }
    } finally {
      setAddingProc(false);
    }
  };

  // ── Status indicator ──────────────────────────────────────────────────────
  const statusConfig = {
    idle:       { color: "var(--text-muted)",     label: "Idle",          pulse: false },
    starting:   { color: "var(--warning)",         label: "Starting sandbox…", pulse: true },
    connected:  { color: "var(--success)",         label: "Connected",    pulse: false },
    recovering: { color: "var(--cyan)",            label: "Recovering…",  pulse: true },
    error:      { color: "var(--error)",           label: "Error",        pulse: false },
  }[status];

  // ── Styles ─────────────────────────────────────────────────────────────────
  const inp: React.CSSProperties = {
    background: "var(--bg-input)", border: "1px solid var(--border-color)",
    borderRadius: "var(--radius-sm)", padding: "0.5rem 0.6875rem",
    color: "var(--text-primary)", fontSize: "0.8125rem",
    width: "100%", outline: "none",
    transition: "border-color var(--transition)",
  };
  const btn = (bg: string, color: string): React.CSSProperties => ({
    background: bg, color, border: "none",
    borderRadius: "var(--radius-sm)", padding: "0.25rem 0.625rem",
    fontSize: "0.75rem", fontWeight: 500, cursor: "pointer",
    transition: "opacity var(--transition)",
  });

  const procStatusCfg = (s: string) => {
    if (s === "running") return { color: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" };
    if (s === "failed")  return { color: "var(--error)",   bg: "var(--error-bg)",   border: "var(--error-border)" };
    if (s === "starting")return { color: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" };
    return { color: "var(--text-muted)", bg: "var(--bg-hover)", border: "var(--border-color)" };
  };

  const runningCount = processes.filter(p => p.status === "running").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--bg-primary)", overflow: "hidden" }}>

      {/* ═══ HEADER ═══════════════════════════════════════════════════════ */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 1.25rem", height: 52,
        background: "var(--bg-secondary)",
        borderBottom: "1px solid var(--border-color)",
        flexShrink: 0,
        gap: "1rem",
      }}>
        {/* Left: logo + status */}
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", minWidth: 0 }}>
          {/* Logo */}
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 12px rgba(124,58,237,0.4)",
          }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>

          {/* Title */}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
              Debian Terminal
            </div>
            <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 1 }}>
              GNU/Linux 11 Bullseye
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: "var(--border-color)", flexShrink: 0 }} />

          {/* Status dot */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: statusConfig.color, display: "inline-block", flexShrink: 0,
              boxShadow: status === "connected" ? `0 0 8px ${statusConfig.color}` : "none",
              animation: statusConfig.pulse ? "pulse-dot 1.2s ease-in-out infinite" : "none",
            }} />
            <span style={{ fontSize: "0.8125rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
              {statusConfig.label}
            </span>
          </div>

          {/* Heartbeat badge */}
          {lastHeartbeat && status === "connected" && (
            <span className="badge badge-muted" style={{ fontSize: "0.625rem" }}>
              ♥ {timeAgo(lastHeartbeat)}
            </span>
          )}
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
          {/* Processes toggle */}
          <button
            onClick={() => setPanel(panel === "processes" ? "none" : "processes")}
            style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              background: panel === "processes" ? "var(--accent-dim)" : "transparent",
              border: `1px solid ${panel === "processes" ? "rgba(124,58,237,0.4)" : "var(--border-color)"}`,
              color: panel === "processes" ? "var(--accent-light)" : "var(--text-secondary)",
              borderRadius: "var(--radius-sm)", padding: "0.3125rem 0.75rem",
              fontSize: "0.8125rem", cursor: "pointer",
              transition: "all var(--transition)",
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
            Processes
            {runningCount > 0 && (
              <span style={{
                background: "var(--success)", color: "white",
                borderRadius: 999, padding: "0 5px",
                fontSize: "0.625rem", fontWeight: 700, lineHeight: "15px",
              }}>
                {runningCount}
              </span>
            )}
          </button>

          {/* Admin */}
          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              style={{
                background: "var(--accent-dim)", border: "1px solid rgba(124,58,237,0.3)",
                color: "var(--accent-light)", borderRadius: "var(--radius-sm)",
                padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", cursor: "pointer",
              }}
            >
              Admin
            </button>
          )}

          {/* Reconnect (on error) */}
          {(status === "error" || status === "idle") && (
            <button onClick={() => connectSandbox(true)} style={{
              background: "var(--warning-bg)", border: "1px solid var(--warning-border)",
              color: "var(--warning)", borderRadius: "var(--radius-sm)",
              padding: "0.3125rem 0.75rem", fontSize: "0.8125rem", cursor: "pointer",
            }}>
              Reconnect
            </button>
          )}

          {/* User + logout */}
          <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: "var(--bg-hover)", border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-md)", padding: "0.25rem 0.625rem 0.25rem 0.375rem",
          }}>
            <div style={{
              width: 24, height: 24, borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #06b6d4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "0.6875rem", fontWeight: 700, color: "white", flexShrink: 0,
            }}>
              {username[0]?.toUpperCase()}
            </div>
            <span style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-primary)" }}>
              {username}
            </span>
            {isAdmin && <span className="badge badge-purple">Admin</span>}
            <button onClick={logout} title="Logout" style={{
              background: "none", border: "none", color: "var(--text-muted)",
              cursor: "pointer", padding: "2px", display: "flex", alignItems: "center",
              marginLeft: 2,
              transition: "color var(--transition)",
            }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--error)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ═══ BODY ══════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Terminal area */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {(status === "starting" || status === "recovering") && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: "1.5rem",
              background: "var(--terminal-bg)", animation: "fade-in 0.3s ease",
            }}>
              {/* Animated logo */}
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 0 32px rgba(124,58,237,0.5)",
                animation: "glow-pulse 2s ease-in-out infinite",
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                </svg>
              </div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "1rem" }}>
                  {status === "recovering" ? "Reconnecting to your session…" : "Starting your Debian Sandbox…"}
                </p>
                <p style={{ fontSize: "0.8125rem", color: "var(--text-muted)", marginTop: "0.375rem" }}>
                  {status === "recovering"
                    ? "Resuming exactly where you left off"
                    : "First boot may take 15–45 seconds"}
                </p>
                <div style={{ display: "flex", gap: "0.375rem", justifyContent: "center", marginTop: "1rem" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 7, height: 7, borderRadius: "50%",
                      background: "var(--accent-primary)",
                      animation: `pulse-dot 1.2s ease-in-out infinite`,
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {status === "error" && (
            <div style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--terminal-bg)",
            }}>
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--error-border)",
                borderRadius: "var(--radius-xl)", padding: "2rem",
                maxWidth: 420, width: "100%", margin: "1rem", textAlign: "center",
                animation: "fade-in 0.3s ease",
              }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>⚠️</div>
                <h2 style={{ color: "#fca5a5", fontWeight: 700, marginBottom: "0.5rem" }}>
                  Connection Failed
                </h2>
                <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: "1.5rem", lineHeight: 1.6 }}>
                  {errorMsg}
                </p>
                <button onClick={() => connectSandbox(true)} style={{
                  background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
                  color: "white", border: "none", borderRadius: "var(--radius-md)",
                  padding: "0.75rem 1.5rem", fontSize: "0.9375rem",
                  fontWeight: 600, cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                }}>
                  Try Again
                </button>
              </div>
            </div>
          )}

          {status === "connected" && terminalUrl && (
            <TerminalClient
              terminalUrl={terminalUrl}
              username={username}
              onDisconnect={() => setStatus("error")}
            />
          )}
        </main>

        {/* ═══ PROCESS MANAGER PANEL ═══════════════════════════════════════ */}
        {panel === "processes" && (
          <aside style={{
            width: 340, flexShrink: 0,
            background: "var(--bg-secondary)",
            borderLeft: "1px solid var(--border-color)",
            display: "flex", flexDirection: "column", overflow: "hidden",
            animation: "fade-in 0.2s ease",
          }}>
            {/* Panel header */}
            <div style={{
              padding: "0.875rem 1rem",
              borderBottom: "1px solid var(--border-color)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "var(--bg-card)", flexShrink: 0,
            }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.875rem" }}>
                  Background Processes
                </div>
                <div style={{ fontSize: "0.6875rem", color: "var(--text-muted)", marginTop: 2 }}>
                  Survive sandbox recovery
                </div>
              </div>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <span className="badge badge-success">{runningCount} running</span>
                <button onClick={loadProcesses} title="Refresh" style={{
                  background: "none", border: "none", color: "var(--text-muted)",
                  cursor: "pointer", fontSize: "1rem", padding: "2px",
                  transition: "color var(--transition)",
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                  onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
                >
                  ↺
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflow: "auto", padding: "0.75rem" }}>
              {/* Message */}
              {procMsg.text && (
                <div style={{
                  padding: "0.5rem 0.75rem", borderRadius: "var(--radius-sm)",
                  fontSize: "0.75rem", marginBottom: "0.75rem",
                  background: procMsg.type === "ok" ? "var(--success-bg)" : "var(--error-bg)",
                  border: `1px solid ${procMsg.type === "ok" ? "var(--success-border)" : "var(--error-border)"}`,
                  color: procMsg.type === "ok" ? "var(--success)" : "#fca5a5",
                  animation: "fade-in 0.2s ease",
                }}>
                  {procMsg.type === "ok" ? "✓" : "⚠"} {procMsg.text}
                </div>
              )}

              {/* Process list */}
              {procLoading ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {[1, 2].map(i => (
                    <div key={i} className="shimmer" style={{ height: 72, borderRadius: "var(--radius-md)" }} />
                  ))}
                </div>
              ) : processes.length === 0 ? (
                <div style={{
                  textAlign: "center", color: "var(--text-muted)",
                  padding: "2rem 0.5rem",
                }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: "50%",
                    background: "var(--bg-hover)", margin: "0 auto 0.75rem",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-xmuted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                    </svg>
                  </div>
                  <p style={{ fontSize: "0.875rem", fontWeight: 500, color: "var(--text-secondary)" }}>No processes yet</p>
                  <p style={{ fontSize: "0.75rem", marginTop: "0.25rem" }}>Register a background service below</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "0.75rem" }}>
                  {processes.map((p) => {
                    const sc = procStatusCfg(p.status);
                    return (
                      <div key={p.id} style={{
                        background: "var(--bg-card)", border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)", padding: "0.75rem",
                        transition: "border-color var(--transition)",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.3rem" }}>
                          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.8125rem" }}>
                            {p.name}
                          </span>
                          <span style={{
                            fontSize: "0.6875rem", fontWeight: 600, padding: "0.125rem 0.4rem",
                            borderRadius: 999, border: `1px solid ${sc.border}`,
                            background: sc.bg, color: sc.color,
                          }}>
                            {p.status}
                          </span>
                        </div>
                        <div style={{
                          fontSize: "0.75rem", color: "var(--text-muted)",
                          fontFamily: "var(--font-mono)", marginBottom: "0.4rem",
                          wordBreak: "break-all", lineHeight: 1.4,
                        }}>
                          {p.command.length > 55 ? p.command.slice(0, 55) + "…" : p.command}
                        </div>
                        {p.lastError && (
                          <div style={{
                            fontSize: "0.6875rem", color: "#fca5a5",
                            background: "var(--error-bg)", borderRadius: 4,
                            padding: "0.2rem 0.4rem", marginBottom: "0.4rem",
                          }}>
                            {p.lastError.slice(0, 80)}
                          </div>
                        )}
                        <div style={{ fontSize: "0.6875rem", color: "var(--text-xmuted)", marginBottom: "0.5rem" }}>
                          {p.restartPolicy} · {p.failureCount}/{p.maxFailures} failures
                          {p.pid ? ` · pid ${p.pid}` : ""}
                        </div>
                        <div style={{ display: "flex", gap: "0.375rem" }}>
                          {p.status !== "running" && !p.isInteractive && (
                            <button onClick={() => procAction(p.id, "start")}
                              style={btn("var(--success-bg)", "var(--success)")}>▶ Start</button>
                          )}
                          {p.status === "running" && (
                            <button onClick={() => procAction(p.id, "stop")}
                              style={btn("var(--warning-bg)", "var(--warning)")}>⏹ Stop</button>
                          )}
                          <button onClick={() => { if (confirm(`Delete "${p.name}"?`)) procAction(p.id, "delete"); }}
                            style={btn("var(--error-bg)", "#fca5a5")}>✕ Delete</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Add Process form */}
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-md)", padding: "0.875rem",
              }}>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "0.8125rem", marginBottom: "0.75rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  Register Process
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <input style={inp} placeholder="Name (e.g. discord-bot)"
                    value={newName} onChange={e => setNewName(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                  />
                  <textarea
                    style={{ ...inp, resize: "vertical" as const, minHeight: 56, fontFamily: "var(--font-mono)", lineHeight: 1.4 }}
                    placeholder="Command (e.g. python3 /root/bot.py)"
                    value={newCmd} onChange={e => setNewCmd(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                  />
                  <input style={{ ...inp, fontFamily: "var(--font-mono)" }}
                    placeholder="Working dir (/root)"
                    value={newDir} onChange={e => setNewDir(e.target.value)}
                    onFocus={e => (e.target.style.borderColor = "var(--border-focus)")}
                    onBlur={e => (e.target.style.borderColor = "var(--border-color)")}
                  />
                  <select style={{ ...inp, cursor: "pointer" }}
                    value={newPolicy} onChange={e => setNewPolicy(e.target.value)}>
                    <option value="on-failure">on-failure — restart after crash</option>
                    <option value="always">always — restart any stop</option>
                    <option value="never">never — manual only</option>
                  </select>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.75rem", color: "var(--text-secondary)", cursor: "pointer" }}>
                    <input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)}
                      style={{ accentColor: "var(--accent-primary)", width: 14, height: 14 }}
                    />
                    Start immediately after registering
                  </label>
                  <button onClick={addProcess} disabled={addingProc} style={{
                    background: addingProc ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7c3aed, #4f46e5)",
                    color: "white", border: "none", borderRadius: "var(--radius-sm)",
                    padding: "0.5625rem", fontSize: "0.8125rem", fontWeight: 600,
                    cursor: addingProc ? "not-allowed" : "pointer",
                    boxShadow: addingProc ? "none" : "0 2px 10px rgba(124,58,237,0.3)",
                  }}>
                    {addingProc ? "Registering…" : "Register Process"}
                  </button>
                </div>
              </div>

              {/* Info box */}
              <div style={{
                marginTop: "0.75rem",
                padding: "0.625rem 0.75rem",
                background: "var(--info-bg)", border: "1px solid var(--info-border)",
                borderRadius: "var(--radius-sm)", fontSize: "0.6875rem",
                color: "var(--text-secondary)", lineHeight: 1.6,
              }}>
                <strong style={{ color: "var(--info)" }}>How recovery works:</strong><br/>
                The supervisor runs every 10 min via cron-job.org — even with no one on the site.
                It resumes expired sandboxes and restarts your registered processes automatically.
                Max downtime: ~10 min after a 45-min session expires.
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
