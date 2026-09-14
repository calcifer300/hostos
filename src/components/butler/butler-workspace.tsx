"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowUpRight, Bot, BookMarked, ExternalLink, Info, ListChecks, MessageSquareText, RefreshCw, Send, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { askButler, draftFleetReply, runButlerNow } from "@/lib/actions/butler";
import { ButlerTaskList } from "@/components/dashboard/butler-task-list";
import { AutomationRow } from "@/components/automations/automation-row";
import { AUTOMATIONS, CATEGORY_LABELS, type AutomationCategory } from "@/lib/automations/definitions";
import type { Suggestion } from "@/lib/dashboard/queries";
import type { Task } from "@/lib/tasks/queries";
import { routes } from "@/lib/routes";
import { cn, formatRelativeTime } from "@/lib/utils";

type Turn =
  | { id: string; role: "user"; text: string }
  | { id: string; role: "butler"; text: string; sources: { title: string; url: string | null }[]; uncertain?: boolean; escalate?: boolean; kind: "answer" | "draft" };

const STARTERS = [
  "What is Turo's policy when a guest returns the car late?",
  "Can a guest add an additional driver the day of the trip?",
  "Draft a reply: \"Hi, my flight lands at 11pm, can I pick up the car later?\"",
  "What should I do about a Premier protection booking?",
];

const CATEGORY_ORDER: AutomationCategory[] = ["messaging", "operations", "monitoring"];

