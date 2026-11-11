import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import SettingsPage from "@/components/SettingsPage";
export const metadata = { title: "Settings · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <SettingsPage />; }
