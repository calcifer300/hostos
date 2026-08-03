import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/auth/login-screen";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  return <LoginScreen />;
}
