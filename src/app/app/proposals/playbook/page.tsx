import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download } from "lucide-react";
import { auth } from "@/auth";
import { isFounderEmail } from "@/lib/roles/constants";
import { HOUSE_PROPOSAL } from "@/lib/proposals/content";
import { PlaybookDocument } from "@/components/proposals/playbook-document";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: "Pricing & sales handbook" };

/**
 * The team's training document: how to position every price and how to run
 * the conversation around it. Founder-only, like everything in the Center.
 */
export default async function PlaybookPage() {
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
            <span className="block truncate text-[13.5px] font-semibold tracking-tight">Pricing &amp; sales handbook</span>
            <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-danger">
              Internal — never send to a client
            </span>
          </span>
          <Button variant="primary" size="sm" asChild>
            <a href="/app/proposals/playbook/print?auto=1" target="_blank" rel="noreferrer">
              <Download /> Download PDF
            </a>
          </Button>
        </div>
      </div>
      <div className="light" style={{ ["--proposal-accent" as string]: HOUSE_PROPOSAL.client.accent }}>
        <PlaybookDocument doc={HOUSE_PROPOSAL} />
      </div>
    </div>
  );
}
