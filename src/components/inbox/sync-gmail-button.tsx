"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { syncGmail, type SyncGmailResult } from "@/lib/actions/gmail";

export function SyncGmailButton({ compact }: { compact?: boolean }) {
  const [isPending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<SyncGmailResult | null>(null);

  function handleClick() {
    startTransition(async () => {
      const res = await syncGmail();
      setResult(res);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        aria-label="Sync Gmail"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
        {isPending ? "Syncing…" : "Sync Gmail"}
      </Button>
      {!compact && result && !result.ok && (
        <p className="max-w-[220px] text-right text-[11.5px] leading-snug text-danger">
          {result.error}
        </p>
      )}
      {!compact && result?.ok && (
        <p className="text-[11.5px] text-muted-foreground">
          Synced {result.count} {result.count === 1 ? "message" : "messages"}
        </p>
      )}
    </div>
  );
}
