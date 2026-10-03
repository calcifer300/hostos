import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleOff } from "@/components/dashboard/module-off";
import { CustomerDetail } from "@/components/services/customers";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getCustomer, getEstimates, getEvents, getJobsForCustomer, getProperties, getServiceSettings, getStaff } from "@/lib/services/queries";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const { id } = await params;
  const hostId = await getCurrentHostId();
  const customer = await getCustomer(hostId, id);
  if (!customer) notFound();
  const [properties, jobs, estimates, events, staff, settings, canEdit] = await Promise.all([getProperties(hostId, id), getJobsForCustomer(hostId, id), getEstimates(hostId), getEvents(hostId, { customerId: id }), getStaff(hostId), getServiceSettings(hostId), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <ServicesPageHeader title={customer.name} back={routes.servicesCustomers} backLabel="Customers" />
      <CustomerDetail customer={customer} properties={properties} jobs={jobs} estimates={estimates.filter((e) => e.customerId === id)} events={events} staff={staff} catalog={settings?.catalog ?? []} canEdit={canEdit} />
    </div>
  );
}
