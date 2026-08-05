import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";

/**
 * No auth gate here (Project Aurora Phase 1: the app is a public shell —
 * see supabase/migrations/0003_trips.sql and src/lib/host/). Google sign-in
 * is optional and only required by Gmail-derived pages, each of which
 * checks its own session and shows a ConnectGoogleNotice when absent.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return <AppShell user={session?.user ?? null}>{children}</AppShell>;
}
