"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowUpRight, Bot, Check, CheckSquare, Circle, Clock3, Plus, RotateCcw, Sparkles, Trash2, Workflow, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { addTask, removeTask, setTaskPriority, setTaskStatus } from "@/lib/actions/tasks";
import { runButlerNow } from "@/lib/actions/butler";
import type { Task, TaskPriority, TaskStatus } from "@/lib/tasks/queries";
import { cn, formatRelativeTime } from "@/lib/utils";
import { useNow } from "@/lib/hooks/use-client-value";

const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; variant: "danger" | "warning" | "accent" | "neutral" }> = {
  critical: { label: "Critical", dot: "bg-danger", variant: "danger" },
  high: { label: "High", dot: "bg-warning", variant: "warning" },
  medium: { label: "Medium", dot: "bg-accent", variant: "accent" },
  low: { label: "Low", dot: "bg-muted-foreground", variant: "neutral" },
};

const SOURCE_ICON = { manual: CheckSquare, butler: Bot, automation: Workflow } as const;

const FILTERS: { id: "active" | "done" | "dismissed" | "all"; label: string }[] = [
  { id: "active", label: "Active" },
  { id: "done", label: "Done" },
  { id: "dismissed", label: "Dismissed" },
  { id: "all", label: "All" },
];

function dueLabel(dueAt: string | null, now: number): { text: string; overdue: boolean } | null {
  if (!dueAt) return null;
  const diff = Date.parse(dueAt) - now;
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.round(abs / 3600_000);
  const text = h < 1 ? "now" : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`;
  return { text: overdue ? `overdue ${text}` : `due in ${text}`, overdue };
}

function NewTaskDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await addTask({
        title: String(fd.get("title") ?? ""),
        description: String(fd.get("description") ?? ""),
        priority: String(fd.get("priority") ?? "medium"),
        dueAt: String(fd.get("dueAt") ?? "") || null,
        assigneeEmail: String(fd.get("assignee") ?? "") || null,
      });
      if (!result.ok) return void toast.error(result.error ?? "Couldn't create the task.");
      toast.success("Task added");
      onOpenChange(false);
      router.refresh();
    });
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Visible to everyone on the workspace.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="t-title">Title</Label>
              <Input id="t-title" name="title" required autoFocus placeholder="Send Rebecca the lockbox code" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-desc">Details</Label>
              <Textarea id="t-desc" name="description" rows={3} />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="t-pri">Priority</Label>
                <NativeSelect id="t-pri" name="priority" defaultValue="medium">
                  {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_META[p].label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-due">Due</Label>
                <Input id="t-due" name="dueAt" type="datetime-local" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="t-who">Assignee email</Label>
                <Input id="t-who" name="assignee" type="email" placeholder="Optional" />
              </div>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={pending}>
              Add task
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TaskRow({ task, canEdit, onChange }: { task: Task; canEdit: boolean; onChange: () => void }) {
  const [pending, startTransition] = React.useTransition();
  const now = useNow();
  const due = dueLabel(task.dueAt, now);
  const done = task.status === "done";
  const dismissed = task.status === "dismissed";
  const SourceIcon = SOURCE_ICON[task.source];

  function set(status: TaskStatus) {
    startTransition(async () => {
      const result = await setTaskStatus(task.id, status);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't update.");
      onChange();
    });
  }
  function priority(p: string) {
    startTransition(async () => {
      const result = await setTaskPriority(task.id, p);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't update.");
      onChange();
    });
  }
  function remove() {
    startTransition(async () => {
      const result = await removeTask(task.id);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't delete.");
      onChange();
    });
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 24, transition: { duration: 0.2 } }}
      className={cn("group flex items-start gap-3 px-5 py-3.5", (done || dismissed) && "opacity-60")}
    >
      <button
        type="button"
        aria-label={done ? "Reopen" : "Mark done"}
        disabled={!canEdit || pending}
        onClick={() => set(done ? "open" : "done")}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all duration-200 ease-[var(--ease-out-expo)] active:scale-90",
          done ? "border-success bg-success text-white" : "border-border-strong hover:border-accent"
        )}
      >
        {done ? <Check className="h-3 w-3" /> : task.status === "in_progress" ? <Circle className="h-2 w-2 fill-accent text-accent" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("text-[13.5px] font-medium", done && "line-through")}>{task.title}</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
            <SourceIcon className="h-3 w-3" /> {task.source === "butler" ? "Butler" : task.source === "automation" ? "Automation" : task.createdBy?.split("@")[0] ?? "manual"}
          </span>
        </div>
        {task.description && <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-[12.5px] leading-relaxed text-muted-foreground">{task.description}</p>}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className={cn("h-1.5 w-1.5 rounded-full", PRIORITY_META[task.priority].dot)} /> {PRIORITY_META[task.priority].label}
          </span>
          {due && (
            <span className={cn("inline-flex items-center gap-1", due.overdue && !done && "font-medium text-danger")}>
              <Clock3 className="h-3 w-3" /> {due.text}
            </span>
          )}
          {task.assigneeEmail && <span>→ {task.assigneeEmail.split("@")[0]}</span>}
          <span>{formatRelativeTime(task.createdAt)}</span>
          {task.href && (
            <Link href={task.href} className="inline-flex items-center gap-0.5 text-accent hover:underline">
              Open <ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
      {canEdit && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          {!done && !dismissed && (
            <NativeSelect className="h-7 w-24 text-[11.5px]" value={task.priority} disabled={pending} onChange={(e) => priority(e.target.value)} aria-label="Priority">
              {(["critical", "high", "medium", "low"] as TaskPriority[]).map((p) => (
                <option key={p} value={p}>
                  {PRIORITY_META[p].label}
                </option>
              ))}
            </NativeSelect>
          )}
          {!done && !dismissed && task.status !== "in_progress" && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-[11.5px]" disabled={pending} onClick={() => set("in_progress")}>
              Start
            </Button>
          )}
          {dismissed ? (
            <Button variant="ghost" size="icon-sm" aria-label="Reopen" disabled={pending} onClick={() => set("open")}>
              <RotateCcw />
            </Button>
          ) : (
            !done && (
              <Button variant="ghost" size="icon-sm" aria-label="Dismiss" disabled={pending} onClick={() => set("dismissed")}>
                <X />
              </Button>
            )
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Delete" disabled={pending} onClick={remove}>
            <Trash2 />
          </Button>
        </div>
      )}
    </motion.li>
  );
}

export function TaskBoard({ tasks, canEdit }: { tasks: Task[]; canEdit: boolean }) {
  const router = useRouter();
  const search = useSearchParams();
  const [filter, setFilter] = React.useState<(typeof FILTERS)[number]["id"]>("active");
  const [open, setOpen] = React.useState(search.get("new") === "1");
  const [running, startRun] = React.useTransition();
  const now = useNow();

  const visible = tasks.filter((t) =>
    filter === "all" ? true : filter === "active" ? t.status === "open" || t.status === "in_progress" : t.status === filter
  );
  const active = tasks.filter((t) => t.status === "open" || t.status === "in_progress");
  const overdue = active.filter((t) => t.dueAt && Date.parse(t.dueAt) < now).length;

  function refresh() {
    startRun(async () => {
      const result = await runButlerNow();
      if (!result.ok) return void toast.error(result.error ?? "The Butler couldn't run.");
      toast.success(result.tasksCreated > 0 ? `Butler filed ${result.tasksCreated} new task${result.tasksCreated === 1 ? "" : "s"}` : "Nothing new to file — you're caught up");
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold tracking-tight">Tasks</h1>
          <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">
            {active.length} active{overdue > 0 ? ` · ${overdue} overdue` : ""} · filed by the team, the Butler and your automations.
          </p>
        </div>
        <div className="flex gap-2">
          {canEdit && (
            <Button variant="secondary" onClick={refresh} loading={running}>
              <Sparkles className="text-accent" /> Ask the Butler to review
            </Button>
          )}
          {canEdit && (
            <Button variant="primary" onClick={() => setOpen(true)}>
              <Plus /> New task
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-full border border-border bg-muted/50 p-1 w-fit">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={cn("relative rounded-full px-3 py-1 text-[12.5px] font-medium transition-colors", filter === f.id ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {filter === f.id && <motion.span layoutId="task-filter" transition={{ type: "spring", stiffness: 500, damping: 40 }} className="absolute inset-0 -z-10 rounded-full bg-card shadow-[var(--shadow-card)]" />}
            {f.label}
            {f.id === "active" && active.length > 0 && <span className="ml-1.5 text-[11px] text-muted-foreground">{active.length}</span>}
          </button>
        ))}
      </div>

      <Card>
        {visible.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <CheckSquare className="mx-auto h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
            <p className="mt-3 text-[14px] font-medium">{filter === "active" ? "Nothing to do right now" : "Nothing here"}</p>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {filter === "active" ? "The Butler files a task the moment something needs a person — an unverified license, a paused store, a menu out of sync." : "Tasks you complete or dismiss land here."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {visible.map((t) => (
                <TaskRow key={t.id} task={t} canEdit={canEdit} onChange={() => router.refresh()} />
              ))}
            </AnimatePresence>
          </ul>
        )}
      </Card>

      <NewTaskDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
