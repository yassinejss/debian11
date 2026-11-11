"use client";

/**
 * MultiTerminal — Multi-tab terminal workspace
 *
 * Architecture:
 * - Each tab gets an iframe pointing to the ttyd URL
 * - ttyd spawns a fresh bash -l per connection
 * - Tabs are independent shell sessions sharing the same filesystem
 * - The sandbox URL is fetched once and reused (same session reconnect)
 * - Split panes use CSS flex + drag resize
 */

import { useState, useEffect, useCallback, useRef, useId } from "react";

interface Tab {
  id: string;
  label: string;
  url: string;
  loaded: boolean;
  pane: "left" | "right";
  createdAt: number;
}

interface Props {
  initialUrl: string;
  username: string;
  onReconnect?: () => Promise<string>;
}

type SplitMode = "none" | "horizontal" | "vertical";

let tabCounter = 1;

function TerminalPane({ tabs, activeId, onActivate, onClose, url }: {
  tabs: Tab[];
  activeId: string;
  onActivate: (id: string) => void;
  onClose: (id: string) => void;
  url: string;
}) {
  const [loaded, setLoaded] = useState<Record<string, boolean>>({});
  const [timedOut, setTimedOut] = useState<Record<string, boolean>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    // Start timeout for each tab
    tabs.forEach(tab => {
      if (!loaded[tab.id] && !timedOut[tab.id] && !timers.current[tab.id]) {
        timers.current[tab.id] = setTimeout(() => {
          setTimedOut(prev => ({ ...prev, [tab.id]: true }));
        }, 35000);
      }
    });
    return () => {
      Object.values(timers.current).forEach(clearTimeout);
    };
  }, [tabs]);

  const handleLoad = (tabId: string) => {
    clearTimeout(timers.current[tabId]);
    setLoaded(prev => ({ ...prev, [tabId]: true }));
    setTimedOut(prev => ({ ...prev, [tabId]: false }));
  };

  const activeTab = tabs.find(t => t.id === activeId) || tabs[0];
  if (!activeTab) return null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      {/* Tab bar */}
      <div className="terminal-toolbar">
        <div className="terminal-tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`terminal-tab${tab.id === activeId ? " active" : ""}`}
              onClick={() => onActivate(tab.id)}
            >
              <span style={{
                width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
                background: loaded[tab.id] ? "var(--green)" : timedOut[tab.id] ? "var(--red)" : "var(--yellow)",
                animation: !loaded[tab.id] && !timedOut[tab.id] ? "pulse 1.2s ease-in-out infinite" : "none",
              }} />
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{tab.label}</span>
              {tabs.length > 1 && (
                <span className="close" onClick={e => { e.stopPropagation(); onClose(tab.id); }}>✕</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Iframe stack */}
      {tabs.map(tab => (
        <div key={tab.id} style={{
          position: "absolute", inset: 0, top: 36,
          display: tab.id === activeId ? "flex" : "none",
          flexDirection: "column",
        }}>
          {/* Connecting overlay */}
          {!loaded[tab.id] && !timedOut[tab.id] && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 10,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              gap: "1rem", background: "var(--term-bg)",
            }}>
              <div style={{ width: 36, height: 36, border: "2.5px solid var(--surface-4)", borderTopColor: "var(--brand)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ textAlign: "center" }}>
                <p style={{ color: "var(--text-1)", fontSize: 13, fontFamily: "var(--font-mono)" }}>Connecting to shell…</p>
                <p style={{ color: "var(--text-3)", fontSize: 11, marginTop: 4 }}>Resuming previous session</p>
              </div>
            </div>
          )}

          {timedOut[tab.id] && (
            <div style={{
              position: "absolute", inset: 0, zIndex: 10,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "var(--term-bg)",
            }}>
              <div style={{ textAlign: "center", maxWidth: 300 }}>
                <div style={{ fontSize: "1.75rem", marginBottom: 8 }}>⏱</div>
                <p style={{ color: "var(--red)", fontWeight: 600, marginBottom: 6 }}>Connection timeout</p>
                <p style={{ color: "var(--text-2)", fontSize: 12 }}>ttyd didn&apos;t respond. Try reconnecting.</p>
              </div>
            </div>
          )}

          <iframe
            src={tab.url}
            onLoad={() => handleLoad(tab.id)}
            style={{ flex: 1, border: "none", background: "var(--term-bg)", display: "block" }}
            title={tab.label}
            allow="clipboard-read; clipboard-write"
          />
        </div>
      ))}
    </div>
  );
}

