import type { Metadata } from "next";
import { TeamPage } from "@/components/marketing/team-page";
import { getPublicTeam } from "@/lib/team/queries";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Our team — ${SITE.company}` },
  description: "A trained, coordinated team — not just a group of assistants. Phone, email and live chat, delivered inside HostOS.",
  alternates: { canonical: "/team" },
};

export default async function Page() {
  const members = await getPublicTeam();
  return <TeamPage members={members} />;
}
