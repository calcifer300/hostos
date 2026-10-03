import type { Metadata } from "next";
import { TemplatesEditor } from "@/components/settings/templates-editor";
import { getReplyTemplates } from "@/lib/templates/queries";
import { canManageSettings, getCurrentHostId } from "@/lib/host/context";

export const metadata: Metadata = { title: "Reply templates" };

export default async function TemplatesPage() {
  const hostId = await getCurrentHostId();
  const [templates, canEdit] = await Promise.all([getReplyTemplates(hostId), canManageSettings()]);
  return <TemplatesEditor templates={templates} canEdit={canEdit} />;
}
