"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Small inline copy-to-clipboard affordance for identifiers a host actually
 * needs to paste elsewhere — plate numbers, reservation IDs, guest phone
 * numbers, message text. Swallows clipboard failures (permissions, insecure
 * context) into a no-op rather than throwing in front of the user.
 */
export function CopyButton({ value, label, className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable (no permission, insecure context) — the
      // value is still visible on screen, so failing silently is fine.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={label ? `Copy ${label}` : "Copy"}
      title={copied ? "Copied" : label ? `Copy ${label}` : "Copy"}
      className={cn(
        "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground",
        className
      )}
    >
      {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}
