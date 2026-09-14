import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { assembleDashboard } from "@/lib/dashboard/assemble";
import { acceptInvitation } from "@/lib/actions/members";

/**
 * Home: every line of business at a glance — one card per business with a
 * link to its own dashboard — plus the work that cuts across them (tasks,
 * notifications, the Butler's briefing, recent events).
 */
export default async function Home() {
  const page = await assembleDashboard("home");

  // Someone opening a workspace they were invited to: record it (best effort).
  if (page.signedIn) void acceptInvitation();

  return <DashboardGrid scope="home" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
