"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface PaletteItem {
  id: string;
  label: string;
  section: string;
  href?: string;
  action?: () => void;
  icon?: string;
  kbd?: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

const STATIC_ITEMS: PaletteItem[] = [
  { id: "terminal",  label: "Open Terminal",        section: "Navigation", href: "/dashboard/terminal",  icon: "⌨", kbd: "T" },
  { id: "processes", label: "Process Manager",      section: "Navigation", href: "/dashboard/processes", icon: "⚙" },
  { id: "files",     label: "File Manager",         section: "Navigation", href: "/dashboard/files",     icon: "📁" },
  { id: "minecraft", label: "Minecraft Manager",    section: "Navigation", href: "/dashboard/minecraft",  icon: "🎮" },
  { id: "snapshots", label: "Workspace Snapshots",  section: "Navigation", href: "/dashboard/snapshots", icon: "💾" },
  { id: "system",    label: "System Monitor",       section: "Navigation", href: "/dashboard/system",    icon: "📊" },
  { id: "network",   label: "Network Diagnostics",  section: "Navigation", href: "/dashboard/network",   icon: "🌐" },
  { id: "security",  label: "Security & Audit",     section: "Navigation", href: "/dashboard/security",  icon: "🔒" },
  { id: "settings",  label: "Settings",             section: "Navigation", href: "/dashboard/settings",  icon: "⚙️" },
  { id: "admin",     label: "Admin Dashboard",      section: "Admin",      href: "/admin",               icon: "👤" },
];

export default function CommandPalette({ open, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowDown") setSelected(s => Math.min(s + 1, filtered.length - 1));
      if (e.key === "ArrowUp") setSelected(s => Math.max(s - 1, 0));
      if (e.key === "Enter") {
        const item = filtered[selected];
        if (item) execute(item);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const filtered = STATIC_ITEMS.filter(item =>
    !query || item.label.toLowerCase().includes(query.toLowerCase()) || item.section.toLowerCase().includes(query.toLowerCase())
  );

  const execute = (item: PaletteItem) => {
    if (item.href) router.push(item.href);
    if (item.action) item.action();
    onClose();
  };

  if (!open) return null;

  const sections = [...new Set(filtered.map(i => i.section))];

  return (
    <div className="palette-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="palette">
        <div className="palette-input-row">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="palette-input"
            placeholder="Type a command or search…"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelected(0); }}
          />
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", fontSize: 11, padding: "2px 6px", borderRadius: 4, fontFamily: "var(--font-mono)",  }}>
            ESC
          </button>
        </div>
        <div className="palette-results">
          {filtered.length === 0 ? (
            <div className="palette-empty">No results for "{query}"</div>
          ) : (
            sections.map(section => (
              <div key={section}>
                <div className="palette-section">{section}</div>
                {filtered.filter(i => i.section === section).map((item, idx) => {
                  const globalIdx = filtered.indexOf(item);
                  return (
                    <div
                      key={item.id}
                      className={`palette-item${globalIdx === selected ? " selected" : ""}`}
                      onClick={() => execute(item)}
                      onMouseEnter={() => setSelected(globalIdx)}
                    >
                      <div className="palette-item-icon">{item.icon}</div>
                      <span>{item.label}</span>
                      {item.kbd && <span className="palette-kbd">{item.kbd}</span>}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
        <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border-0)", display: "flex", gap: 12, fontSize: 11, color: "var(--text-3)" }}>
          <span>↑↓ navigate</span><span>↵ open</span><span>ESC close</span>
        </div>
      </div>
    </div>
  );
}
