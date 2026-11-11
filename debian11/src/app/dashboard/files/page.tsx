import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import FilesPage from "@/components/FilesPage";
export const metadata = { title: "Files · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <FilesPage />; }
