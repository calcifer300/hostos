"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, Copy, Link2, Link2Off, Pencil, Printer, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { duplicateProposal, setProposalStatus, shareProposal, unshareProposal } from "@/lib/actions/proposals";
import { PROPOSAL_STATUSES, STATUS_LABELS, type ProposalStatus } from "@/lib/proposals/types";
import { cn } from "@/lib/utils";

/**
 * The sales team's controls, pinned above the proposal. None of this is part
 * of the document — it never renders in the client's view and it is removed
 * from the printed PDF.
 */
export function ProposalToolbar({
  id,
  title,
  status,
  shareToken,
  version,
  views,
}: {
  id: string;
  title: string;
  status: ProposalStatus;
  shareToken: string | null;
  version: number;
  views: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const shareUrl = shareToken ? `${typeof window === "undefined" ? "" : window.location.origin}/proposals/${shareToken}` : "";

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMessage: string) =>
    start(async () => {
      const result = await fn();
      if (result.ok) {
        toast.success(okMessage);
        router.refresh();
      } else {
        toast.error(result.error ?? "That did not work.");
      }
    });

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Client link copied.");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy — select the link and copy it by hand.");
    }
  };

  return (
    <div className="proposal-chrome sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-6 py-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/app/proposals">
            <ArrowLeft /> All proposals
          </Link>
        </Button>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-semibold tracking-tight">{title}</span>
          <span className="block font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">
            v{version} · {views} {views === 1 ? "open" : "opens"}
            {shareToken ? " · shared" : " · not shared"}
          </span>
        </span>

        {/* status */}
        <div className="flex items-center gap-1 rounded-full border border-border bg-card p-1">
          {PROPOSAL_STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              disabled={pending}
              onClick={() => run(() => setProposalStatus(id, s), `Marked ${STATUS_LABELS[s].toLowerCase()}.`)}
              className={cn(
                "rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors disabled:opacity-50",
                status === s ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={`/app/proposals/${id}/edit`}>
              <Pencil /> Edit
            </Link>
          </Button>

          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer /> PDF
          </Button>

          <Button
            variant="secondary"
            size="sm"
            disabled={pending}
            onClick={() => run(() => duplicateProposal(id), "Duplicated — open it from the list.")}
          >
            <Copy /> Duplicate
          </Button>

          {shareToken ? (
            <>
              <Button variant="secondary" size="sm" onClick={copyLink}>
                {copied ? <Check /> : <Link2 />} {copied ? "Copied" : "Copy link"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => run(() => unshareProposal(id), "Sharing revoked — the link is dead.")}
              >
                <Link2Off /> Revoke
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="sm"
              disabled={pending}
              onClick={() => run(() => shareProposal(id), "Share link created — copy it from here.")}
            >
              <Send /> Send to client
            </Button>
          )}
        </div>
      </div>

      {shareToken && (
        <div className="border-t border-border bg-surface">
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-6 py-2">
            <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-muted-foreground">Client link</span>
            <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted-foreground">{shareUrl}</code>
          </div>
        </div>
      )}
    </div>
  );
}
