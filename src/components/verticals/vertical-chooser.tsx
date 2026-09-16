"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ArrowRight, Check, Lock, Pencil, Sparkles } from "lucide-react";
import { MODULE_ICONS } from "@/components/modules/module-icon";
import { Button } from "@/components/ui/button";
import { chooseVertical } from "@/lib/actions/verticals";
import { renameFleet } from "@/lib/actions/host";
import { setWorkspaceModules } from "@/lib/actions/workspace";
import { useRouter } from "next/navigation";
import { MODULES, type WorkspaceModule } from "@/lib/modules";
import { routes } from "@/lib/routes";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * The first screen after sign-in: which business are we running HostOS for
 * today? One card per vertical, each designed for its line of business.
 * Picking one focuses the shell on it and opens its dashboard; a vertical the
 * workspace hasn't switched on is enabled on the way (settings permission
 * required — everyone else sees it locked with the reason).
 */
export function VerticalChooser({
  firstName,
  enabled,
  workspaceEnabled = enabled,
  current,
  canEnable,
  workspaceName,
}: {
  firstName: string | null;
  /** The verticals this person may open here. */
  enabled: WorkspaceModule[];
  /** Everything the workspace runs — a superset of `enabled` for a member limited to some of them. */
  workspaceEnabled?: WorkspaceModule[];
  current: WorkspaceModule | null;
  canEnable: boolean;
  workspaceName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [choosing, setChoosing] = React.useState<WorkspaceModule | null>(null);
  const [renaming, setRenaming] = React.useState(false);
  const [name, setName] = React.useState(workspaceName);

  // A fresh server render after a rename carries the new name; adopt it.
  const [seenName, setSeenName] = React.useState(workspaceName);
  if (seenName !== workspaceName) {
    setSeenName(workspaceName);
    setName(workspaceName);
  }

  function submitRename(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const next = name.trim();
    if (!next || next === workspaceName) return void setRenaming(false);
    startTransition(async () => {
      const result = await renameFleet(next);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't rename the workspace.");
      toast.success(`Workspace renamed to ${result.name}`);
      setRenaming(false);
      router.refresh();
    });
  }

  function turnOff(id: WorkspaceModule) {
    const next = enabled.filter((m) => m !== id);
    if (next.length === 0) return void toast.error("Keep at least one vertical on.");
    startTransition(async () => {
      const result = await setWorkspaceModules(next);
      if (!result.ok) return void toast.error(result.error ?? "Couldn't switch it off.");
      toast.success(`${MODULES.find((m) => m.id === id)?.title} switched off`);
      router.refresh();
    });
  }

  function choose(id: WorkspaceModule) {
    setChoosing(id);
    startTransition(async () => {
      const result = await chooseVertical(id);
      // A successful choice redirects; only failures come back.
      if (result && !result.ok) {
        toast.error(result.error);
        setChoosing(null);
      }
    });
  }

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* The same ambient backdrop as the landing hero: this is the front door of the product. Clipped so it can never widen the page. */}
      <div aria-hidden className="pointer-events-none absolute -inset-y-10 inset-x-0 -z-10 overflow-hidden rounded-[2rem]">
        <div className="bg-grid absolute inset-0 opacity-70" />
        <div className="absolute -left-10 top-0 h-64 w-64 rounded-full bg-accent/15 blur-3xl animate-drift" />
        <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-accent-2/12 blur-3xl animate-drift-slow" />
      </div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }} className="mb-8 text-center">
        {renaming ? (
          <form onSubmit={submitRename} className="mx-auto flex max-w-sm items-center justify-center gap-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus
              aria-label="Workspace name"
              className="h-9 w-full rounded-lg border border-accent/50 bg-card px-3 text-center text-[13px] font-semibold uppercase tracking-[0.1em] outline-none"
            />
            <Button type="submit" variant="primary" size="sm" loading={pending}>
              Save
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => { setName(workspaceName); setRenaming(false); }}>
              Cancel
            </Button>
          </form>
        ) : (
          <p className="inline-flex items-center gap-2 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-accent">
            {workspaceName}
            {canEnable && (
              <button type="button" onClick={() => setRenaming(true)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" aria-label="Rename workspace" title="Rename workspace">
                <Pencil className="h-3 w-3" />
              </button>
            )}
          </p>
        )}
        <h1 className="mt-2 text-balance text-[30px] font-semibold tracking-tight sm:text-[38px]">
          {firstName ? `${firstName}, which` : "Which"} business are we running today?
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-pretty text-[15px] text-muted-foreground">
          Every vertical gets its own command center — only the tools that work for that line of business, nothing else in the way. Switch any time from the sidebar.
        </p>
      </motion.div>

      <motion.div initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } } }} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {MODULES.map((m) => {
          const Icon = MODULE_ICONS[m.icon];
          const on = enabled.includes(m.id);
          // Runs in the workspace, but this member wasn't given it.
          const unassigned = !on && workspaceEnabled.includes(m.id);
          const locked = unassigned || (!on && !canEnable);
          const isCurrent = current === m.id;
          return (
            <motion.div key={m.id} variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }} className="flex flex-col">
            <motion.button
              type="button"
              disabled={pending || locked}
              onClick={() => choose(m.id)}
              whileHover={locked ? undefined : { y: -4 }}
              whileTap={locked ? undefined : { scale: 0.985 }}
              style={{ ["--hue" as string]: m.hue, ["--spot" as string]: m.hue }}
              className={cn(
                "spot group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-card p-5 text-left shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-300 hover:shadow-[var(--shadow-card-hover)]",
                isCurrent ? "border-[var(--hue)]" : "border-border hover:border-[color-mix(in_oklab,var(--hue)_55%,var(--border))]",
                locked && "cursor-not-allowed opacity-70"
              )}
            >
              <div aria-hidden className="pointer-events-none absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-30 blur-3xl transition-opacity duration-500 group-hover:opacity-60" style={{ background: m.hue }} />
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:-rotate-3 group-hover:scale-110" style={{ background: `color-mix(in oklab, ${m.hue} 16%, transparent)`, color: m.hue }}>
                  <Icon className="h-5 w-5" strokeWidth={1.75} />
                </span>
                <span className="flex items-center gap-1.5">
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-semibold" style={{ background: `color-mix(in oklab, ${m.hue} 18%, transparent)`, color: m.hue }}>
                      <Check className="h-3 w-3" /> Current
                    </span>
                  )}
                  {locked ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      <Lock className="h-3 w-3" /> {unassigned ? "Not assigned to you" : "Ask an admin"}
                    </span>
                  ) : !on ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10.5px] font-medium text-muted-foreground">
                      <Sparkles className="h-3 w-3" /> Set up
                    </span>
                  ) : null}
                </span>
              </div>
              <h2 className="mt-4 text-[19px] font-semibold tracking-tight">{m.title}</h2>
              <p className="text-[12px] font-medium text-muted-foreground">{m.label}</p>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{m.description}</p>
              <ul className="mt-3 space-y-1">
                {m.outcomes.map((o) => (
                  <li key={o} className="flex items-start gap-2 text-[12.5px] text-foreground/85">
                    <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: m.hue }} />
                    {o}
                  </li>
                ))}
              </ul>
              <span className="mt-auto flex items-center gap-1 pt-4 text-[13px] font-semibold" style={{ color: m.hue }}>
                {choosing === m.id ? "Opening…" : on ? "Open dashboard" : unassigned ? "Ask an owner or admin" : locked ? "Not switched on" : "Set up and open"}
                <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </motion.button>
            {on && !isCurrent && canEnable && enabled.length > 1 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => turnOff(m.id)}
                className="mt-1.5 self-end rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Switch {m.title} off for this workspace
              </button>
            )}
            </motion.div>
          );
        })}
      </motion.div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-8 flex flex-wrap items-center justify-center gap-3 text-[13px] text-muted-foreground">
        <Button asChild variant="ghost" size="sm">
          <Link href={routes.overview}>Or see every business at once →</Link>
        </Button>
      </motion.div>
    </div>
  );
}
