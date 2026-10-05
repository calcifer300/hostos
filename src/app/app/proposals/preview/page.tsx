import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { HOUSE_PROPOSAL } from "@/lib/proposals/content";
import { ProposalView } from "@/components/proposals/proposal-view";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "House proposal" };

/**
 * The master story, rendered without a client attached: what every new
 * proposal starts from. Useful before writing one — and it needs no database
 * row, so it is also how the sales narrative is reviewed and edited in code.
 */
export default async function HouseProposalPage() {
  const session = await auth();
  if (!isFounderEmail(session?.user?.email)) redirect("/app");

  return (
    <div className="-mx-4 -my-6 md:-mx-8">
      <div className="proposal-chrome sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/app/proposals">
              <ArrowLeft /> All proposals
            </Link>
          </Button>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-semibold tracking-tight">The house proposal</span>
            <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
              Template · every new proposal starts here
            </span>
          </span>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/app/proposals">Create one for a client</Link>
          </Button>
          <Button variant="primary" size="sm" asChild>
            <a href="/app/proposals/preview/print?auto=1" target="_blank" rel="noreferrer">
              <Download /> Download PDF
            </a>
          </Button>
        </div>
      </div>
      <ProposalView doc={HOUSE_PROPOSAL} mode="internal" />
    </div>
  );
}
