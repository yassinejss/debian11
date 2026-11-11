import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import SecurityPage from "@/components/SecurityPage";
export const metadata = { title: "Security · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <SecurityPage />; }
