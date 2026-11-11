import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import SystemMonitor from "@/components/SystemMonitor";
export const metadata = { title: "System Monitor · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <SystemMonitor />; }
