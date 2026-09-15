import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ModuleOff } from "@/components/dashboard/module-off";
import { assembleDashboard } from "@/lib/dashboard/assemble";
import { verticalAccess } from "@/lib/host/context";

export const metadata: Metadata = { title: "Service dashboard" };

/** Service Businesses: today's jobs, dispatch, estimates, the team and the month's numbers. */
export default async function ServicesDashboardPage() {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const page = await assembleDashboard("services");
  return <DashboardGrid scope="services" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
