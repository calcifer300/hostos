import type { Metadata } from "next";
import { ModuleOff } from "@/components/dashboard/module-off";
import { KnowledgeCenter } from "@/components/services/knowledge";
import { ServicesPageHeader } from "@/components/services/page-header";
import { canEditCurrentFleet, getCurrentHostId, verticalAccess } from "@/lib/host/context";
import { getDocs } from "@/lib/services/queries";

export const metadata: Metadata = { title: "SOPs & knowledge" };

export default async function KnowledgePage() {
  const access = await verticalAccess("services");
  if (access !== "ok") return <ModuleOff module="services" reason={access} />;
  const hostId = await getCurrentHostId();
  const [docs, canEdit] = await Promise.all([getDocs(hostId), canEditCurrentFleet()]);
  return (
    <div className="mx-auto w-full max-w-6xl">
      <ServicesPageHeader title="SOPs & knowledge" description="How this business runs, step by step — seeded from your industry template, kept current by you, and what the AI assistant will answer from." />
      <KnowledgeCenter docs={docs} canEdit={canEdit} />
    </div>
  );
}
