"use client";

import { Toaster as Sonner } from "sonner";

/**
 * One toast host for the whole app, themed with the design tokens so a toast
 * reads as part of the surface it floats over rather than a library default.
 */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "!bg-card !text-foreground !border !border-border !shadow-[var(--shadow-elevated)] !rounded-2xl !text-[13px]",
          description: "!text-muted-foreground",
          actionButton: "!bg-accent !text-accent-foreground",
          cancelButton: "!bg-muted !text-muted-foreground",
        },
      }}
    />
  );
}
