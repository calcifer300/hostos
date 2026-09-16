import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ModuleOff } from "@/components/dashboard/module-off";
import { assembleDashboard } from "@/lib/dashboard/assemble";

export const metadata: Metadata = { title: "Barbershop dashboard" };

/** Barbershops: today's chairs, no-shows, rebooking reminders, revenue per barber. */
export default async function SalonDashboardPage() {
  const page = await assembleDashboard("salon");
  if (!page.modules.includes("salon")) return <ModuleOff module="salon" />;
  return <DashboardGrid scope="salon" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
