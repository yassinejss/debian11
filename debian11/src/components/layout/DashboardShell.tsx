"use client";
import { useEffect, useState } from "react";
import Sidebar from "./Sidebar";
import CommandPalette from "./CommandPalette";

interface Props { username: string; isAdmin: boolean; children: React.ReactNode; }

export default function DashboardShell({ username, isAdmin, children }: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [sandboxStatus, setSandboxStatus] = useState("unknown");
  const [runningProcesses, setRunningProcesses] = useState(0);

  useEffect(() => {
    const pollSandbox = async () => {
      try { const r = await fetch("/api/sandbox", { credentials: "include" }); if(r.ok){const d=await r.json(); setSandboxStatus(d.status?.status ?? "unknown");} } catch {}
    };
    pollSandbox();
    const i = setInterval(pollSandbox, 60000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const pollProcs = async () => {
      try { const r = await fetch("/api/processes", { credentials: "include" }); if(r.ok){const d=await r.json(); setRunningProcesses((d.processes??[]).filter((p:{status:string})=>p.status==="running").length);} } catch {}
    };
    pollProcs();
    const i = setInterval(pollProcs, 30000);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey||e.ctrlKey) && e.key==="k") { e.preventDefault(); setPaletteOpen(true); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return (
    <div className="app-layout">
      <Sidebar username={username} isAdmin={isAdmin} sandboxStatus={sandboxStatus} runningProcesses={runningProcesses} onCommandPalette={() => setPaletteOpen(true)} />
      <div className="app-main">
        <div className="app-content">{children}</div>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
