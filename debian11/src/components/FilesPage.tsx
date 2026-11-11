"use client";
import { useState, useEffect, useCallback, useRef } from "react";

interface Entry { name: string; path: string; isDir: boolean; isLink: boolean; size: number; mtime: number; perms: string; }

function formatSize(b: number) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/1048576).toFixed(1)} MB`;
}
function formatTime(ts: number) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fileIcon(e: Entry) {
  if (e.isDir) return "📁";
  const ext = e.name.split(".").pop()?.toLowerCase() || "";
  if (["js","ts","jsx","tsx"].includes(ext)) return "📜";
  if (["py"].includes(ext)) return "🐍";
  if (["sh","bash"].includes(ext)) return "⚡";
  if (["json","yaml","yml","toml"].includes(ext)) return "⚙️";
  if (["md","txt","log"].includes(ext)) return "📄";
  if (["zip","tar","gz","xz"].includes(ext)) return "📦";
  if (["jpg","png","gif","webp","svg"].includes(ext)) return "🖼️";
  return "📄";
}

const CODE_EXTS = new Set(["js","ts","jsx","tsx","py","sh","bash","json","yaml","yml","toml","md","txt","log","conf","cfg","ini","env","css","html","sql"]);

export default function FilesPage() {
  const [path, setPath] = useState("/root");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: "", type: "ok" as "ok" | "err" });
  const [editing, setEditing] = useState<{ path: string; name: string; content: string } | null>(null);
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const [showNew, setShowNew] = useState<"file" | "dir" | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [renameTo, setRenameTo] = useState("");

  const load = useCallback(async (p = path) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/files?path=${encodeURIComponent(p)}`, { credentials: "include" });
      const d = await r.json();
      if (r.ok) { setEntries(d.entries || []); setPath(d.path); }
      else setMsg({ text: d.error || "Error", type: "err" });
    } finally { setLoading(false); }
  }, [path]);

  useEffect(() => { load(); }, []);

  const navigate = (p: string) => { setPath(p); load(p); };

  const up = () => {
    const parts = path.split("/").filter(Boolean);
    parts.pop();
    navigate(parts.length ? "/" + parts.join("/") : "/root");
  };

  const api = async (action: string, extra: object = {}) => {
    const r = await fetch("/api/files", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action, path, ...extra }),
    });
    const d = await r.json();
    if (r.ok) { setMsg({ text: "Done", type: "ok" }); load(); return true; }
    setMsg({ text: d.error || "Error", type: "err" }); return false;
  };

  const openFile = async (entry: Entry) => {
    const ext = entry.name.split(".").pop()?.toLowerCase() || "";
    if (!CODE_EXTS.has(ext)) { setMsg({ text: "Binary files cannot be previewed in the editor", type: "err" }); return; }
    const r = await fetch("/api/files", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "read", path: entry.path }),
    });
    const d = await r.json();
    if (r.ok) { setEditing({ path: entry.path, name: entry.name, content: d.content }); setEditContent(d.content); }
    else setMsg({ text: d.error || "Cannot read file", type: "err" });
  };

  const saveFile = async () => {
    if (!editing) return;
    setSaving(true);
    const r = await fetch("/api/files", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "write", path: editing.path, content: editContent }),
    });
    setSaving(false);
    if (r.ok) setMsg({ text: `Saved ${editing.name}`, type: "ok" });
    else setMsg({ text: "Save failed", type: "err" });
  };

  const doCreate = async () => {
    if (!newName.trim() || !showNew) return;
    setCreating(true);
    const ok = await api(showNew === "dir" ? "mkdir" : "touch", { name: newName.trim() });
    if (ok) { setNewName(""); setShowNew(null); }
    setCreating(false);
  };

  const doRename = async () => {
    if (!renaming || !renameTo.trim()) return;
    const dir = renaming.path.split("/").slice(0, -1).join("/") || "/root";
    const newPath = dir + "/" + renameTo.trim();
    const r = await fetch("/api/files", {
      method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include",
      body: JSON.stringify({ action: "rename", path: renaming.path, newPath }),
    });
    const d = await r.json();
    if (r.ok) { setMsg({ text: "Renamed", type: "ok" }); setRenaming(null); setRenameTo(""); load(); }
    else setMsg({ text: d.error || "Error", type: "err" });
  };

  // Breadcrumbs
  const breadcrumbs = ["/", ...path.split("/").filter(Boolean)].reduce<{ label: string; path: string }[]>((acc, seg, i, arr) => {
    if (i === 0) return [{ label: "/", path: "/" }];
    const p = "/" + arr.slice(1, i + 1).join("/");
    return [...acc, { label: seg, path: p }];
  }, []);

  if (editing) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Editor toolbar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: "1px solid var(--border-0)", background: "var(--surface-1)", flexShrink: 0 }}>
          <button onClick={() => setEditing(null)} className="btn btn-ghost btn-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><polyline points="12 19 5 12 12 5"/></svg>
            Back
          </button>
          <span style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{editing.path}</span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            {msg.text && <span style={{ fontSize: 12, color: msg.type === "ok" ? "var(--green)" : "var(--red)" }}>{msg.text}</span>}
            <button onClick={saveFile} className="btn btn-primary btn-sm" disabled={saving}>
              {saving ? "Saving…" : "💾 Save"}
            </button>
          </div>
        </div>
        {/* Editor */}
        <textarea
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          spellCheck={false}
          style={{
            flex: 1, background: "var(--term-bg)", color: "var(--term-text)",
            border: "none", outline: "none", padding: "16px 20px",
            fontFamily: "var(--font-mono)", fontSize: 13, lineHeight: 1.6,
            resize: "none", width: "100%", tabSize: 2,
          }}
          onKeyDown={e => { if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveFile(); } }}
        />
        <div style={{ padding: "4px 16px", fontSize: 11, color: "var(--text-3)", background: "var(--surface-1)", borderTop: "1px solid var(--border-0)", display: "flex", gap: 16 }}>
          <span>{editContent.split("\n").length} lines</span>
          <span>{editContent.length} chars</span>
          <span>Ctrl+S to save</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
        <div>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-0)" }}>File Manager</h1>
          <p style={{ fontSize: 13, color: "var(--text-2)", marginTop: 2 }}>Browse and edit your sandbox filesystem</p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowNew("dir")} className="btn btn-secondary btn-sm">+ Folder</button>
          <button onClick={() => setShowNew("file")} className="btn btn-secondary btn-sm">+ File</button>
          <button onClick={() => load()} className="btn btn-ghost btn-sm">↺</button>
        </div>
      </div>

      {msg.text && (
        <div className={`alert ${msg.type === "ok" ? "alert-green" : "alert-red"}`} style={{ marginBottom: 12, flexShrink: 0 }}>
          {msg.type === "ok" ? "✓" : "⚠"} {msg.text}
        </div>
      )}

      {/* Breadcrumbs */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 12, flexShrink: 0, flexWrap: "wrap" }}>
        {breadcrumbs.map((b, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {i > 0 && <span style={{ color: "var(--text-3)", fontSize: 12 }}>/</span>}
            <button onClick={() => navigate(b.path)} style={{ background: "none", border: "none", color: i === breadcrumbs.length - 1 ? "var(--text-0)" : "var(--brand-light)", fontSize: 13, cursor: "pointer", fontWeight: i === breadcrumbs.length - 1 ? 600 : 400, padding: "2px 4px", borderRadius: "var(--r-xs)" }}
              onMouseEnter={e => { if (i < breadcrumbs.length-1) (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)"; }}
              onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = "none"}>
              {b.label}
            </button>
          </span>
        ))}
      </div>

      {/* New item input */}
      {showNew && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexShrink: 0 }}>
          <input className="input" style={{ maxWidth: 300 }} value={newName} onChange={e => setNewName(e.target.value)}
            placeholder={showNew === "dir" ? "Folder name" : "File name"} autoFocus
            onKeyDown={e => { if (e.key === "Enter") doCreate(); if (e.key === "Escape") setShowNew(null); }} />
          <button onClick={doCreate} className="btn btn-primary btn-sm" disabled={creating}>{creating ? "…" : "Create"}</button>
          <button onClick={() => { setShowNew(null); setNewName(""); }} className="btn btn-ghost btn-sm">Cancel</button>
        </div>
      )}

      {/* Rename modal */}
      {renaming && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setRenaming(null); }}>
          <div className="modal">
            <h3 className="modal-title">Rename "{renaming.name}"</h3>
            <div className="form-group"><label className="form-label">New name</label>
              <input className="input" value={renameTo} onChange={e => setRenameTo(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === "Enter") doRename(); if (e.key === "Escape") setRenaming(null); }} />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setRenaming(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={doRename}>Rename</button>
            </div>
          </div>
        </div>
      )}

      {/* File list */}
      <div className="card" style={{ flex: 1, overflow: "auto" }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: 8 }}>
            {[1,2,3,4,5].map(i => <div key={i} className="shimmer-box" style={{ height: 40 }} />)}
          </div>
        ) : entries.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "var(--text-2)" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>📂</div>
            <p>Empty directory</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th><th>Size</th><th>Modified</th><th>Permissions</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {path !== "/root" && (
                <tr style={{ cursor: "pointer" }} onClick={up}>
                  <td colSpan={5} style={{ color: "var(--text-2)", fontSize: 13 }}>
                    <span style={{ fontFamily: "var(--font-mono)" }}>../</span>
                    <span style={{ color: "var(--text-3)", fontSize: 11, marginLeft: 8 }}>Parent directory</span>
                  </td>
                </tr>
              )}
              {[...entries.filter(e => e.isDir), ...entries.filter(e => !e.isDir)].map(entry => (
                <tr key={entry.name}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{fileIcon(entry)}</span>
                      <span
                        style={{ color: entry.isDir ? "var(--brand-light)" : "var(--text-0)", fontWeight: entry.isDir ? 500 : 400, cursor: "pointer", fontSize: 13 }}
                        onClick={() => entry.isDir ? navigate(entry.path) : openFile(entry)}
                        onMouseEnter={e => (e.currentTarget as HTMLSpanElement).style.textDecoration = "underline"}
                        onMouseLeave={e => (e.currentTarget as HTMLSpanElement).style.textDecoration = "none"}
                      >
                        {entry.name}
                      </span>
                      {entry.isLink && <span className="badge badge-muted" style={{ fontSize: 10 }}>link</span>}
                    </div>
                  </td>
                  <td style={{ fontSize: 12, color: "var(--text-2)", fontFamily: "var(--font-mono)" }}>{entry.isDir ? "—" : formatSize(entry.size)}</td>
                  <td style={{ fontSize: 12, color: "var(--text-2)" }}>{formatTime(entry.mtime)}</td>
                  <td style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-3)" }}>{entry.perms}</td>
                  <td>
                    <div style={{ display: "flex", gap: 4 }}>
                      {!entry.isDir && CODE_EXTS.has(entry.name.split(".").pop()?.toLowerCase() || "") && (
                        <button className="btn btn-secondary btn-sm" onClick={() => openFile(entry)}>Edit</button>
                      )}
                      <button className="btn btn-ghost btn-sm" onClick={() => { setRenaming(entry); setRenameTo(entry.name); }}>Rename</button>
                      <button className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Delete "${entry.name}"?`)) api("delete", { path: entry.path }); }}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-3)", flexShrink: 0 }}>
        {entries.length} items in {path} · Access limited to /root, /home, /tmp, /workspace
      </div>
    </div>
  );
}
