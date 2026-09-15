import type { Metadata } from "next";
import { DashboardGrid } from "@/components/dashboard/dashboard-grid";
import { ModuleOff } from "@/components/dashboard/module-off";
import { assembleDashboard } from "@/lib/dashboard/assemble";

export const metadata: Metadata = { title: "Web dashboard" };

/** Websites & Domains: every site and domain, uptime, SSL and renewals — whatever the registrar. */
export default async function WebDashboardPage() {
  const page = await assembleDashboard("web");
  if (!page.modules.includes("web")) return <ModuleOff module="web" />;
  return <DashboardGrid scope="web" firstName={page.firstName} setup={page.setup} modules={page.modules} initialLayout={page.layout} data={page.data} signedIn={page.signedIn} />;
}
