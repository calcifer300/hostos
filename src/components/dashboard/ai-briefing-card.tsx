"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown, Inbox, KeyRound, Loader2, LogIn, Sparkles } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmailArrival } from "@/components/ihost/email-arrival";
import { EventBadge } from "@/components/ihost/event-badge";
import { AnalysisPanel } from "@/components/ihost/analysis-panel";
import { ReplyEditor } from "@/components/ihost/reply-editor";
import { seedEmails } from "@/lib/mock/seed-emails";
import type { IHostAnalysis, IHostBriefing, InboundTuroEmail } from "@/types/ihost";

type BriefingState =
  | { status: "loading" }
  | { status: "ready"; briefing: IHostBriefing }
  | { status: "not_configured"; message: string }
  | { status: "not_signed_in" }
  | { status: "no_messages" }
  | { status: "failed"; message: string };

type AnalysisStage = "arrived" | "analyzing" | "result" | "error";
type Source = "gmail" | "demo" | "custom";

const fade = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] as const },
};

/**
 * The dashboard's hero card. Its primary content is an AI-generated
 * briefing over the newest synced Gmail messages; the original
 * single-message pipeline (POST /api/ihost/analyze) is still here, reached
 * from the footer, so nothing from earlier sprints was lost.
 */
export function AiBriefingCard({ initialEmail }: { initialEmail?: InboundTuroEmail | null }) {
  const [briefingState, setBriefingState] = React.useState<BriefingState>({ status: "loading" });

  const [email, setEmail] = React.useState<InboundTuroEmail | null>(null);
  const [stage, setStage] = React.useState<AnalysisStage | null>(null);
  const [analysis, setAnalysis] = React.useState<IHostAnalysis | null>(null);
  const [analysisError, setAnalysisError] = React.useState<string | null>(null);
  const [source, setSource] = React.useState<Source>("demo");
  const [seedIndex, setSeedIndex] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [customMessage, setCustomMessage] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/ihost/briefing");
        const data = await res.json();
        if (cancelled) return;

        if (data.briefing) {
          setBriefingState({ status: "ready", briefing: data.briefing as IHostBriefing });
        } else if (data.reason === "unauthenticated") {
          setBriefingState({ status: "not_signed_in" });
        } else if (data.reason === "not_configured") {
          setBriefingState({ status: "not_configured", message: data.error });
        } else if (data.reason === "no_messages") {
          setBriefingState({ status: "no_messages" });
        } else {
          setBriefingState({
            status: "failed",
            message: data.error || "iHost could not generate a briefing.",
          });
        }
      } catch {
        if (!cancelled) {
          setBriefingState({ status: "failed", message: "iHost could not reach the briefing service." });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const runFor = React.useCallback(async (inbound: InboundTuroEmail, src: Source) => {
    setEmail(inbound);
    setSource(src);
    setAnalysis(null);
    setAnalysisError(null);
    setExpanded(false);
    setStage("arrived");
    await new Promise((r) => setTimeout(r, 450));
    setStage("analyzing");

    try {
      const res = await fetch("/api/ihost/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inbound),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "iHost could not process this message.");
      setAnalysis(data as IHostAnalysis);
      setStage("result");
    } catch (err) {
      setAnalysisError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }, []);

  function handleNextDemo() {
    const next = (seedIndex + 1) % seedEmails.length;
    setSeedIndex(next);
    runFor(seedEmails[next], "demo");
  }

  function handleCustomSubmit() {
    if (!customMessage.trim()) return;
    runFor(
      {
        guestName: "This guest",
        vehicle: "their vehicle",
        subject: "",
        body: customMessage.trim(),
        receivedAt: new Date().toISOString(),
      },
      "custom"
    );
    setCustomMessage("");
    setComposerOpen(false);
  }

  function backToBriefing() {
    setStage(null);
    setEmail(null);
    setAnalysis(null);
    setAnalysisError(null);
    setComposerOpen(false);
  }

  const inAnalysisMode = stage !== null;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-[15px] w-[15px] text-accent" strokeWidth={1.75} />
          </div>
          <h2 className="text-[15px] font-semibold tracking-tight">AI briefing</h2>
        </div>
        {inAnalysisMode ? (
          <Button variant="ghost" size="sm" onClick={backToBriefing}>
            <ArrowLeft className="h-3.5 w-3.5" />
            Briefing
          </Button>
        ) : (
          briefingState.status === "ready" && (
            <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
              </span>
              {briefingState.briefing.messageCount} synced
            </span>
          )
        )}
      </div>

      <div className="px-6 pb-6 pt-4">
        {!inAnalysisMode && (
          <AnimatePresence mode="wait">
            {briefingState.status === "loading" && (
              <motion.div
                key="loading"
                {...fade}
                className="flex items-center gap-2.5 py-6 text-[13.5px] text-muted-foreground"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading your inbox&hellip;
              </motion.div>
            )}

            {briefingState.status === "ready" && (
              <motion.div key="ready" {...fade} className="space-y-5">
                <p className="text-[17px] font-medium leading-snug tracking-tight">
                  {briefingState.briefing.headline}
                </p>

                {briefingState.briefing.highlights.length > 0 && (
                  <ul className="space-y-2">
                    {briefingState.briefing.highlights.map((line, i) => (
                      <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground" />
                        {line}
                      </li>
                    ))}
                  </ul>
                )}

                {briefingState.briefing.priorities.length > 0 && (
                  <div className="rounded-xl border border-border bg-background/40 p-4">
                    <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Priority
                    </p>
                    <ul className="space-y-2">
                      {briefingState.briefing.priorities.map((line, i) => (
                        <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-accent" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}

            {briefingState.status === "not_signed_in" && (
              <motion.div
                key="not-signed-in"
                {...fade}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background/40 px-4 py-3.5"
              >
                <div className="flex gap-3">
                  <LogIn className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                  <div>
                    <p className="text-[13.5px] font-medium">Connect Google for a briefing</p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                      Briefings are generated from your synced Gmail. Connect an account to see one.
                    </p>
                  </div>
                </div>
                <Link
                  href="/login"
                  className="shrink-0 whitespace-nowrap rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90"
                >
                  Connect
                </Link>
              </motion.div>
            )}

            {briefingState.status === "not_configured" && (
              <motion.div
                key="not-configured"
                {...fade}
                className="flex gap-3 rounded-xl border border-border bg-background/40 px-4 py-3.5"
              >
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div>
                  <p className="text-[13.5px] font-medium">AI briefings are turned off</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                    {briefingState.message}
                  </p>
                </div>
              </motion.div>
            )}

            {briefingState.status === "no_messages" && (
              <motion.div
                key="no-messages"
                {...fade}
                className="flex gap-3 rounded-xl border border-border bg-background/40 px-4 py-3.5"
              >
                <Inbox className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <div>
                  <p className="text-[13.5px] font-medium">Nothing synced yet</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">
                    Sync your Gmail from the Inbox and iHost will brief you on what arrived.
                  </p>
                </div>
              </motion.div>
            )}

            {briefingState.status === "failed" && (
              <motion.div
                key="failed"
                {...fade}
                className="rounded-md border border-danger/30 bg-danger-bg px-3.5 py-3 text-[13px] text-danger"
              >
                {briefingState.message}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {inAnalysisMode && email && (
          <div>
            <EmailArrival email={email} />

            {stage === "analyzing" && (
              <div className="mt-4 flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Checking your knowledge base&hellip;
              </div>
            )}

            {stage === "error" && (
              <div className="mt-4 rounded-md border border-danger/30 bg-danger-bg px-3.5 py-3 text-[13px] text-danger">
                {analysisError}
              </div>
            )}

            {stage === "result" && analysis && (
              <div className="mt-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <EventBadge type={analysis.eventType} />
                  <Badge variant={analysis.actionRequired ? "accent" : "success"}>
                    {analysis.actionRequired ? "Needs you" : "Handled"}
                  </Badge>
                  {source === "gmail" && <Badge variant="neutral">From Gmail</Badge>}
                  {source === "demo" && <Badge variant="neutral">Demo example</Badge>}
                </div>
                <p className="text-[14.5px] leading-relaxed">{analysis.summary}</p>

                <button
                  onClick={() => setExpanded((v) => !v)}
                  className="flex items-center gap-1 text-[12.5px] font-medium text-accent"
                >
                  {expanded ? "Hide full analysis" : "Show full analysis"}
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")}
                  />
                </button>

                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-6 border-t border-border pt-5">
                        <AnalysisPanel analysis={analysis} />
                        {analysis.draftReply && <ReplyEditor initialDraft={analysis.draftReply} />}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {briefingState.status !== "loading" && stage !== "analyzing" && stage !== "arrived" && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <button
              onClick={() => setComposerOpen((v) => !v)}
              className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Analyze a single message
            </button>
            <div className="flex items-center gap-1">
              {initialEmail && (
                <Button variant="ghost" size="sm" onClick={() => runFor(initialEmail, "gmail")}>
                  Latest unread
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleNextDemo}>
                <Sparkles className="h-3.5 w-3.5" />
                Example
              </Button>
            </div>
          </div>
        )}

        <AnimatePresence>
          {composerOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-4">
                <Textarea
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  placeholder="Paste a guest message you've actually received."
                  rows={3}
                />
                <div className="mt-2.5 flex justify-end">
                  <Button size="sm" onClick={handleCustomSubmit}>
                    Send to iHost
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
