import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import LoginPage from "@/components/LoginPage";
export const metadata = { title: "Sign In · DWT" };
export default async function Page() {
  const session = await getServerSession();
  if (session) redirect("/dashboard/terminal");
  return <LoginPage />;
}
