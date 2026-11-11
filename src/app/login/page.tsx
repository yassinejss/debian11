import { redirect } from "next/navigation";
import { getServerSession } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export const metadata = { title: "Sign In · Debian Terminal" };

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) redirect("/terminal");

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "1.5rem",
      background: "var(--bg-primary)",
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Background grid */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "linear-gradient(var(--border-bright) 1px, transparent 1px), linear-gradient(90deg, var(--border-bright) 1px, transparent 1px)",
        backgroundSize: "40px 40px",
        pointerEvents: "none",
      }} />
      {/* Glow blobs */}
      <div style={{
        position: "absolute", width: 400, height: 400,
        background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)",
        borderRadius: "50%", top: "10%", left: "50%", transform: "translateX(-50%)",
        pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", width: 300, height: 300,
        background: "radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)",
        borderRadius: "50%", bottom: "10%", right: "20%",
        pointerEvents: "none",
      }} />
      <LoginForm />
    </div>
  );
}
