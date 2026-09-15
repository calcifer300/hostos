import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ModuleOff } from "@/components/dashboard/module-off";
import { JobCard } from "@/components/services/job-card";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getChecklists } from "@/lib/local/queries";
import { getCustomer, getEvents, getJob, getStaff } from "@/lib/services/queries";
import { routes } from "@/lib/routes";

export const metadata: Metadata = { title: "Work order" };

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const { id } = await params;
  const hostId = await getCurrentHostId();
  const job = await getJob(hostId, id);
  if (!job) notFound();
  const [customer, staff, events, checklists, canEdit] = await Promise.all([job.customerId ? getCustomer(hostId, job.customerId) : Promise.resolve(null), getStaff(hostId), getEvents(hostId, { jobId: id }), getChecklists(hostId, "services"), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <ServicesPageHeader title={`#${job.number} · ${job.title}`} back={routes.servicesDispatch} backLabel="Dispatch" />
      <JobCard job={job} customer={customer} staff={staff} events={events} checklist={checklists.find((c) => c.kind === "job") ?? null} canEdit={canEdit} />
    </div>
  );
}
