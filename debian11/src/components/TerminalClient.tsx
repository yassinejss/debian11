"use client";

/**
 * TerminalClient v3
 * - Embeds ttyd via iframe
 * - Handles reconnect: when user comes back, same URL = same shell session
 * - Shows clear status (connected / reconnecting / error)
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  terminalUrl: string;
  username: string;
  onDisconnect?: () => void;
}

export default function TerminalClient({ terminalUrl, username, onDisconnect }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setLoaded(false);
    setTimedOut(false);

    // 30-second load timeout
    timerRef.current = setTimeout(() => {
      if (!loaded) {
        setTimedOut(true);
        onDisconnect?.();
      }
    }, 30000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [terminalUrl]);

  const handleLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setLoaded(true);
    setTimedOut(false);
  };

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      background: "var(--terminal-bg)", overflow: "hidden", position: "relative",
    }}>
      {/* Terminal top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.4375rem 1rem",
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border-color)",
        flexShrink: 0,
        height: 40,
      }}>
        {/* Traffic lights + title */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {["#ef4444", "#f59e0b", "#10b981"].map((c, i) => (
              <div key={i} style={{
                width: 11, height: 11, borderRadius: "50%", background: c,
                boxShadow: `0 0 6px ${c}66`,
              }} />
            ))}
          </div>
          <span style={{
            fontSize: "0.75rem", color: "var(--text-muted)",
            fontFamily: "var(--font-mono)",
          }}>
            {username}@debian:~#
          </span>
        </div>

        {/* Right badges */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span className="badge badge-purple">Debian 11</span>
          {loaded ? (
            <span className="badge badge-success">
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--success)", display: "inline-block" }} />
              Connected
            </span>
          ) : timedOut ? (
            <span className="badge badge-error">Timeout</span>
          ) : (
            <span className="badge badge-warning">
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--warning)", display: "inline-block", animation: "pulse-dot 1s ease-in-out infinite" }} />
              Connecting
            </span>
          )}
        </div>
      </div>

      {/* Loading overlay */}
      {!loaded && !timedOut && (
        <div style={{
          position: "absolute", inset: 0, top: 40,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          background: "var(--terminal-bg)", gap: "1.25rem", zIndex: 10,
        }}>
          <div style={{
            width: 40, height: 40,
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--accent-primary)",
            borderRadius: "50%",
            animation: "spin 0.8s linear infinite",
            boxShadow: "0 0 20px var(--accent-glow)",
          }} />
          <div style={{ textAlign: "center" }}>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", fontFamily: "var(--font-mono)" }}>
              Connecting to your Debian shell…
            </p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.75rem", marginTop: "0.375rem" }}>
              Resuming your previous session
            </p>
          </div>
        </div>
      )}

      {/* Timeout overlay */}
      {timedOut && (
        <div style={{
          position: "absolute", inset: 0, top: 40,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "var(--terminal-bg)", zIndex: 10,
        }}>
          <div style={{
            background: "var(--error-bg)", border: "1px solid var(--error-border)",
            borderRadius: "var(--radius-lg)", padding: "1.5rem",
            textAlign: "center", maxWidth: 320,
          }}>
            <div style={{ fontSize: "2rem", marginBottom: "0.75rem" }}>⏱</div>
            <p style={{ color: "#fca5a5", fontWeight: 600, marginBottom: "0.5rem" }}>Connection timed out</p>
            <p style={{ color: "var(--text-muted)", fontSize: "0.8125rem" }}>
              ttyd didn't respond in 30 seconds. The supervisor will recover it shortly.
            </p>
          </div>
        </div>
      )}

      {/* iframe */}
      <iframe
        ref={iframeRef}
        src={terminalUrl}
        onLoad={handleLoad}
        style={{
          flex: 1, width: "100%", border: "none",
          background: "var(--terminal-bg)",
          display: timedOut ? "none" : "block",
        }}
        title="Debian Terminal"
        allow="clipboard-read; clipboard-write"
      />
    </div>
  );
}
