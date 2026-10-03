import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { getProposal } from "@/lib/proposals/queries";
import { PrintDocument } from "@/components/proposals/print-document";

export const metadata: Metadata = {
  title: "Proposal — print",
  robots: { index: false, follow: false },
};

/**
 * One client's proposal as a printable document.
 *
 * `?edition=client` prints what the client would receive; without it the
 * internal edition is produced, which appends the pricing positioning
 * playbook. `?auto=1` opens the print dialog on load.
 */
export default async function ProposalPrintPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auto?: string; edition?: string }>;
}) {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");

  const { id } = await params;
  const { auto, edition } = await searchParams;
  const proposal = await getProposal(id);
  if (!proposal) notFound();

  return (
    <main className="light min-h-screen bg-background" style={{ ["--proposal-accent" as string]: proposal.doc.client.accent }}>
      <PrintDocument
        doc={proposal.doc}
        title={proposal.title}
        edition={edition === "client" ? "client" : "internal"}
        auto={auto === "1"}
      />
    </main>
  );
}
