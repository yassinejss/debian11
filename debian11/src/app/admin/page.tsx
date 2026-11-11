import { redirect } from "next/navigation"; import { getServerSession } from "@/lib/auth"; import AdminDashboard from "@/components/AdminDashboard";
export default async function Page() {
  const s = await getServerSession();
  if (!s) redirect("/login");
  if (!s.isAdmin) redirect("/dashboard/terminal");
  return <AdminDashboard username={s.username} />;
}
