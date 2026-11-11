"use client";
import { useState, useEffect, useCallback } from "react";

export default function NetworkPage() {
  const [data, setData] = useState<{ interfaces: string[]; publicIp: string | null; listeningPorts: string[]; dns: string[]; note: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/network", { credentials: "include" }); if(r.ok) setData(await r.json()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)" }}>Network Diagnostics</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Sandbox network interfaces and connectivity</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm">↺ Refresh</button>
      </div>

      {data?.note && (
        <div className="alert alert-yellow" style={{ marginBottom: 20, fontSize: 12 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          {data.note}
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>{[1,2,3,4].map(i => <div key={i} className="shimmer-box" style={{ height: 80 }} />)}</div>
      ) : !data ? (
        <div className="alert alert-red">Could not retrieve network information.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Section title="Public Outbound IP">
            {data.publicIp ? (
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 600, color: "var(--text-0)", padding: "8px 12px", background: "var(--surface-3)", borderRadius: "var(--r-sm)", display: "inline-block" }}>
                {data.publicIp}
              </div>
            ) : <span style={{ color: "var(--text-2)", fontSize: 13 }}>Unavailable</span>}
            <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 8 }}>This is the outbound NAT IP — not an inbound public address.</p>
          </Section>

          <Section title={`Network Interfaces (${data.interfaces.length})`}>
            {data.interfaces.length === 0 ? <span style={{ color: "var(--text-2)", fontSize: 13 }}>None found</span> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.interfaces.map((iface, i) => (
                  <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 8px", background: "var(--surface-3)", borderRadius: "var(--r-sm)", color: "var(--text-1)" }}>{iface}</div>
                ))}
              </div>
            )}
          </Section>

          <Section title={`Listening Ports (${data.listeningPorts.length})`}>
            {data.listeningPorts.length === 0 ? <span style={{ color: "var(--text-2)", fontSize: 13 }}>None</span> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {data.listeningPorts.map((p, i) => (
                  <div key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 12, padding: "4px 8px", background: "var(--surface-3)", borderRadius: "var(--r-sm)", color: "var(--text-1)" }}>{p}</div>
                ))}
              </div>
            )}
          </Section>

          <Section title="DNS Servers">
            {data.dns.length === 0 ? <span style={{ color: "var(--text-2)", fontSize: 13 }}>None found</span> : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {data.dns.map((d, i) => <span key={i} className="badge badge-muted" style={{ fontFamily: "var(--font-mono)" }}>{d}</span>)}
              </div>
            )}
          </Section>

          <Section title="Tunnel Setup">
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { name: "Cloudflared", cmd: "curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o /usr/local/bin/cloudflared && chmod +x /usr/local/bin/cloudflared && cloudflared tunnel login", desc: "Free tunnels with Cloudflare — recommended for HTTP/HTTPS" },
                { name: "Playit.gg", cmd: "curl -SsL https://playit.gg/downloads/playit-linux-amd64 -o /root/playit && chmod +x /root/playit && /root/playit", desc: "Great for Minecraft and game servers — supports TCP/UDP" },
              ].map(t => (
                <div key={t.name} style={{ padding: "10px 12px", background: "var(--surface-3)", borderRadius: "var(--r-md)", border: "1px solid var(--border-0)" }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-0)", marginBottom: 4 }}>{t.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text-2)", marginBottom: 6 }}>{t.desc}</div>
                  <code style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-1)", wordBreak: "break-all", lineHeight: 1.5 }}>{t.cmd}</code>
                </div>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-header"><span className="card-title">{title}</span></div>
      <div className="card-body">{children}</div>
    </div>
  );
}
