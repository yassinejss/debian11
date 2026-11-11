"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }), credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Login failed."); return; }
      router.push("/dashboard/terminal"); router.refresh();
    } catch { setError("Network error. Please try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "var(--surface-0)", padding: 24, position: "relative", overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.025,
        backgroundImage: "linear-gradient(var(--border-2) 1px,transparent 1px),linear-gradient(90deg,var(--border-2) 1px,transparent 1px)",
        backgroundSize: "36px 36px", pointerEvents: "none",
      }} />
      {/* Glow */}
      <div style={{ position: "absolute", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle,rgba(124,58,237,0.1) 0%,transparent 70%)", top: "5%", left: "50%", transform: "translateX(-50%)", pointerEvents: "none" }} />

      <div style={{ width: "100%", maxWidth: 380, position: "relative", animation: "fadeIn 0.3s ease" }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 52, height: 52, borderRadius: 14,
            background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
            boxShadow: "0 0 32px rgba(124,58,237,0.5)", marginBottom: 16,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-0)", letterSpacing: "-0.03em" }}>Debian Web Terminal</h1>
          <p style={{ color: "var(--text-2)", fontSize: 13, marginTop: 4 }}>GNU/Linux 11 Bullseye · Cloud Shell</p>
        </div>

        {/* Card */}
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--border-1)", borderRadius: "var(--r-xl)", padding: 28, boxShadow: "0 24px 48px rgba(0,0,0,0.5)" }}>
          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {error && (
              <div className="alert alert-red" style={{ animation: "fadeIn 0.2s ease" }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Username</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                  </svg>
                </div>
                <input className="input" type="text" value={username} onChange={e => setUsername(e.target.value)}
                  autoComplete="username" autoFocus required disabled={loading} placeholder="Enter username"
                  style={{ paddingLeft: 32 }} />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Password</label>
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-3)", pointerEvents: "none" }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <input className="input" type={showPw ? "text" : "password"} value={password}
                  onChange={e => setPassword(e.target.value)} autoComplete="current-password"
                  required disabled={loading} placeholder="Enter password"
                  style={{ paddingLeft: 32, paddingRight: 36 }} />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 2, display: "flex" }}>
                  {showPw ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg" disabled={loading}
              style={{ width: "100%", marginTop: 4, justifyContent: "center" }}>
              {loading ? (
                <>
                  <span style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                  Signing in…
                </>
              ) : "Sign in →"}
            </button>
          </form>
        </div>

        {/* Contact */}
        <div style={{ marginTop: 16, background: "var(--surface-2)", border: "1px solid var(--border-0)", borderRadius: "var(--r-lg)", padding: "12px 16px" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", marginBottom: 10 }}>Developer</p>
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <a href="https://github.com/yassinejss" target="_blank" rel="noopener noreferrer"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--r-md)", background: "var(--surface-3)", border: "1px solid var(--border-1)", color: "var(--text-1)", fontSize: 12, textDecoration: "none", transition: "all var(--t-base)" }}
              onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = "var(--border-2)"; el.style.color = "var(--text-0)"; }}
              onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = "var(--border-1)"; el.style.color = "var(--text-1)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              yassinejss
            </a>
            <div
              onClick={() => navigator.clipboard?.writeText("yassinejs")}
              title="Discord: yassinejs (click to copy)"
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: "var(--r-md)", background: "var(--surface-3)", border: "1px solid var(--border-1)", color: "var(--text-1)", fontSize: 12, cursor: "pointer", transition: "all var(--t-base)" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "rgba(88,101,242,0.4)"; el.style.color = "var(--text-0)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "var(--border-1)"; el.style.color = "var(--text-1)"; }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
              </svg>
              yassinejs
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: "var(--text-3)" }}>
          Restricted access · Authorized users only
        </p>
      </div>
    </div>
  );
}
