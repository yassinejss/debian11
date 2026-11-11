"use client";
import { useState, useEffect, useCallback } from "react";

interface Snapshot { id: string; name: string; description: string | null; isFavorite: boolean; snapshotData: object; createdAt: number; lastRestoredAt: number | null; }

function timeAgo(ts: number) { const s = Math.floor(Date.now()/1000)-ts; if(s<60)return`${s}s ago`; if(s<3600)return`${Math.floor(s/60)}m ago`; if(s<86400)return`${Math.floor(s/3600)}h ago`; return`${Math.floor(s/86400)}d ago`; }

export default function SnapshotsPage() {
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok"|"err" });
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState(""); const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { const r = await fetch("/api/snapshots", { credentials: "include" }); const d = await r.json(); setSnaps(d.snapshots ?? []); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createSnapshot = async () => {
    if (!newName.trim()) { setMsg({ text: "Name required", type: "err" }); return; }
    setSaving(true);
    // Build a default snapshot of a single terminal
    const snapshotData = { layout: "single", tabs: [{ id: "tab-1", label: "Shell 1", pane: "left" }], splitMode: "none", fontSize: 14, createdFrom: "manual", version: 1 };
    try {
      const r = await fetch("/api/snapshots", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ name: newName, description: newDesc || undefined, snapshotData }) });
      const d = await r.json();
      if (r.ok) { setMsg({ text: `Snapshot "${newName}" saved`, type: "ok" }); setNewName(""); setNewDesc(""); setShowCreate(false); load(); }
      else setMsg({ text: d.error || "Error", type: "err" });
    } finally { setSaving(false); }
  };

  const toggleFav = async (s: Snapshot) => {
    await fetch(`/api/snapshots/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ isFavorite: !s.isFavorite }) });
    load();
  };

  const deleteSnap = async (s: Snapshot) => {
    if (!confirm(`Delete snapshot "${s.name}"?`)) return;
    await fetch(`/api/snapshots/${s.id}`, { method: "DELETE", credentials: "include" });
    setMsg({ text: `Deleted "${s.name}"`, type: "ok" }); load();
  };

  const restore = async (s: Snapshot) => {
    await fetch(`/api/snapshots/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ lastRestoredAt: Math.floor(Date.now()/1000) }) });
    setMsg({ text: `Restored "${s.name}" — layout preferences applied. Navigate to Terminal to use it.`, type: "ok" });
    load();
  };

  const favorites = snaps.filter(s => s.isFavorite);
  const rest = snaps.filter(s => !s.isFavorite);

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)" }}>Workspace Snapshots</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Save and restore terminal workspace layouts</p>
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="btn btn-primary btn-sm">+ New Snapshot</button>
      </div>

      {msg.text && <div className={`alert ${msg.type === "ok" ? "alert-green" : "alert-red"}`} style={{ marginBottom: 16 }}>{msg.type === "ok" ? "✓" : "⚠"} {msg.text}</div>}

      {showCreate && (
        <div className="card" style={{ marginBottom: 20, animation: "fadeIn 0.2s ease" }}>
          <div className="card-header"><span className="card-title">Create Snapshot</span></div>
          <div className="card-body">
            <div className="form-group"><label className="form-label">Snapshot name *</label><input className="input" value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Dev workspace" /></div>
            <div className="form-group"><label className="form-label">Description (optional)</label><input className="input" value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="What is this snapshot for?" /></div>
            <div className="alert alert-yellow" style={{ fontSize: 12, marginBottom: 12 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Snapshots save workspace layout preferences only — not shell history, running commands, or file content. Terminal sessions are always resumed from the actual sandbox state.
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={createSnapshot} disabled={saving}>{saving ? "Saving…" : "Save Snapshot"}</button>
              <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{[1,2].map(i => <div key={i} className="shimmer-box" style={{ height: 80 }} />)}</div>
      ) : snaps.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-2)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>💾</div>
          <p style={{ fontWeight: 500, fontSize: 14, color: "var(--text-1)" }}>No snapshots yet</p>
          <p style={{ fontSize: 13, marginTop: 4 }}>Save your current terminal layout to restore it later</p>
        </div>
      ) : (
        <>
          {favorites.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>Favorites</div>
              {favorites.map(s => <SnapCard key={s.id} s={s} onFav={toggleFav} onRestore={restore} onDelete={deleteSnap} />)}
            </div>
          )}
          {rest.length > 0 && (
            <div>
              {favorites.length > 0 && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>All Snapshots</div>}
              {rest.map(s => <SnapCard key={s.id} s={s} onFav={toggleFav} onRestore={restore} onDelete={deleteSnap} />)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SnapCard({ s, onFav, onRestore, onDelete }: { s: Snapshot; onFav: (s: Snapshot) => void; onRestore: (s: Snapshot) => void; onDelete: (s: Snapshot) => void }) {
  return (
    <div className="card" style={{ marginBottom: 8, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
      <div style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "var(--surface-3)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18 }}>💾</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, color: "var(--text-0)", fontSize: 13 }}>{s.name}</div>
        {s.description && <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 1 }}>{s.description}</div>}
        <div style={{ fontSize: 11, color: "var(--text-3)", marginTop: 2 }}>
          Created {timeAgo(s.createdAt)}{s.lastRestoredAt ? ` · Restored ${timeAgo(s.lastRestoredAt)}` : ""}
        </div>
      </div>
      <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
        <button onClick={() => onFav(s)} className="btn btn-ghost btn-sm btn-icon" title={s.isFavorite ? "Unfavorite" : "Favorite"}>
          {s.isFavorite ? "★" : "☆"}
        </button>
        <button onClick={() => onRestore(s)} className="btn btn-secondary btn-sm">Restore</button>
        <button onClick={() => onDelete(s)} className="btn btn-danger btn-sm">Delete</button>
      </div>
    </div>
  );
}
