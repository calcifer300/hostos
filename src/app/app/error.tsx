"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AlertOctagon, Home, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { routes } from "@/lib/routes";

/**
 * The product's error boundary. Queries never throw (see lib/supabase/server),
 * so landing here means a rendering bug — say so plainly, offer a retry, and
 * keep the shell around it so nobody is stranded.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  React.useEffect(() => {
    console.error("[hostos] page error", error);
  }, [error]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto flex w-full max-w-xl flex-col items-start rounded-2xl border border-danger/30 bg-danger-bg/30 p-8"
      role="alert"
    >
      <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-danger/10 text-danger">
        <AlertOctagon className="h-5 w-5" strokeWidth={1.75} />
      </span>
      <h1 className="text-[22px] font-semibold tracking-tight">This page hit a problem.</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-muted-foreground">
        The rest of HostOS is fine. Try the page again; if it keeps happening, the error reference below helps us find it.
      </p>
      {error.digest && <p className="mt-3 font-mono text-[11.5px] text-muted-foreground/80">ref {error.digest}</p>}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => reset()}>
          <RotateCcw /> Try again
        </Button>
        <Button asChild variant="ghost">
          <Link href={routes.app}>
            <Home /> Home
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
