"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Check, Circle } from "lucide-react";
import type { SetupStatus, SetupStep } from "@/lib/onboarding/status";
import { cn } from "@/lib/utils";

/**
 * The first thing a new fleet sees.
 *
 * Renders only while setup is incomplete, and every tick is derived from real
 * state (see lib/onboarding/status.ts) rather than from a dismiss flag — so it
 * disappears because HostOS is actually working, not because someone clicked
 * past it. The step that matters is pairing the extension: until that happens
 * every card on this page is empty and nothing else explains why.
 */
export function SetupChecklist({ status }: { status: SetupStatus }) {
  if (status.unavailable) {
    return (
      <div className="rounded-2xl border border-warning/30 bg-warning/5 p-5">
        <p className="text-[14px] font-semibold tracking-tight">Setting up your fleet</p>
        <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
          HostOS couldn&rsquo;t reach its database to finish creating your fleet. This is a
          server-side problem, not something you did — reload in a moment and it should complete.
        </p>
      </div>
    );
  }

  if (status.complete) return null;

  const required = status.steps.filter((s) => !s.optional);
  const done = required.filter((s) => s.done).length;

  // The first thing still to do. Highlighted so there is exactly one obvious
  // next action rather than four equally-weighted rows.
  const nextId = status.steps.find((s) => !s.done)?.id ?? null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      aria-labelledby="setup-heading"
      className="overflow-hidden rounded-2xl border border-accent/25 bg-card shadow-[var(--shadow-card)]"
    >
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-border px-5 py-4">
        <div>
          <h2 id="setup-heading" className="text-[15px] font-semibold tracking-tight">
            Finish setting up HostOS
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Your dashboard stays empty until the Companion extension sends its first sync.
          </p>
        </div>
        <p className="text-[12px] tabular-nums text-muted-foreground">
          {done} of {required.length}
        </p>
      </div>

      <ol className="divide-y divide-border">
        {status.steps.map((step) => (
          <StepRow key={step.id} step={step} isNext={step.id === nextId} />
        ))}
      </ol>
    </motion.section>
  );
}

function StepRow({ step, isNext }: { step: SetupStep; isNext: boolean }) {
  return (
    <li className={cn("flex items-start gap-3 px-5 py-4", isNext && "bg-accent/[0.04]")}>
      <span className="mt-0.5 shrink-0" aria-hidden>
        {step.done ? (
          <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-success/15">
            <Check className="h-3 w-3 text-success" strokeWidth={2.5} />
          </span>
        ) : (
          <Circle
            className={cn("h-[18px] w-[18px]", isNext ? "text-accent" : "text-muted-foreground/40")}
            strokeWidth={1.75}
          />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[13.5px] font-medium tracking-tight",
            step.done && "text-muted-foreground line-through decoration-muted-foreground/40"
          )}
        >
          {step.title}
          {step.optional && (
            <span className="ml-2 text-[11px] font-normal uppercase tracking-wide text-muted-foreground/85">
              Optional
            </span>
          )}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
          {step.description}
        </p>
      </div>

      {!step.done && (
        <Link
          href={step.href}
          className={cn(
            "mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-opacity hover:opacity-90",
            isNext
              ? "bg-accent text-accent-foreground"
              : "border border-border text-foreground"
          )}
        >
          {step.cta}
          <ArrowRight className="h-3 w-3" aria-hidden />
        </Link>
      )}
    </li>
  );
}
