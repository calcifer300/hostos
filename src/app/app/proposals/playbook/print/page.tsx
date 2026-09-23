import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { HOUSE_PROPOSAL } from "@/lib/proposals/content";
import { PlaybookDocument } from "@/components/proposals/playbook-document";

export const metadata: Metadata = {
  title: "HostOS — pricing & sales handbook",
  robots: { index: false, follow: false },
};

/** The handbook as a printable document. `?auto=1` opens the print dialog on load. */
export default async function PlaybookPrintPage({ searchParams }: { searchParams: Promise<{ auto?: string }> }) {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");
  const { auto } = await searchParams;

  return (
    <main className="light min-h-screen bg-background" style={{ ["--proposal-accent" as string]: HOUSE_PROPOSAL.client.accent }}>
      <PlaybookDocument doc={HOUSE_PROPOSAL} auto={auto === "1"} />
    </main>
  );
}
