import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { getProposal, listVersions } from "@/lib/proposals/queries";
import { ProposalEditor } from "@/components/proposals/proposal-editor";

export const metadata: Metadata = { title: "Edit proposal" };

/** Editing a proposal: client and branding, the hero, pricing, case studies, media and internal notes. */
export default async function EditProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();
  const versions = await listVersions(proposal.id);

  return <ProposalEditor id={proposal.id} title={proposal.title} notes={proposal.notes} doc={proposal.doc} versions={versions} />;
}
