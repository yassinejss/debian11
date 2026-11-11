import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import MinecraftPage from "@/components/MinecraftPage";
export const metadata = { title: "Minecraft · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <MinecraftPage />; }
