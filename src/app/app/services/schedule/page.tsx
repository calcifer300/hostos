import type { Metadata } from "next";
import { ModuleOff } from "@/components/dashboard/module-off";
import { ScheduleView } from "@/components/services/schedule-view";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getCustomers, getJobs, getServiceSettings, getStaff } from "@/lib/services/queries";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const hostId = await getCurrentHostId();
  const [jobs, staff, customers, settings, canEdit] = await Promise.all([getJobs(hostId), getStaff(hostId), getCustomers(hostId), getServiceSettings(hostId), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-[1400px]">
      <ServicesPageHeader title="Schedule" description="A week of visits, one row per technician. Move a job to another day or person from its card; double-bookings are flagged in red." />
      <ScheduleView jobs={jobs} staff={staff} customers={customers} catalog={settings?.catalog ?? []} canEdit={canEdit} />
    </div>
  );
}
