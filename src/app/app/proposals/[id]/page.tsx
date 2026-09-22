import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { getProposal, listEvents } from "@/lib/proposals/queries";
import { ProposalToolbar } from "@/components/proposals/proposal-toolbar";
import { ProposalView } from "@/components/proposals/proposal-view";

export const metadata: Metadata = { title: "Proposal" };

/**
 * The internal preview: exactly what the client will see, with the sales
 * team's controls above it. Founder-only, and the toolbar is stripped from
 * the printed PDF.
 */
export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");

  const { id } = await params;
  const proposal = await getProposal(id);
  if (!proposal) notFound();

  const events = await listEvents(proposal.id);
  const views = events.filter((e) => e.kind === "view").length;

  return (
    <div className="-mx-4 -my-6 md:-mx-8">
      <ProposalToolbar
        id={proposal.id}
        title={proposal.title}
        status={proposal.status}
        shareToken={proposal.shareToken}
        version={proposal.version}
        views={views}
      />
      <ProposalView doc={proposal.doc} mode="internal" />

      {/* Internal only: what the client did with it, and our own notes. */}
      <section className="proposal-chrome border-t border-border bg-surface px-6 py-14">
        <div className="mx-auto grid w-full max-w-7xl gap-6 lg:grid-cols-2">
          <div className="rounded-3xl border border-border bg-card p-7">
            <h2 className="text-[16px] font-semibold tracking-tight">Proposal activity</h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">
              {proposal.shareToken ? "Every time the client opens the shared link." : "Sharing is off — create a link to start tracking opens."}
            </p>
            {events.length === 0 ? (
              <p className="mt-6 text-[13.5px] text-muted-foreground">Nothing recorded yet.</p>
            ) : (
              <ul className="mt-6 space-y-3">
                {events.slice(0, 12).map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex items-baseline justify-between gap-4 border-b border-border pb-3 last:border-0">
                    <span className="text-[13.5px] capitalize">{e.kind}{e.detail ? ` · ${e.detail}` : ""}</span>
                    <time className="shrink-0 font-mono text-[11px] text-muted-foreground" dateTime={e.at}>
                      {new Date(e.at).toLocaleString()}
                    </time>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-3xl border border-border bg-card p-7">
            <h2 className="text-[16px] font-semibold tracking-tight">Internal notes</h2>
            <p className="mt-1.5 text-[13px] text-muted-foreground">Never rendered in the client&rsquo;s view. Edit them alongside the proposal.</p>
            <p className="mt-6 whitespace-pre-wrap text-[13.5px] leading-relaxed text-muted-foreground">
              {proposal.notes || "No notes yet."}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