function ChatPanel() {
  const [turns, setTurns] = React.useState<Turn[]>([]);
  const [input, setInput] = React.useState("");
  const [pending, startTransition] = React.useTransition();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns.length, pending]);

  function send(text: string) {
    const q = text.trim();
    if (!q || pending) return;
    setInput("");
    setTurns((t) => [...t, { id: crypto.randomUUID(), role: "user", text: q }]);
    const isDraft = /^draft(\s+a)?\s+reply\s*:/i.test(q);
    startTransition(async () => {
      if (isDraft) {
        const message = q.replace(/^draft(\s+a)?\s+reply\s*:\s*/i, "").replace(/^["“]|["”]$/g, "");
        const result = await draftFleetReply({ message });
        setTurns((t) => [
          ...t,
          result.ok
            ? { id: crypto.randomUUID(), role: "butler", kind: "draft", text: result.draft || "No reply is needed for that message.", sources: result.sources.map((s) => ({ title: s, url: null })), escalate: result.escalate }
            : { id: crypto.randomUUID(), role: "butler", kind: "answer", text: result.error ?? "I couldn't draft that.", sources: [], uncertain: true },
        ]);
        return;
      }
      const result = await askButler(q);
      setTurns((t) => [
        ...t,
        result.ok
          ? { id: crypto.randomUUID(), role: "butler", kind: "answer", text: result.answer, sources: result.sources, uncertain: result.uncertain }
          : { id: crypto.randomUUID(), role: "butler", kind: "answer", text: result.error ?? "I couldn't answer that.", sources: [], uncertain: true },
      ]);
    });
  }

  return (
    <Card className="flex min-h-[520px] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {turns.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white shadow-[var(--shadow-glow)]">
              <Bot className="h-6 w-6" />
            </span>
            <p className="mt-4 text-[15px] font-semibold tracking-tight">Ask the Butler anything about your operation.</p>
            <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">
              Answers come from your knowledge base and Turo&rsquo;s 725 policy articles, with sources. Start a message with &ldquo;Draft a reply:&rdquo; to get a grounded reply to a guest.
            </p>
            <div className="mt-6 grid w-full max-w-lg grid-cols-1 gap-2 sm:grid-cols-2">
              {STARTERS.map((s) => (
                <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-border bg-background/40 px-3.5 py-2.5 text-left text-[12.5px] text-foreground/85 transition-colors hover:border-accent/40 hover:bg-accent/5">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={cn("flex gap-3", t.role === "user" && "justify-end")}>
              {t.role === "butler" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white">
                  <Bot className="h-3.5 w-3.5" />
                </span>
              )}
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed", t.role === "user" ? "bg-accent text-accent-foreground" : "bg-muted text-foreground")}>
                {t.role === "butler" && t.kind === "draft" && (
                  <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                    <Sparkles className="h-3 w-3" /> Draft reply{t.escalate ? " · review before sending" : ""}
                  </p>
                )}
                <p className="whitespace-pre-wrap">{t.text}</p>
                {t.role === "butler" && t.uncertain && t.kind === "answer" && (
                  <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-warning">
                    <Info className="h-3 w-3" /> Not fully covered by your sources — confirm before relying on it.
                  </p>
                )}
                {t.role === "butler" && t.sources.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {t.sources.map((s) =>
                      s.url ? (
                        <a key={s.title} href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-accent hover:underline">
                          <BookMarked className="h-3 w-3" /> {s.title} <ExternalLink className="h-2.5 w-2.5" />
                        </a>
                      ) : (
                        <span key={s.title} className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                          {s.title}
                        </span>
                      )
                    )}
                  </div>
                )}
              </div>
              {t.role === "user" && (
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {pending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </span>
            Reading your knowledge base and Turo policy…
          </motion.div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-end gap-2 border-t border-border p-3"
      >
        <Textarea
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Ask a policy question, or “Draft a reply: …”"
          className="min-h-[40px] flex-1"
        />
        <Button type="submit" variant="gradient" size="icon" aria-label="Send" disabled={!input.trim() || pending}>
          <Send />
        </Button>
      </form>
    </Card>
  );
}

export function ButlerWorkspace({
  suggestions,
  tasks,
  automationSettings,
  canEdit,
  aiConfigured,
}: {
  suggestions: Suggestion[];
  tasks: Task[];
  automationSettings: Record<string, boolean>;
  canEdit: boolean;
  aiConfigured: boolean;
}) {
  const router = useRouter();
  const [running, startRun] = React.useTransition();
  const filed = tasks.filter((t) => t.source !== "manual" && (t.status === "open" || t.status === "in_progress"));
  const enabledCount = AUTOMATIONS.filter((a) => automationSettings[a.id]).length;

  function run() {
    startRun(async () => {
      const result = await runButlerNow();
      if (!result.ok) return void toast.error(result.error ?? "The Butler couldn't run.");
      toast.success(`Reviewed ${result.signals.length} signals · ${result.tasksCreated} new tasks · ${result.notificationsCreated} notifications`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white shadow-[var(--shadow-glow)]">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">HostOS AI</p>
            <h1 className="text-[26px] font-semibold tracking-tight">Butler</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!aiConfigured && <Badge variant="warning">AI not configured — rules still run</Badge>}
          {canEdit && (
            <Button variant="secondary" onClick={run} loading={running}>
              <RefreshCw /> Review the workspace now
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="ask">
        <TabsList className="mb-4">
          <TabsTrigger value="ask">
            <MessageSquareText className="h-3.5 w-3.5" /> Ask
          </TabsTrigger>
          <TabsTrigger value="filed">
            <ListChecks className="h-3.5 w-3.5" /> Filed for you {filed.length > 0 && <span className="rounded-full bg-accent/15 px-1.5 text-[10.5px] font-semibold text-accent">{filed.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions {suggestions.length > 0 && <span className="text-[11px] text-muted-foreground">{suggestions.length}</span>}</TabsTrigger>
          <TabsTrigger value="automations">Automations</TabsTrigger>
        </TabsList>

        <TabsContent value="ask">
          <ChatPanel />
        </TabsContent>

        <TabsContent value="filed">
          <Card>
            {filed.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <p className="text-[14px] font-medium">Nothing filed right now</p>
                <p className="mt-1 text-[13px] text-muted-foreground">The Butler files a task when it sees an unverified license, an overdue return, a paused store, low stock or a menu out of sync. It reviews every 15 minutes.</p>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filed.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 px-5 py-3.5">
                    <Bot className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{t.title}</p>
                      {t.description && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-muted-foreground">{t.description}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground/70">
                        {t.priority} · {formatRelativeTime(t.createdAt)}
                      </p>
                    </div>
                    <Link href={t.href ?? routes.tasks} className="inline-flex items-center gap-1 text-[12.5px] text-accent hover:underline">
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-border px-5 py-3">
              <Link href={routes.tasks} className="text-[12.5px] font-medium text-accent hover:underline">
                All tasks →
              </Link>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="suggestions">
          <div className="mb-3 flex gap-3 rounded-xl border border-border bg-background/40 px-4 py-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <p className="text-[13px] leading-relaxed text-muted-foreground">Computed from rules over your synced data — no model involved — so they are always available, even without an AI key.</p>
          </div>
          <ButlerTaskList suggestions={suggestions} />
        </TabsContent>

        <TabsContent value="automations">
          <div className="mb-3 flex items-center justify-between px-1">
            <p className="text-[12.5px] text-muted-foreground">Rules that will act on your behalf once each executor ships. Toggling records your intent per workspace.</p>
            <span className="text-[12px] text-muted-foreground">{enabledCount} of {AUTOMATIONS.length} enabled</span>
          </div>
          <div className="space-y-6">
            {CATEGORY_ORDER.map((category) => {
              const rules = AUTOMATIONS.filter((a) => a.category === category);
              if (rules.length === 0) return null;
              return (
                <div key={category}>
                  <p className="mb-2 px-1 text-[11px] font-medium text-muted-foreground/80">{CATEGORY_LABELS[category]}</p>
                  <div className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]">
                    {rules.map((automation) => (
                      <AutomationRow key={automation.id} automation={automation} initialEnabled={Boolean(automationSettings[automation.id])} readOnly={!canEdit} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
