import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { assembleDashboard } from "@/lib/dashboard/assemble";
import { acceptInvitation } from "@/lib/actions/members";

import type { Metadata } from "next";

export const metadata: Metadata = { title: "All businesses" };

/**
 * All businesses: every line of business the workspace runs, at a glance —
 * one card per business with a link to its own dashboard — plus the work
 * that cuts across them (tasks, notifications, the Butler's briefing, recent
 * events). Deliberately the only page that mixes verticals; /app itself
 * opens the vertical you chose.
 */
export default async function OverviewPage() {
  const page = await assembleDashboard("home");

  // Someone opening a workspace they were invited to: record it (best effort).
  if (page.signedIn) void acceptInvitation();

  return <DashboardGrid scope="home" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
