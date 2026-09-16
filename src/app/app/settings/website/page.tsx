import type { Metadata } from "next";
import { auth } from "@/auth";
import { WebsiteEditor } from "@/components/settings/website-editor";
import { isFounderEmail } from "@/lib/roles/constants";
import { getLandingIntro } from "@/lib/site/queries";

export const metadata: Metadata = { title: "Website" };

/** Founder only: the landing page's intro on hostoscollective.com. */
export default async function WebsitePage() {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) {
    return <div className="rounded-2xl border border-dashed border-border bg-card/60 p-8 text-[14px] text-muted-foreground">Only the Founder can edit the website.</div>;
  }
  const { intro, fromDatabase } = await getLandingIntro();
  return <WebsiteEditor intro={intro} fromDatabase={fromDatabase} />;
}
