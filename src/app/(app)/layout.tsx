import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import { getDashboardData } from "@/lib/dashboard/queries";

/**
 * No auth gate here (Project Aurora Phase 1: the app is a public shell —
 * see supabase/migrations/0003_trips.sql and src/lib/host/). Google sign-in
 * is optional and only required by Gmail-derived pages, each of which
 * checks its own session and shows a ConnectGoogleNotice when absent.
 *
 * getDashboardData is React-cache()'d (see lib/dashboard/queries.ts), so
 * calling it here for the sidebar's badge counts/search index and again in
 * each page's own render doesn't double the underlying Supabase/Gmail
 * calls — same request, same memoized result.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const data = await getDashboardData(email);

  return (
    <AppShell user={session?.user ?? null} data={data}>
      {children}
    </AppShell>
  );
}
