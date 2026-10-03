import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ModuleOff } from "@/components/dashboard/module-off";
import { assembleDashboard } from "@/lib/dashboard/assemble";

export const metadata: Metadata = { title: "Restaurant dashboard" };

/** The Restaurant dashboard — one line of business, its own widgets and its own saved layout. */
export default async function RestaurantsDashboardPage() {
  const page = await assembleDashboard("restaurants");
  if (!page.modules.includes("restaurants")) return <ModuleOff module="restaurants" />;
  return <DashboardGrid scope="restaurants" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
