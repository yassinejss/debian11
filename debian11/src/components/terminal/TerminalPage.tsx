"use client";
import { useState, useEffect, useCallback } from "react";
import MultiTerminal from "./MultiTerminal";

interface Props { username: string; }

type Status = "idle" | "starting" | "connected" | "error";

export default function TerminalPage({ username }: Props) {
  const [status, setStatus] = useState<Status>("idle");
  const [terminalUrl, setTerminalUrl] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [elapsed, setElapsed] = useState(0);

  const connect = useCallback(async () => {
    setStatus("starting");
    setErrorMsg("");
    setElapsed(0);
    const startTs = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - startTs) / 1000)), 1000);
    try {
      const res = await fetch("/api/sandbox", { method: "POST", credentials: "include" });
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setTerminalUrl(data.terminalUrl);
      setStatus("connected");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Connection failed");
      setStatus("error");
    } finally {
      clearInterval(timer);
    }
  }, []);

  useEffect(() => { connect(); }, [connect]);

  const reconnect = async () => {
    const res = await fetch("/api/sandbox", { method: "POST", credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      return data.terminalUrl as string;
    }
    throw new Error("Reconnect failed");
  };

  if (status === "starting") {
    return (
      <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 24, background: "var(--term-bg)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: "linear-gradient(135deg,#7c3aed,#4f46e5)", display: "flex", alignItems: "center", justifyContent: "center", animation: "glow 2s ease-in-out infinite" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
        </div>
        <div style={{ textAlign: "center" }}>
          <p style={{ color: "var(--text-0)", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            {elapsed < 5 ? "Starting your Debian sandbox…" : elapsed < 20 ? "Installing ttyd…" : "Almost ready…"}
          </p>
          <p style={{ color: "var(--text-2)", fontSize: 12 }}>
            {elapsed > 0 ? `${elapsed}s elapsed · ` : ""}Persistent filesystem · Same session on reconnect
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 16 }}>
            {[0,1,2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--brand)", animation: "pulse 1.2s ease-in-out infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        </div>
        <div style={{ fontSize: 11, color: "var(--text-3)", maxWidth: 320, textAlign: "center", lineHeight: 1.6 }}>
          First boot: 15–45s · Subsequent reconnects: instant if sandbox is alive
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--term-bg)" }}>
        <div style={{ background: "var(--surface-2)", border: "1px solid var(--red-border)", borderRadius: "var(--r-xl)", padding: 32, maxWidth: 400, textAlign: "center", animation: "fadeIn 0.3s ease" }}>
          <div style={{ fontSize: "2rem", marginBottom: 12 }}>⚠️</div>
          <h2 style={{ color: "var(--red)", fontWeight: 700, marginBottom: 8, fontSize: 16 }}>Connection Failed</h2>
          <p style={{ color: "var(--text-1)", fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>{errorMsg}</p>
          <button className="btn btn-primary" onClick={connect}>Try Again</button>
        </div>
      </div>
    );
  }

  if (status === "connected" && terminalUrl) {
    return <MultiTerminal initialUrl={terminalUrl} username={username} onReconnect={reconnect} />;
  }

  return null;
}
