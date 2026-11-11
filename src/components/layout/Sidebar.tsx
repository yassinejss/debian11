"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string | number;
  section?: string;
}

interface Props {
  username: string;
  isAdmin: boolean;
  sandboxStatus?: string;
  runningProcesses?: number;
  onCommandPalette?: () => void;
}

function Icon({ d, ...rest }: { d: string; [k: string]: unknown }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      <path d={d} />
    </svg>
  );
}

function NavIcon({ children }: { children: React.ReactNode }) {
  return <span style={{ width: 15, height: 15, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{children}</span>;
}

export default function Sidebar({ username, isAdmin, sandboxStatus = "unknown", runningProcesses = 0, onCommandPalette }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const stored = localStorage.getItem("dwt-theme") as "dark" | "light" | null;
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute("data-theme", stored);
    }
  }, []);

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("dwt-theme", next);
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    router.push("/login");
  };

  const isActive = (href: string) => {
    if (href === "/dashboard/terminal") return pathname.startsWith("/dashboard/terminal") || pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const navGroups: Array<{ section?: string; items: NavItem[] }> = [
    {
      items: [
        {
          label: "Terminal",
          href: "/dashboard/terminal",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          ),
        },
      ],
    },
    {
      section: "Tools",
      items: [
        {
          label: "Processes",
          href: "/dashboard/processes",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
            </svg>
          ),
          badge: runningProcesses > 0 ? runningProcesses : undefined,
        },
        {
          label: "Files",
          href: "/dashboard/files",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          ),
        },
        {
          label: "Snapshots",
          href: "/dashboard/snapshots",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          ),
        },
        {
          label: "Minecraft",
          href: "/dashboard/minecraft",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="20" rx="2"/><path d="M9 9h6v6H9z"/>
            </svg>
          ),
        },
      ],
    },
    {
      section: "Monitor",
      items: [
        {
          label: "System",
          href: "/dashboard/system",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
          ),
        },
        {
          label: "Network",
          href: "/dashboard/network",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
          ),
        },
        {
          label: "Activity",
          href: "/dashboard/security",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              <polyline points="9 12 11 14 15 10"/>
            </svg>
          ),
        },
      ],
    },
    ...(isAdmin ? [{
      section: "Admin",
      items: [{
        label: "Dashboard",
        href: "/admin",
        icon: (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        ),
      }],
    }] : []),
    {
      section: "Account",
      items: [
        {
          label: "Settings",
          href: "/dashboard/settings",
          icon: (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          ),
        },
      ],
    },
  ];

  const statusColor = sandboxStatus === "running" ? "var(--green)" : sandboxStatus === "starting" ? "var(--yellow)" : "var(--text-3)";

  if (collapsed) {
    return (
      <div style={{
        width: 52, flexShrink: 0,
        background: "var(--surface-1)", borderRight: "1px solid var(--border-0)",
        display: "flex", flexDirection: "column", alignItems: "center",
        padding: "8px 0", gap: 4,
      }}>
        <button onClick={() => setCollapsed(false)} title="Expand sidebar"
          style={{ width: 36, height: 36, borderRadius: "var(--r-md)", background: "var(--surface-3)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-1)", cursor: "pointer", marginBottom: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
        {navGroups.flatMap(g => g.items).map(item => (
          <a key={item.href} href={item.href}
            data-tooltip={item.label}
            style={{
              width: 36, height: 36, borderRadius: "var(--r-md)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: isActive(item.href) ? "var(--brand-light)" : "var(--text-2)",
              background: isActive(item.href) ? "var(--brand-muted)" : "transparent",
              textDecoration: "none", transition: "all var(--t-fast)",
            }}
            onMouseEnter={e => { if (!isActive(item.href)) (e.currentTarget as HTMLAnchorElement).style.background = "var(--surface-3)"; }}
            onMouseLeave={e => { if (!isActive(item.href)) (e.currentTarget as HTMLAnchorElement).style.background = "transparent"; }}
          >
            <span style={{ width: 16, height: 16 }}>{item.icon}</span>
          </a>
        ))}
      </div>
    );
  }

  return (
    <div className="sidebar">
      {/* Logo / header */}
      <div style={{
        height: "var(--header-h)", flexShrink: 0, display: "flex", alignItems: "center",
        padding: "0 12px", gap: 8, borderBottom: "1px solid var(--border-0)",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7,
            background: "linear-gradient(135deg, #7c3aed, #4f46e5)",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            boxShadow: "0 0 10px rgba(124,58,237,0.4)",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-0)", letterSpacing: "-0.02em" }}>DWT</div>
            <div style={{ fontSize: 10, color: "var(--text-3)", marginTop: -1 }}>Debian 11</div>
          </div>
        </div>
        <button onClick={() => setCollapsed(true)} title="Collapse sidebar"
          style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", padding: 4, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
      </div>

      {/* Command palette button */}
      <div style={{ padding: "8px 8px 4px" }}>
        <button
          onClick={onCommandPalette}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            padding: "5px 8px", borderRadius: "var(--r-md)",
            background: "var(--surface-2)", border: "1px solid var(--border-0)",
            color: "var(--text-2)", fontSize: 12, cursor: "pointer",
            transition: "all var(--t-fast)",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-1)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border-0)"; (e.currentTarget as HTMLButtonElement).style.color = "var(--text-2)"; }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span>Search…</span>
          <span style={{ marginLeft: "auto", fontSize: 10, background: "var(--surface-3)", border: "1px solid var(--border-1)", borderRadius: 4, padding: "1px 4px", fontFamily: "var(--font-mono)" }}>⌘K</span>
        </button>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {navGroups.map((group, gi) => (
          <div key={gi} className="nav-section">
            {group.section && <div className="nav-section-label">{group.section}</div>}
            {group.items.map(item => (
              <a
                key={item.href}
                href={item.href}
                className={`nav-item${isActive(item.href) ? " active" : ""}`}
                style={{ textDecoration: "none" }}
              >
                <NavIcon>{item.icon}</NavIcon>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="nav-badge">{item.badge}</span>
                )}
              </a>
            ))}
          </div>
        ))}
      </nav>

      {/* Bottom: status + user */}
      <div style={{ padding: 8, borderTop: "1px solid var(--border-0)", flexShrink: 0 }}>
        {/* Sandbox status */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7,
          padding: "5px 8px", marginBottom: 4,
          borderRadius: "var(--r-sm)",
          background: "var(--surface-2)", border: "1px solid var(--border-0)",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor, flexShrink: 0,
            boxShadow: sandboxStatus === "running" ? `0 0 5px var(--green)` : "none",
            animation: sandboxStatus === "starting" ? "pulse 1s ease-in-out infinite" : "none",
          }} />
          <span style={{ fontSize: 11, color: "var(--text-2)", flex: 1 }}>Sandbox</span>
          <span style={{ fontSize: 11, color: sandboxStatus === "running" ? "var(--green)" : "var(--text-3)", fontWeight: 500 }}>
            {sandboxStatus === "running" ? "Online" : sandboxStatus === "starting" ? "Starting" : "Offline"}
          </span>
        </div>

        {/* User row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "5px 8px", borderRadius: "var(--r-md)",
        }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #7c3aed, #22d3ee)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700, color: "white",
          }}>
            {username[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-0)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {username}
            </div>
            {isAdmin && <div style={{ fontSize: 10, color: "var(--brand-light)" }}>Administrator</div>}
          </div>
          <div style={{ display: "flex", gap: 2 }}>
            <button onClick={toggleTheme} title={theme === "dark" ? "Light mode" : "Dark mode"}
              style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", padding: 4, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center" }}>
              {theme === "dark" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <button onClick={logout} title="Sign out"
              style={{ background: "none", border: "none", color: "var(--text-2)", cursor: "pointer", padding: 4, borderRadius: "var(--r-sm)", display: "flex", alignItems: "center" }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
