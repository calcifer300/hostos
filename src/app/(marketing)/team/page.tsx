import type { Metadata } from "next";
import { TeamPage } from "@/components/marketing/team-page";
import { getPublicTeam } from "@/lib/team/queries";
import { getPublicAppUrl, SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: { absolute: `Our team — ${SITE.company}` },
  description: "A trained, coordinated team — not just a group of assistants. Phone, email and live chat, delivered inside HostOS.",
  alternates: { canonical: "/team" },
};

export default async function Page() {
  // Signed out, the page says photo, name and role — and sends nothing more:
  // the responsibilities never leave the server for this route.
  const members = (await getPublicTeam()).map((m) => ({ ...m, focus: [], quote: "", responsibilities: [], email: null }));
  const base = getPublicAppUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.company,
    url: base,
    member: members.map((m) => ({
      "@type": "Person",
      name: m.name,
      ...(m.nickname && m.nickname !== m.name ? { alternateName: m.nickname } : {}),
      jobTitle: m.title,
      worksFor: { "@type": "Organization", name: SITE.company },
      ...(m.photoUrl ? { image: m.photoUrl.startsWith("/") ? `${base}${m.photoUrl}` : m.photoUrl } : {}),
    })),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <TeamPage members={members} />
    </>
  );
}
