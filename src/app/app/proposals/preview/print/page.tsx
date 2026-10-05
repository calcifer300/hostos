import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { HOUSE_PROPOSAL } from "@/lib/proposals/content";
import { PrintDocument } from "@/components/proposals/print-document";

export const metadata: Metadata = {
  title: "HostOS — proposal & pricing playbook",
  robots: { index: false, follow: false },
};

/**
 * The house proposal as a printable document, with the internal pricing
 * positioning playbook appended. This is the edition the team reads to learn
 * how each price is argued — never the one a client receives.
 *
 * `?auto=1` opens the print dialog on load, so "Download PDF" is one click.
 */
export default async function HousePrintPage({ searchParams }: { searchParams: Promise<{ auto?: string }> }) {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");

  const { auto } = await searchParams;

  return (
    <main className="light min-h-screen bg-background" style={{ ["--proposal-accent" as string]: HOUSE_PROPOSAL.client.accent }}>
      <PrintDocument doc={HOUSE_PROPOSAL} title="Services, pricing & positioning" edition="internal" auto={auto === "1"} />
    </main>
  );
}
