import type { Metadata } from "next";
import { ModuleOff } from "@/components/dashboard/module-off";
import { DispatchBoard } from "@/components/services/dispatch-board";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getCustomers, getJobs, getServiceSettings, getStaff } from "@/lib/services/queries";

export const metadata: Metadata = { title: "Dispatch" };

export default async function DispatchPage() {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const hostId = await getCurrentHostId();
  const [jobs, staff, customers, settings, canEdit] = await Promise.all([getJobs(hostId), getStaff(hostId), getCustomers(hostId), getServiceSettings(hostId), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <ServicesPageHeader title="Dispatch board" description="Every open job by status. Change the technician or the status on a card to move it; the board answers instantly and the customer's timeline records it." />
      <DispatchBoard jobs={jobs} staff={staff} customers={customers} catalog={settings?.catalog ?? []} canEdit={canEdit} />
    </div>
  );
}
