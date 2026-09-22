import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProposalByToken } from "@/lib/proposals/queries";
import { ProposalView } from "@/components/proposals/proposal-view";
import { ViewRecorder } from "@/components/proposals/view-recorder";

/**
 * The client's view of one proposal.
 *
 * Reached only by the secret link an admin deliberately created; the
 * Proposal Center itself stays behind the app's auth gate. Never indexed,
 * and the internal chrome — status, notes, activity — is not rendered here
 * at all, not merely hidden.
 */
export const metadata: Metadata = {
  title: "Operations partnership proposal",
  robots: { index: false, follow: false, nocache: true },
};

export default async function SharedProposalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const proposal = await getProposalByToken(token);
  if (!proposal) notFound();

  return (
    <main className="light min-h-screen bg-background">
      <ViewRecorder token={token} />
      <ProposalView doc={proposal.doc} mode="client" />
      <footer className="border-t border-border bg-surface px-6 py-10 text-center">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
          Prepared by HostOS Collective for {proposal.doc.client.company || "your business"} · Confidential
        </p>
      </footer>
    </main>
  );
}
