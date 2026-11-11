import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import TerminalPage from "@/components/terminal/TerminalPage";
export const metadata = { title: "Terminal · DWT" };
export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return <TerminalPage username={session.username} />;
}
