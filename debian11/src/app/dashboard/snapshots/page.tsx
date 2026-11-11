import { getServerSession } from "@/lib/auth"; import { redirect } from "next/navigation"; import SnapshotsPage from "@/components/SnapshotsPage";
export const metadata = { title: "Snapshots · DWT" };
export default async function Page() { const s = await getServerSession(); if (!s) redirect("/login"); return <SnapshotsPage />; }
