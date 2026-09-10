import { auth } from "@/auth";
import { AppShell } from "@/components/shell/app-shell";
import type { BackendStatusView } from "@/components/shell/backend-status-banner";
import { getDashboardData } from "@/lib/dashboard/queries";
import { getHost } from "@/lib/host/queries";
import { getUserRoles } from "@/lib/roles/queries";
import { getBackendHealth } from "@/lib/supabase/server";
import { getCurrentHostId, getFleetsForUser } from "@/lib/host/context";

/**
 * The app was built as a public shell (Project Aurora Phase 1) — Companion
 * data is host_id-keyed and needs no Google account, so every route rendered
 * signed-out. That still holds when running locally.
 *
 * A hosted deployment is gated instead (see lib/access.ts): the dashboard
 * carries guest names, message threads, licence status and plates, which must
 * not be readable by anyone who has the URL. Gmail-derived pages additionally
 * check their own session and show a ConnectGoogleNotice when absent.
 *
 * getDashboardData and getHost are React-cache()'d, so reading them here for
 * the sidebar's badge counts and fleet name, and again inside each page's own
 * render, doesn't double the underlying Supabase calls — same request, same
 * memoized result.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;


  // Every one of these is total: they resolve to empty values rather than
  // rejecting, so Promise.all can't turn one degraded data source into a
  // failed render for the whole shell.
  const hostId = await getCurrentHostId();
  const [data, host, roles, fleets] = await Promise.all([
    getDashboardData(email),
    getHost(hostId),
    getUserRoles(email),
    getFleetsForUser(email),
  ]);

  // Read *after* the queries above, so it reflects this render's outcomes.
  // Only the two fields the banner needs cross to the client — a failure's
  // reason/hint stays in the server log where it belongs.
  const health = getBackendHealth();
  const backendStatus: BackendStatusView = {
    state: health.state,
    kind: health.failure?.kind ?? null,
  };

  return (
    <AppShell
      user={session?.user ?? null}
      data={data}
      fleetName={host?.name ?? null}
      roles={roles}
      backendStatus={backendStatus}
      currentHostId={hostId}
      fleets={fleets.map((f) => ({
        hostId: f.hostId,
        // The switcher needs something to render for every row; fall back
        // through name, then slug, then a short id rather than showing blank.
        name: f.name ?? f.slug ?? `Fleet ${f.hostId.slice(0, 8)}`,
        role: f.role,
      }))}
    >
      {children}
    </AppShell>
  );
}
