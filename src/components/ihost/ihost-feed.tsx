"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EmailArrival } from "@/components/ihost/email-arrival";
import { EventBadge } from "@/components/ihost/event-badge";
import { AnalysisPanel } from "@/components/ihost/analysis-panel";
import { ReplyEditor } from "@/components/ihost/reply-editor";
import { seedEmails } from "@/lib/mock/seed-emails";
import type { IHostAnalysis, InboundTuroEmail } from "@/types/ihost";

type Stage = "idle" | "arrived" | "analyzing" | "result" | "error";

export function IHostFeed() {
  const [stage, setStage] = React.useState<Stage>("idle");
  const [email, setEmail] = React.useState<InboundTuroEmail | null>(null);
  const [analysis, setAnalysis] = React.useState<IHostAnalysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [seedIndex, setSeedIndex] = React.useState(0);
  const [customMessage, setCustomMessage] = React.useState("");

  const runFor = React.useCallback(async (inbound: InboundTuroEmail) => {
    setEmail(inbound);
    setAnalysis(null);
    setError(null);
    setStage("arrived");
    await new Promise((r) => setTimeout(r, 650));
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
    const timer = setTimeout(() => runFor(seedEmails[0]), 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNextDemo() {
    const next = (seedIndex + 1) % seedEmails.length;
    setSeedIndex(next);
    runFor(seedEmails[next]);
  }

  function handleCustomSubmit() {
    if (!customMessage.trim()) return;
    runFor({
      guestName: "This guest",
      vehicle: "their vehicle",
      subject: "",
      body: customMessage.trim(),
      receivedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      {stage === "idle" && (
        <div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-muted-foreground/50" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          </span>
          iHost is watching your inbox.
        </div>
      )}

      <AnimatePresence mode="wait">
        {email && stage !== "idle" && (
          <motion.div key={email.receivedAt + email.guestName} exit={{ opacity: 0 }}>
            <EmailArrival email={email} />

            <motion.h1
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="mb-7 mt-6 text-[22px] font-semibold leading-snug tracking-tight"
            >
              I read {email.guestName}&rsquo;s message. Here&rsquo;s what matters.
            </motion.h1>

            {stage === "analyzing" && (
              <div className="flex items-center gap-2.5 text-[13.5px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Reading the message and checking your knowledge base&hellip;
              </div>
            )}

            {stage === "error" && (
              <div className="rounded-md border border-danger/30 bg-danger-bg px-3.5 py-3 text-[13px] text-danger">
                {error}
              </div>
            )}

            {stage === "result" && analysis && (
              <div className="space-y-7">
                <div>
                  <EventBadge type={analysis.eventType} />
                </div>
                <AnalysisPanel analysis={analysis} />
                {analysis.draftReply && <ReplyEditor initialDraft={analysis.draftReply} />}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {(stage === "result" || stage === "error") && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="mt-14 space-y-5 border-t border-border pt-8"
        >
          <div className="flex items-center justify-between">
            <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Try another
            </p>
            <Button variant="ghost" size="sm" onClick={handleNextDemo}>
              <Sparkles className="h-3.5 w-3.5" />
              Next example
            </Button>
          </div>
          <div>
            <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              Or paste a real message
            </p>
            <Textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              placeholder="Paste a guest message you've actually received, and watch iHost do this again."
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
    </div>
  );
}
