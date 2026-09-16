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
  // Signed out, the page says photo, name and role — and sends nothing more:
  // the responsibilities never leave the server for this route.
  const members = (await getPublicTeam()).map((m) => ({ ...m, focus: [], quote: "", responsibilities: [], email: null }));
  return <TeamPage members={members} />;
}