export default function MultiTerminal({ initialUrl, username, onReconnect }: Props) {
  const [tabs, setTabs] = useState<Tab[]>([{
    id: "tab-1",
    label: `Shell 1`,
    url: initialUrl,
    loaded: false,
    pane: "left",
    createdAt: Date.now(),
  }]);
  const [activeId, setActiveId] = useState("tab-1");
  const [splitMode, setSplitMode] = useState<SplitMode>("none");
  const [activeRight, setActiveRight] = useState("");
  const [splitRatio, setSplitRatio] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [fontSize, setFontSize] = useState(14);

  const leftTabs = tabs.filter(t => t.pane === "left");
  const rightTabs = tabs.filter(t => t.pane === "right");

  const addTab = async (pane: "left" | "right" = "left") => {
    const id = `tab-${++tabCounter}`;
    const label = `Shell ${tabCounter}`;
    // For new tabs: use the same sandbox URL — ttyd creates independent shells per connection
    setTabs(prev => [...prev, { id, label, url: initialUrl, loaded: false, pane, createdAt: Date.now() }]);
    if (pane === "left") setActiveId(id);
    else setActiveRight(id);
  };

  const closeTab = (tabId: string) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== tabId);
      // If we closed the active tab, switch to nearest
      if (tabId === activeId && remaining.filter(t => t.pane === "left").length > 0) {
        setActiveId(remaining.filter(t => t.pane === "left").at(-1)!.id);
      }
      if (tabId === activeRight && remaining.filter(t => t.pane === "right").length > 0) {
        setActiveRight(remaining.filter(t => t.pane === "right").at(-1)!.id);
      }
      return remaining;
    });
  };

  const addSplit = async (dir: "horizontal" | "vertical") => {
    setSplitMode(dir);
    const id = `tab-${++tabCounter}`;
    setTabs(prev => [...prev, { id, label: `Shell ${tabCounter}`, url: initialUrl, loaded: false, pane: "right", createdAt: Date.now() }]);
    setActiveRight(id);
  };

  const removeSplit = () => {
    setSplitMode("none");
    setTabs(prev => prev.filter(t => t.pane !== "right"));
    setActiveRight("");
  };

  const reconnect = async () => {
    if (!onReconnect) return;
    setReconnecting(true);
    try {
      const newUrl = await onReconnect();
      setTabs(prev => prev.map(t => ({ ...t, url: newUrl, loaded: false })));
    } finally {
      setReconnecting(false);
    }
  };

  // Drag resize
  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const move = (ev: MouseEvent) => {
      const ratio = splitMode === "horizontal"
        ? ((ev.clientX - rect.left) / rect.width) * 100
        : ((ev.clientY - rect.top) / rect.height) * 100;
      setSplitRatio(Math.min(80, Math.max(20, ratio)));
    };
    const up = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  const renameTab = (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    const name = prompt("Rename tab:", tab.label);
    if (name?.trim()) {
      setTabs(prev => prev.map(t => t.id === tabId ? { ...t, label: name.trim() } : t));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "var(--term-bg)", overflow: "hidden" }}>
      {/* Workspace toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 10px", height: 40, flexShrink: 0,
        background: "var(--surface-1)", borderBottom: "1px solid var(--border-0)",
      }}>
        {/* Left: breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "var(--text-2)" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <span style={{ color: "var(--text-1)", fontWeight: 500 }}>{username}@debian</span>
          <span style={{ color: "var(--text-3)" }}>·</span>
          <span>{tabs.length} shell{tabs.length > 1 ? "s" : ""}</span>
        </div>

        {/* Right: actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {/* Font size */}
          <button onClick={() => setFontSize(s => Math.max(10, s - 1))} className="btn btn-ghost btn-sm btn-icon" title="Decrease font size">A−</button>
          <span style={{ fontSize: 11, color: "var(--text-2)", minWidth: 24, textAlign: "center" }}>{fontSize}</span>
          <button onClick={() => setFontSize(s => Math.min(24, s + 1))} className="btn btn-ghost btn-sm btn-icon" title="Increase font size">A+</button>

          <div style={{ width: 1, height: 18, background: "var(--border-0)", margin: "0 4px" }} />

          {/* New tab */}
          <button onClick={() => addTab("left")} className="btn btn-ghost btn-sm" title="New shell tab (same pane)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Shell
          </button>

          {/* Split */}
          {splitMode === "none" ? (
            <>
              <button onClick={() => addSplit("horizontal")} className="btn btn-ghost btn-sm" title="Split horizontally (side by side)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="12" y1="3" x2="12" y2="21"/></svg>
                Split ⇔
              </button>
              <button onClick={() => addSplit("vertical")} className="btn btn-ghost btn-sm" title="Split vertically (top/bottom)">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="1"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
                Split ⇕
              </button>
            </>
          ) : (
            <button onClick={removeSplit} className="btn btn-ghost btn-sm">Remove Split</button>
          )}

          <div style={{ width: 1, height: 18, background: "var(--border-0)", margin: "0 4px" }} />

          <button onClick={reconnect} className="btn btn-ghost btn-sm" disabled={reconnecting} title="Reconnect all terminals">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ animation: reconnecting ? "spin 0.8s linear infinite" : "none" }}>
              <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/>
            </svg>
            {reconnecting ? "Reconnecting…" : "Reconnect"}
          </button>
        </div>
      </div>

      {/* Terminal workspace */}
      <div
        ref={containerRef}
        style={{
          flex: 1, display: "flex", overflow: "hidden", position: "relative",
          flexDirection: splitMode === "vertical" ? "column" : "row",
          userSelect: isDragging ? "none" : "auto",
        }}
      >
        {/* Left/top pane */}
        <div style={{
          display: "flex", flexDirection: "column", overflow: "hidden",
          flex: splitMode === "none" ? 1 : undefined,
          width: splitMode === "horizontal" ? `${splitRatio}%` : "100%",
          height: splitMode === "vertical" ? `${splitRatio}%` : "100%",
        }}>
          <TerminalPane
            tabs={leftTabs}
            activeId={activeId}
            onActivate={setActiveId}
            onClose={closeTab}
            url={initialUrl}
          />
          {/* Add tab button at bottom of left pane */}
          <button
            onClick={() => addTab("left")}
            style={{
              height: 24, flexShrink: 0,
              background: "var(--surface-2)", border: "none",
              borderTop: "1px solid var(--border-0)",
              color: "var(--text-3)", fontSize: 11,
              cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 4,
              transition: "all var(--t-fast)",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
          >
            + New Shell
          </button>
        </div>

        {/* Divider */}
        {splitMode !== "none" && (
          <div
            onMouseDown={startDrag}
            style={{
              flexShrink: 0,
              width: splitMode === "horizontal" ? 4 : "100%",
              height: splitMode === "vertical" ? 4 : "100%",
              background: isDragging ? "var(--brand)" : "var(--border-0)",
              cursor: splitMode === "horizontal" ? "col-resize" : "row-resize",
              transition: "background var(--t-fast)",
              zIndex: 10,
            }}
            onMouseEnter={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = "var(--border-2)"; }}
            onMouseLeave={e => { if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = "var(--border-0)"; }}
          />
        )}

        {/* Right/bottom pane */}
        {splitMode !== "none" && rightTabs.length > 0 && (
          <div style={{
            display: "flex", flexDirection: "column", overflow: "hidden",
            flex: 1,
          }}>
            <TerminalPane
              tabs={rightTabs}
              activeId={activeRight || rightTabs[0].id}
              onActivate={setActiveRight}
              onClose={closeTab}
              url={initialUrl}
            />
            <button
              onClick={() => addTab("right")}
              style={{
                height: 24, flexShrink: 0,
                background: "var(--surface-2)", border: "none",
                borderTop: "1px solid var(--border-0)",
                color: "var(--text-3)", fontSize: 11,
                cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 4,
                transition: "all var(--t-fast)",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-3)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--surface-2)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-3)"; }}
            >
              + New Shell
            </button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <div className="status-item">
          <span className="status-dot" style={{ background: "var(--green)", boxShadow: "0 0 4px var(--green)" }} />
          Debian 11 Bullseye
        </div>
        <div className="status-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
          bash
        </div>
        <div className="status-item">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
          {tabs.length} session{tabs.length > 1 ? "s" : ""}
        </div>
        <div className="status-item" style={{ marginLeft: "auto" }}>
          Font {fontSize}px
        </div>
        <div className="status-item">
          {splitMode !== "none" ? `${splitMode} split` : "single pane"}
        </div>
      </div>
    </div>
  );
}
