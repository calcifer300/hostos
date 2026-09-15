import type { Metadata } from "next";
import { ModuleOff } from "@/components/dashboard/module-off";
import { EstimatesView } from "@/components/services/estimates";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getCustomers, getEstimates, getServiceSettings } from "@/lib/services/queries";

export const metadata: Metadata = { title: "Estimates" };

export default async function EstimatesPage() {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const hostId = await getCurrentHostId();
  const [estimates, customers, settings, canEdit] = await Promise.all([getEstimates(hostId), getCustomers(hostId), getServiceSettings(hostId), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-5xl">
      <ServicesPageHeader title="Estimates" description="Build from your catalogue, send, and accept in one click — accepting creates the work order and files the dispatch task." />
      <EstimatesView estimates={estimates} customers={customers} catalog={settings?.catalog ?? []} canEdit={canEdit} />
    </div>
  );
}
