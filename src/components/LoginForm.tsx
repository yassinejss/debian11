"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || "Login failed."); return; }
      router.push("/terminal");
      router.refresh();
    } catch {
      setError("Network error. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ width: "100%", maxWidth: 420, animation: "fade-in 0.4s ease" }}>
      {/* Logo */}
      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 64, height: 64, borderRadius: 18,
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 60%, #06b6d4 100%)",
          boxShadow: "0 0 40px rgba(124,58,237,0.5), 0 0 80px rgba(124,58,237,0.15)",
          marginBottom: "1.25rem",
          animation: "glow-pulse 3s ease-in-out infinite",
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
        </div>
        <h1 className="gradient-text" style={{ fontSize: "1.75rem", fontWeight: 700, letterSpacing: "-0.03em", lineHeight: 1.2 }}>
          Debian Terminal
        </h1>
        <p style={{ color: "var(--text-muted)", fontSize: "0.875rem", marginTop: "0.375rem" }}>
          GNU/Linux 11 Bullseye · Cloud Shell
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-xl)",
        padding: "2rem",
        boxShadow: "0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.03)",
      }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.125rem" }}>
          {error && (
            <div style={{
              background: "var(--error-bg)", border: "1px solid var(--error-border)",
              borderRadius: "var(--radius-md)", padding: "0.75rem 1rem",
              color: "#fca5a5", fontSize: "0.875rem",
              display: "flex", alignItems: "flex-start", gap: "0.5rem",
              animation: "fade-in 0.2s ease",
            }}>
              <span style={{ flexShrink: 0, fontSize: "1rem" }}>⚠</span>
              <span>{error}</span>
            </div>
          )}

          {/* Username */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
              Username
            </label>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)", pointerEvents: "none",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <input
                type="text" value={username} onChange={e => setUsername(e.target.value)}
                autoComplete="username" autoFocus required disabled={loading}
                placeholder="Enter your username"
                style={{
                  width: "100%", background: "var(--bg-input)",
                  border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)",
                  padding: "0.6875rem 0.875rem 0.6875rem 2.5rem",
                  color: "var(--text-primary)", fontSize: "0.9375rem", outline: "none",
                  transition: "border-color var(--transition), box-shadow var(--transition)",
                }}
                onFocus={e => { e.target.style.borderColor = "var(--border-focus)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-glow2)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-color)"; e.target.style.boxShadow = "none"; }}
              />
            </div>
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            <label style={{ fontSize: "0.8125rem", fontWeight: 500, color: "var(--text-secondary)", letterSpacing: "0.01em" }}>
              Password
            </label>
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", left: "0.875rem", top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)", pointerEvents: "none",
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </div>
              <input
                type={showPw ? "text" : "password"} value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password" required disabled={loading}
                placeholder="Enter your password"
                style={{
                  width: "100%", background: "var(--bg-input)",
                  border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)",
                  padding: "0.6875rem 2.75rem 0.6875rem 2.5rem",
                  color: "var(--text-primary)", fontSize: "0.9375rem", outline: "none",
                  transition: "border-color var(--transition), box-shadow var(--transition)",
                }}
                onFocus={e => { e.target.style.borderColor = "var(--border-focus)"; e.target.style.boxShadow = "0 0 0 3px var(--accent-glow2)"; }}
                onBlur={e => { e.target.style.borderColor = "var(--border-color)"; e.target.style.boxShadow = "none"; }}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                style={{
                  position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)",
                  background: "none", border: "none", color: "var(--text-muted)",
                  cursor: "pointer", padding: "0.25rem", display: "flex", alignItems: "center",
                  transition: "color var(--transition)",
                }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-secondary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
              >
                {showPw ? (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button type="submit" disabled={loading} style={{
            marginTop: "0.25rem",
            background: loading
              ? "rgba(124,58,237,0.4)"
              : "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
            color: "white", border: "none",
            borderRadius: "var(--radius-md)",
            padding: "0.8125rem 1rem",
            fontSize: "0.9375rem", fontWeight: 600,
            cursor: loading ? "not-allowed" : "pointer",
            transition: "all var(--transition)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
            boxShadow: loading ? "none" : "0 4px 20px rgba(124,58,237,0.4)",
            letterSpacing: "0.01em",
          }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 6px 28px rgba(124,58,237,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)"; }}}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? "none" : "0 4px 20px rgba(124,58,237,0.4)"; (e.currentTarget as HTMLButtonElement).style.transform = "none"; }}
          >
            {loading ? (
              <>
                <span style={{ width: 16, height: 16, border: "2px solid rgba(255,255,255,0.3)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                Authenticating…
              </>
            ) : (
              <>Sign In →</>
            )}
          </button>
        </form>
      </div>

      {/* Contact Developer */}
      <div style={{
        marginTop: "1rem",
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-lg)",
        padding: "1rem 1.25rem",
      }}>
        <p style={{
          fontSize: "0.6875rem", color: "var(--text-muted)",
          letterSpacing: "0.08em", fontWeight: 600,
          textAlign: "center", marginBottom: "0.875rem",
          textTransform: "uppercase",
        }}>
          Contact Developer
        </p>
        <div style={{ display: "flex", justifyContent: "center", gap: "0.75rem" }}>
          {/* GitHub */}
          <a
            href="https://github.com/yassinejss"
            target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              color: "var(--text-secondary)", textDecoration: "none",
              fontSize: "0.8125rem", fontWeight: 500,
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-hover)",
              transition: "all var(--transition)",
              flex: 1, justifyContent: "center",
            }}
            onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = "rgba(124,58,237,0.5)"; el.style.color = "var(--text-primary)"; el.style.background = "var(--accent-dim)"; }}
            onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = "var(--border-color)"; el.style.color = "var(--text-secondary)"; el.style.background = "var(--bg-hover)"; }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
            </svg>
            yassinejss
          </a>

          {/* Discord */}
          <div
            title="Discord: yassinejs (copy)"
            onClick={() => { navigator.clipboard?.writeText("yassinejs"); }}
            style={{
              display: "flex", alignItems: "center", gap: "0.5rem",
              color: "var(--text-secondary)", fontSize: "0.8125rem", fontWeight: 500,
              padding: "0.5rem 1rem",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              background: "var(--bg-hover)",
              cursor: "pointer", flex: 1, justifyContent: "center",
              transition: "all var(--transition)",
            }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "rgba(88,101,242,0.5)"; el.style.color = "var(--text-primary)"; el.style.background = "rgba(88,101,242,0.1)"; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "var(--border-color)"; el.style.color = "var(--text-secondary)"; el.style.background = "var(--bg-hover)"; }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#5865F2">
              <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z"/>
            </svg>
            yassinejs
          </div>
        </div>
      </div>

      <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.75rem", color: "var(--text-xmuted)" }}>
        Restricted access · Authorized users only
      </p>
    </div>
  );
}
