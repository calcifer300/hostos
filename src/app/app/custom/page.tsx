import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ModuleOff } from "@/components/dashboard/module-off";
import { assembleDashboard } from "@/lib/dashboard/assemble";

export const metadata: Metadata = { title: "Custom dashboard" };

/** Build a custom: the numbers you chose, checklists, and build requests to the Collective. */
export default async function CustomDashboardPage() {
  const page = await assembleDashboard("custom");
  if (!page.modules.includes("custom")) return <ModuleOff module="custom" />;
  return <DashboardGrid scope="custom" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
