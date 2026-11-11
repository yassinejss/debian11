import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import NetworkPage from "@/components/NetworkPage";
export const metadata = { title: "Network · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <NetworkPage />; }
