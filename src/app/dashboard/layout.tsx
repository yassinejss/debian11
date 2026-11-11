import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import DashboardShell from "@/components/layout/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return (
    <DashboardShell username={session.username} isAdmin={session.isAdmin}>
      {children}
    </DashboardShell>
  );
}
