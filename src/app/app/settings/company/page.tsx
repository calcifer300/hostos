import type { Metadata } from "next";
import { auth } from "@/auth";
import { TeamPageEditor } from "@/components/settings/team-page-editor";
import { isFounderEmail } from "@/lib/roles/constants";
import { getTeamProfiles } from "@/lib/team/queries";

export const metadata: Metadata = { title: "Our Team page" };

/** Founder only: the public roster on hostoscollective.com/team. */
export default async function CompanyPage() {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-[14px] text-muted-foreground">Only the Founder can edit the public team page.</div>
    );
  }
  const { profiles, fromDatabase } = await getTeamProfiles();
  return <TeamPageEditor profiles={profiles} fromDatabase={fromDatabase} />;
}
