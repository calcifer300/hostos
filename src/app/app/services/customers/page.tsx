import type { Metadata } from "next";
import { ModuleOff } from "@/components/dashboard/module-off";
import { CustomersList } from "@/components/services/customers";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getCustomers, getJobs } from "@/lib/services/queries";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage() {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const hostId = await getCurrentHostId();
  const [customers, jobs, canEdit] = await Promise.all([getCustomers(hostId), getJobs(hostId), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-5xl">
      <ServicesPageHeader title="Customers" description="Leads and customers with their addresses, history and every call, text and note on one timeline." />
      <CustomersList customers={customers} jobs={jobs} canEdit={canEdit} />
    </div>
  );
}
