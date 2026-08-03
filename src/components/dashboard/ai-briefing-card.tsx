"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { EmailArrival } from "@/components/ihost/email-arrival";
import { EventBadge } from "@/components/ihost/event-badge";
import { AnalysisPanel } from "@/components/ihost/analysis-panel";
import { ReplyEditor } from "@/components/ihost/reply-editor";
import { seedEmails } from "@/lib/mock/seed-emails";
import type { IHostAnalysis, InboundTuroEmail } from "@/types/ihost";

type Stage = "idle" | "arrived" | "analyzing" | "result" | "error";

/**
 * The real iHost pipeline (POST /api/ihost/analyze), re-housed as the
 * dashboard's hero card instead of standing alone on its own page. Same
 * state machine as the original IHostFeed — nothing about the backend
 * call, classification, or draft reply is mocked here.
 */
type Source = "gmail" | "demo" | "custom";

export function AiBriefingCard({ initialEmail }: { initialEmail?: InboundTuroEmail | null }) {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [email, setEmail] = React.useState<InboundTuroEmail | null>(null);
  const [analysis, setAnalysis] = React.useState<IHostAnalysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [seedIndex, setSeedIndex] = React.useState(0);
  const [expanded, setExpanded] = React.useState(false);
  const [composerOpen, setComposerOpen] = React.useState(false);
  const [customMessage, setCustomMessage] = React.useState("");
  const [source, setSource] = React.useState<Source>("demo");

  const runFor = React.useCallback(async (inbound: InboundTuroEmail, src: Source) => {
    setEmail(inbound);
    setSource(src);
    setAnalysis(null);
    setError(null);
    setExpanded(false);
    setStage("arrived");
    await new Promise((r) => setTimeout(r, 550));
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
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setStage("error");
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (initialEmail) {
        runFor(initialEmail, "gmail");
      } else {
        runFor(seedEmails[0], "demo");
      }
    }, 900);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  return (
    <div className="rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between gap-3 px-6 pt-6">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10">
            <Sparkles className="h-[15px] w-[15px] text-accent" strokeWidth={1.75} />
          </div>
          <h2 className="text-[15px] font-semibold tracking-tight">AI briefing</h2>
        </div>
        <span className="hidden items-center gap-1.5 text-[12px] text-muted-foreground sm:flex">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent/50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Watching your inbox
        </span>
      </div>

      <div className="px-6 pb-6 pt-4">
        {stage === "idle" && (
          <div className="flex items-center gap-2.5 py-6 text-[13.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Reading your inbox&hellip;
          </div>
        )}

        <AnimatePresence mode="wait">
          {email && stage !== "idle" && (
            <motion.div key={email.receivedAt + email.guestName} exit={{ opacity: 0 }}>
              <EmailArrival email={email} />

              {stage === "analyzing" && (
                <div className="mt-4 flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking your knowledge base&hellip;
                </div>
              )}

              {stage === "error" && (
                <div className="mt-4 rounded-md border border-danger/30 bg-danger-bg px-3.5 py-3 text-[13px] text-danger">
                  {error}
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
            </motion.div>
          )}
        </AnimatePresence>

        {(stage === "result" || stage === "error") && (
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <button
              onClick={() => setComposerOpen((v) => !v)}
              className="text-[12.5px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Paste your own message
            </button>
            <Button variant="ghost" size="sm" onClick={handleNextDemo}>
              <Sparkles className="h-3.5 w-3.5" />
              Next example
            </Button>
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
