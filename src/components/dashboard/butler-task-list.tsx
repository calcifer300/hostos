"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { SuggestionActionLink } from "@/components/dashboard/suggestion-action-link";
import { suggestionMeta } from "@/components/dashboard/suggestion-meta";
import { cn } from "@/lib/utils";
import type { Suggestion, SuggestionPriority } from "@/lib/dashboard/queries";

const PRIORITY_STYLE: Record<SuggestionPriority, { border: string; iconBg: string; iconText: string; ring: string }> = {
  high: { border: "border-l-danger", iconBg: "bg-danger-bg", iconText: "text-danger", ring: "ring-danger/15" },
  medium: { border: "border-l-warning", iconBg: "bg-warning-bg", iconText: "text-warning", ring: "ring-warning/15" },
  low: { border: "border-l-success", iconBg: "bg-success-bg", iconText: "text-success", ring: "ring-success/15" },
};

const PRIORITY_SECTION_LABEL: Record<SuggestionPriority, string> = {
  high: "Needs you now",
  medium: "Worth a look today",
  low: "When you have a minute",
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const cardVariant = {
  hidden: { opacity: 0, y: 10, scale: 0.98 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};

function TaskCard({ suggestion, compact }: { suggestion: Suggestion; compact?: boolean }) {
  const { icon: Icon, label } = suggestionMeta(suggestion);
  const style = PRIORITY_STYLE[suggestion.priority];

  return (
    <motion.div
      layout
      variants={cardVariant}
      whileHover={{ y: -2 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-l-[3px] border-border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-lg",
        style.border,
        compact ? "p-3.5" : "p-5"
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full ring-4",
            style.iconBg,
            style.iconText,
            style.ring,
            compact ? "h-8 w-8" : "h-9 w-9"
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-[18px] w-[18px]"} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={cn("font-medium tracking-tight", compact ? "text-[13px]" : "text-[14px]")}>
              {suggestion.title}
            </p>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide",
                style.iconBg,
                style.iconText
              )}
            >
              {label}
            </span>
          </div>
          <p className={cn("mt-1 leading-relaxed text-muted-foreground", compact ? "text-[12px]" : "text-[13px]")}>
            {suggestion.description}
          </p>
          <SuggestionActionLink
            suggestion={suggestion}
            className={cn(
              "mt-2.5 inline-block font-medium text-accent transition-opacity hover:opacity-80",
              compact ? "text-[12px]" : "text-[13px]"
            )}
          />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Renders Butler's to-do feed (src/lib/dashboard/queries.ts's Suggestion[],
 * now dominated by src/lib/butler/priority.ts's message-driven tasks) as
 * grouped, prioritized cards instead of one flat list — the same triage
 * order a human ops lead would read it in: what needs you *now* (guest
 * safety/access asks, overdue-and-waiting returns), what's worth a look
 * today, and what can wait.
 */
export function ButlerTaskList({
  suggestions,
  compact = false,
  groupByPriority = true,
}: {
  suggestions: Suggestion[];
  compact?: boolean;
  groupByPriority?: boolean;
}) {
  if (suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-card/50 px-5 py-8 text-center">
        <CheckCircle2 className="h-5 w-5 text-success" strokeWidth={1.75} />
        <p className="text-[13px] font-medium">Nothing needs your attention right now</p>
        <p className="text-[12px] text-muted-foreground">
          Butler scans guest messages and trip data continuously — this updates the moment something needs you.
        </p>
      </div>
    );
  }

  if (!groupByPriority) {
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
        <AnimatePresence initial={false}>
          {suggestions.map((s) => (
            <TaskCard key={s.id} suggestion={s} compact={compact} />
          ))}
        </AnimatePresence>
      </motion.div>
    );
  }

  const groups: Record<SuggestionPriority, Suggestion[]> = { high: [], medium: [], low: [] };
  for (const s of suggestions) groups[s.priority].push(s);

  return (
    <div className="space-y-6">
      {(["high", "medium", "low"] as SuggestionPriority[]).map((priority) => {
        const items = groups[priority];
        if (items.length === 0) return null;
        return (
          <div key={priority}>
            <h3 className="mb-2.5 flex items-center gap-2 px-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
              {PRIORITY_SECTION_LABEL[priority]}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10.5px] font-semibold text-foreground">
                {items.length}
              </span>
            </h3>
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-3">
              <AnimatePresence initial={false}>
                {items.map((s) => (
                  <TaskCard key={s.id} suggestion={s} compact={compact} />
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        );
      })}
    </div>
  );
}
