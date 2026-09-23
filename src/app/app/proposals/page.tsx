import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FileText } from "lucide-react";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { listProposals, viewCounts } from "@/lib/proposals/queries";
import { STATUS_LABELS, type ProposalStatus } from "@/lib/proposals/types";
import { NewProposalButton } from "@/components/proposals/new-proposal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Proposal Center" };

const STATUS_TONE: Record<ProposalStatus, string> = {
  draft: "border-border text-muted-foreground",
  sent: "border-accent/35 bg-accent/10 text-accent",
  viewed: "border-platform/35 bg-platform/10 text-platform",
  won: "border-ok/35 bg-ok/10 text-ok",
  lost: "border-danger/30 bg-danger/8 text-danger",
};

/**
 * The Proposal Center: every client proposal, its status and whether the
 * client has actually opened it. Founder-only — the middleware gate in front
 * of /app is the first door, and this check is the second.
 */
export default async function ProposalsPage() {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");

  const [{ rows, degraded }, views] = await Promise.all([listProposals(), viewCounts()]);

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">Enterprise sales</p>
          <h1 className="headline mt-2 text-[30px] sm:text-[36px]">
            Proposal <em>Center</em>
          </h1>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-muted-foreground">
            One interactive proposal per client: the whole HostOS story, priced for them, shareable by a private link, and tracked from sent to won.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="lg">
            <Link href="/app/proposals/preview">View the house story</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/app/proposals/playbook">Pricing &amp; sales handbook</Link>
          </Button>
          <NewProposalButton />
        </div>
      </div>

      {degraded && (
        <div className="mb-6 rounded-2xl border border-warn/30 bg-warn/8 p-4 text-[13px] leading-relaxed text-foreground/85">
          The proposals table is not reachable. Run migration <code className="font-mono">0037_proposals.sql</code> to enable the Proposal Center.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl border border-dashed border-border bg-surface px-6 py-20 text-center">
          <span className="grid h-12 w-12 place-items-center rounded-full border border-border bg-card text-muted-foreground">
            <FileText className="h-5 w-5" />
          </span>
          <h2 className="mt-5 text-[18px] font-semibold tracking-tight">No proposals yet</h2>
          <p className="mx-auto mt-2 max-w-md text-[13.5px] leading-relaxed text-muted-foreground">
            Create one for a client and it starts from the full HostOS story — sixteen sections, priced and branded for them. Edit anything before you send it.
          </p>
          <div className="mt-6">
            <NewProposalButton />
          </div>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((p) => {
            const seen = views[p.id];
            return (
              <li key={p.id}>
                <Link
                  href={`/app/proposals/${p.id}`}
                  className="group flex h-full flex-col rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-accent/45 hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={cn("rounded-full border px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.1em]", STATUS_TONE[p.status])}>
                      {STATUS_LABELS[p.status]}
                    </span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted-foreground">v{p.version}</span>
                  </div>

                  <h2 className="mt-4 text-[18px] font-semibold leading-snug tracking-tight">{p.clientCompany || p.title}</h2>
                  <p className="mt-1.5 text-[13px] text-muted-foreground">{p.industry || "Operations partnership"}</p>

                  {p.clientContact && (
                    <p className="mt-3 text-[12.5px] text-muted-foreground">
                      {p.clientContact}
                      {p.clientEmail ? ` · ${p.clientEmail}` : ""}
                    </p>
                  )}

                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-[12px] text-muted-foreground">
                    <span>
                      {p.shareToken ? (seen ? `${seen.views} ${seen.views === 1 ? "open" : "opens"}` : "Shared · not opened yet") : "Not shared"}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
