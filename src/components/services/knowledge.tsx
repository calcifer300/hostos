"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { BookOpenCheck, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { removeDoc, saveDoc } from "@/lib/actions/services";
import type { ServiceDoc } from "@/lib/services/types";
import { cn, formatRelativeTime } from "@/lib/utils";

const KINDS: ServiceDoc["kind"][] = ["sop", "policy", "guide", "faq", "handbook", "training"];
const KIND_LABEL: Record<ServiceDoc["kind"], string> = { sop: "SOP", policy: "Policy", guide: "Guide", faq: "FAQ", handbook: "Handbook", training: "Training" };

/**
 * The business's knowledge center: SOPs, policies, guides, FAQs. Seeded
 * from the industry template, edited here, and the source the AI assistant
 * will answer from. Numbered lines render as steps.
 */
export function KnowledgeCenter({ docs, canEdit }: { docs: ServiceDoc[]; canEdit: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<string | null>(docs[0]?.id ?? null);
  const [editing, setEditing] = React.useState<{ id: string | null; kind: ServiceDoc["kind"]; title: string; body: string } | null>(null);
  const [kindFilter, setKindFilter] = React.useState<"" | ServiceDoc["kind"]>("");
  const current = docs.find((d) => d.id === selected) ?? null;
  const list = docs.filter((d) => !kindFilter || d.kind === kindFilter);

  function save() {
    if (!editing) return;
    startTransition(async () => {
      const r = await saveDoc(editing);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't save.");
      toast.success("Saved");
      setEditing(null);
      router.refresh();
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const r = await removeDoc(id);
      if (!r.ok) return void toast.error(r.error ?? "Couldn't delete.");
      setSelected(null);
      router.refresh();
    });
  }

  const steps = (body: string) => body.split("\n").filter((l) => l.trim());

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
      <Card className="self-start">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <NativeSelect value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className="h-8 text-[12.5px]" aria-label="Kind"><option value="">Everything</option>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}s</option>)}</NativeSelect>
          {canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing({ id: null, kind: "sop", title: "", body: "" })}><Plus /></Button>}
        </div>
        <ul className="max-h-[70vh] divide-y divide-border overflow-y-auto">
          {list.length === 0 && <li className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">Nothing here yet. Apply an industry template from the dashboard, or write your first SOP.</li>}
          {list.map((d) => (
            <li key={d.id}>
              <button type="button" onClick={() => { setSelected(d.id); setEditing(null); }} className={cn("block w-full px-4 py-2.5 text-left transition-colors hover:bg-muted/60", selected === d.id && "bg-accent/[0.07]")}>
                <p className="flex items-center gap-2 text-[13px] font-medium"><span className="rounded-full bg-muted px-1.5 py-px text-[10px] font-semibold uppercase text-muted-foreground">{KIND_LABEL[d.kind]}</span><span className="truncate">{d.title}</span></p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{steps(d.body).length} lines · {formatRelativeTime(d.updatedAt)}</p>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <AnimatePresence mode="wait">
        {editing ? (
          <motion.div key="edit" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Card padding="md">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
                <div className="space-y-1.5"><Label htmlFor="d-title">Title</Label><Input id="d-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Windshield replacement — safe drive-away time" /></div>
                <div className="space-y-1.5"><Label htmlFor="d-kind">Kind</Label><NativeSelect id="d-kind" value={editing.kind} onChange={(e) => setEditing({ ...editing, kind: e.target.value as ServiceDoc["kind"] })}>{KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</NativeSelect></div>
              </div>
              <div className="mt-3 space-y-1.5"><Label htmlFor="d-body">Steps (one per line)</Label><Textarea id="d-body" rows={14} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} placeholder={"1. Lead arrives → log it with source\n2. Call back within 15 minutes\n3. …"} /></div>
              <div className="mt-3 flex gap-2">
                <Button variant="primary" loading={pending} onClick={save}>Save</Button>
                <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </Card>
          </motion.div>
        ) : current ? (
          <motion.div key={current.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
            <Card padding="lg">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">{KIND_LABEL[current.kind]}</p>
                  <h2 className="mt-1 text-[22px] font-semibold tracking-tight">{current.title}</h2>
                  <p className="mt-1 text-[12px] text-muted-foreground">Updated {formatRelativeTime(current.updatedAt)}</p>
                </div>
                {canEdit && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="secondary" onClick={() => setEditing({ id: current.id, kind: current.kind, title: current.title, body: current.body })}>Edit</Button>
                    <Button size="sm" variant="ghost" aria-label="Delete" disabled={pending} onClick={() => remove(current.id)}><Trash2 /></Button>
                  </div>
                )}
              </div>
              <ol className="mt-5 space-y-2.5">
                {steps(current.body).map((line, i) => {
                  const text = line.replace(/^\d+[.)]\s*/, "");
                  return (
                    <motion.li key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex gap-3 text-[14px] leading-relaxed">
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-[11.5px] font-semibold text-accent">{i + 1}</span>
                      <span>{text}</span>
                    </motion.li>
                  );
                })}
              </ol>
            </Card>
          </motion.div>
        ) : (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex min-h-[300px] items-center justify-center rounded-2xl border border-dashed border-border text-center text-[13px] text-muted-foreground">
            <div><BookOpenCheck className="mx-auto mb-2 h-6 w-6" />Pick a document, or add one.</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
