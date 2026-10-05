import type { Metadata } from "next";
import { CollectivePage } from "@/components/team/collective-page";
import { getPublicTeam } from "@/lib/team/queries";

export const metadata: Metadata = { title: "The Collective" };

/** Roles and responsibilities across HostOS Collective — the full view, for signed-in members. */
export default async function Page() {
  const members = await getPublicTeam();
  return <CollectivePage members={members} />;
}
