import Link from "next/link";
import { ArrowRight, BookOpen, Plug } from "lucide-react";
import { auth } from "@/auth";

export default async function SettingsPage() {
  const session = await auth();

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-8">
        <h1 className="text-[28px] font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
          Account and how HostOS is configured to run.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            Account
          </p>
          {session?.user ? (
            <div className="mt-2">
              <p className="text-[14px] font-medium">{session.user.name || "Host"}</p>
              <p className="mt-0.5 text-[13px] text-muted-foreground">{session.user.email}</p>
            </div>
          ) : (
            <p className="mt-2 text-[13px] text-muted-foreground">
              No Google account connected.{" "}
              <Link href="/login" className="font-medium text-accent">
                Connect one
              </Link>{" "}
              from Connectors.
            </p>
          )}
        </div>

        <Link
          href="/knowledge"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <BookOpen className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13.5px] font-medium">Knowledge base</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Check-in process, house rules, tone — what Butler and AI Briefing ground replies in.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>

        <Link
          href="/connectors"
          className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)] transition-colors hover:border-accent/40"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
              <Plug className="h-[16px] w-[16px] text-muted-foreground" strokeWidth={1.75} />
            </div>
            <div>
              <p className="text-[13.5px] font-medium">Connectors</p>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                Gmail, the HostOS Companion extension, and what&rsquo;s coming next.
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Link>
      </div>
    </div>
  );
}
