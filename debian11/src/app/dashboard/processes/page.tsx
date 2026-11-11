import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ProcessManager from "@/components/ProcessManager";
export const metadata = { title: "Processes · DWT" };
export default async function Page() {
  const session = await getServerSession();
  if (!session) redirect("/login");
  return <ProcessManager />;
}
