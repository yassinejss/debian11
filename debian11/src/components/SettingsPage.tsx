"use client";
import { useState } from "react";

export default function SettingsPage() {
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok"|"err" });
  const [oldPw, setOldPw] = useState(""); const [newPw, setNewPw] = useState(""); const [confPw, setConfPw] = useState("");
  const [saving, setSaving] = useState(false);

  const changePw = async () => {
    if (newPw !== confPw) { setMsg({ text: "New passwords do not match", type: "err" }); return; }
    if (newPw.length < 8) { setMsg({ text: "Password must be at least 8 characters", type: "err" }); return; }
    setSaving(true);
    try {
      const r = await fetch("/api/auth/change-password", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
      const d = await r.json();
      if (r.ok) { setMsg({ text: "Password changed successfully", type: "ok" }); setOldPw(""); setNewPw(""); setConfPw(""); }
      else setMsg({ text: d.error || "Failed", type: "err" });
    } finally { setSaving(false); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)", marginBottom: 4 }}>Settings</h1>
      <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 24 }}>Account and application preferences</p>

      {msg.text && <div className={`alert ${msg.type === "ok" ? "alert-green" : "alert-red"}`} style={{ marginBottom: 20 }}>{msg.type === "ok" ? "✓" : "⚠"} {msg.text}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Change Password</span></div>
        <div className="card-body">
          <div className="form-group"><label className="form-label">Current password</label><input className="input" type="password" value={oldPw} onChange={e => setOldPw(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">New password</label><input className="input" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Confirm new password</label><input className="input" type="password" value={confPw} onChange={e => setConfPw(e.target.value)} /></div>
          <button className="btn btn-primary" onClick={changePw} disabled={saving}>{saving ? "Saving…" : "Update Password"}</button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Theme</span></div>
        <div className="card-body">
          <p style={{ fontSize: 13, color: "var(--text-1)", marginBottom: 12 }}>Use the toggle in the sidebar footer to switch between dark and light mode. Your preference is saved locally.</p>
          <div style={{ display: "flex", gap: 12 }}>
            {["Dark", "Light"].map(t => (
              <button key={t} className="btn btn-secondary" onClick={() => { const th = t.toLowerCase() as "dark"|"light"; document.documentElement.setAttribute("data-theme", th); localStorage.setItem("dwt-theme", th); }}>{t === "Dark" ? "🌙" : "☀️"} {t}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-title">About</span></div>
        <div className="card-body">
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Platform", "Debian GNU/Linux 11 (Bullseye)"],
              ["Hosting", "Vercel Sandbox (Hobby)"],
              ["Session Limit", "45 minutes (auto-recovered)"],
              ["Database", "Turso / libSQL"],
              ["Terminal", "ttyd (WebSocket)"],
              ["Developer", "yassinejss"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>{k}</span>
                <span style={{ fontSize: 13, color: "var(--text-1)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
