"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveKnowledgeBase } from "@/lib/actions/knowledge";
import type { HostKnowledgeBase } from "@/types/ihost";

const FIELDS: {
  key: keyof HostKnowledgeBase;
  label: string;
  hint: string;
  rows: number;
}[] = [
  {
    key: "checkInProcess",
    label: "Check-in process",
    hint: "How guests get the car: lockbox codes, parking spot, timing.",
    rows: 4,
  },
  {
    key: "houseRules",
    label: "House rules",
    hint: "What is and isn't allowed, and the constraints behind them.",
    rows: 4,
  },
  {
    key: "policy",
    label: "Cancellation, refund, and extension policy",
    hint: "The rules iHost must never contradict when drafting a reply.",
    rows: 4,
  },
  {
    key: "tone",
    label: "Tone",
    hint: "How replies should sound in your voice.",
    rows: 2,
  },
];

export function KnowledgeEditor({ initial }: { initial: HostKnowledgeBase }) {
  const [values, setValues] = React.useState<HostKnowledgeBase>(initial);
  const [isPending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const isDirty = FIELDS.some((f) => values[f.key] !== initial[f.key]);

  function update(key: keyof HostKnowledgeBase, value: string) {
    setValues((v) => ({ ...v, [key]: value }));
    setSaved(false);
    setError(null);
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveKnowledgeBase(values);
      if (res.ok) {
        setSaved(true);
        setError(null);
      } else {
        setError(res.error ?? "Could not save.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {FIELDS.map((field) => (
        <div
          key={field.key}
          className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]"
        >
          <label
            htmlFor={field.key}
            className="text-[13.5px] font-semibold tracking-tight"
          >
            {field.label}
          </label>
          <p className="mb-3 mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
            {field.hint}
          </p>
          <Textarea
            id={field.key}
            value={values[field.key]}
            onChange={(e) => update(field.key, e.target.value)}
            rows={field.rows}
          />
        </div>
      ))}

      <div className="flex items-center justify-between gap-4">
        <AnimatePresence mode="wait">
          {error && (
            <motion.p
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-[12.5px] leading-relaxed text-danger"
            >
              {error}
            </motion.p>
          )}
          {saved && !error && (
            <motion.p
              key="saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-1.5 text-[12.5px] text-success"
            >
              <Check className="h-3.5 w-3.5" />
              Saved. iHost will ground new replies in this.
            </motion.p>
          )}
        </AnimatePresence>

        <Button
          variant="primary"
          onClick={handleSave}
          disabled={isPending || !isDirty}
          className="ml-auto shrink-0"
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </div>
  );
}
