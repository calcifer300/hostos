import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ModuleOff } from "@/components/dashboard/module-off";
import { assembleDashboard } from "@/lib/dashboard/assemble";

export const metadata: Metadata = { title: "Coffee shop dashboard" };

/** Coffee shops: sales, stock, shifts and the routines that open and close the shop. */
export default async function CafeDashboardPage() {
  const page = await assembleDashboard("cafe");
  if (!page.modules.includes("cafe")) return <ModuleOff module="cafe" />;
  return <DashboardGrid scope="cafe" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
