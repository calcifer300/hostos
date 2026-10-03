import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginScreen } from "@/components/auth/login-screen";
import { safeAppRedirect } from "@/lib/routes";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string; email?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl = safeAppRedirect(params.callbackUrl);

  const session = await auth();
  if (session?.user) redirect(callbackUrl);

  return <LoginScreen callbackUrl={callbackUrl} error={params.error ?? null} deniedEmail={params.email ?? null} />;
}
