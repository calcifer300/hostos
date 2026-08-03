"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ReplyEditor({ initialDraft }: { initialDraft: string }) {
  const [draft, setDraft] = React.useState(initialDraft);
  const [copied, setCopied] = React.useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  function handleOpenTuro() {
    window.open("https://turo.com/us/en/trips", "_blank", "noopener,noreferrer");
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
    >
      <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Suggested reply
      </p>
      <div className="rounded-lg border border-border bg-card p-4">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={5}
          aria-label="Edit iHost's suggested reply"
          className="mb-3 border-0 bg-transparent p-0 text-[14.5px] leading-relaxed focus-visible:ring-0"
        />
        <div className="flex items-center gap-2 border-t border-border pt-3">
          <Button variant="primary" size="sm" onClick={handleCopy}>
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copied" : "Copy"}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleOpenTuro}>
            <ExternalLink className="h-3.5 w-3.5" />
            Open in Turo
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
