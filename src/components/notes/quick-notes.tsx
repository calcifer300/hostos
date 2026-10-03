"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { Pin, PinOff, Plus, StickyNote, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { addQuickNote, editQuickNote, pinQuickNote, removeQuickNote } from "@/lib/actions/notes";
import type { QuickNote } from "@/lib/notes/queries";
import { cn, formatRelativeTime } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;
const OPEN_KEY = "hostos:notes-open";
const TOGGLE_EVENT = "hostos:toggle-notes";

/** Opens or closes the panel from anywhere (the top bar, the command palette). */
export function toggleQuickNotes() {
  window.dispatchEvent(new Event(TOGGLE_EVENT));
}

/** Pinned first, then most recently touched — the order the server uses, kept after local edits. */
function sortNotes(list: QuickNote[]): QuickNote[] {
  return [...list].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));
}

function useAutosize(ref: React.RefObject<HTMLTextAreaElement | null>, value: string) {
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [ref, value]);
}

function Composer({ onAdd, pending }: { onAdd: (body: string) => void; pending: boolean }) {
  const [draft, setDraft] = React.useState("");
  const ref = React.useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, draft);

  function submit() {
    const body = draft.trim();
    if (!body) return;
    onAdd(body);
    setDraft("");
  }

  return (
    <div className="rounded-xl border border-border bg-background/60 p-2 transition-[border-color,box-shadow] focus-within:border-accent/60 focus-within:ring-2 focus-within:ring-accent/20">
      <textarea
        ref={ref}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
            e.preventDefault();
            submit();
          }
        }}
        rows={2}
        placeholder="Jot something down — it follows you everywhere."
        aria-label="New note"
        className="block w-full resize-none bg-transparent px-1.5 py-1 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground/80"
      />
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="hidden items-center gap-1 text-[11px] text-muted-foreground sm:flex">
          <Kbd>⌘</Kbd>
          <Kbd>↵</Kbd> to add
        </span>
        <Button size="sm" variant="primary" onClick={submit} disabled={!draft.trim()} loading={pending}>
          <Plus /> Add note
        </Button>
      </div>
    </div>
  );
}

function NoteCard({ note, onChange, onPin, onDelete }: { note: QuickNote; onChange: (body: string) => void; onPin: () => void; onDelete: () => void }) {
  const [body, setBody] = React.useState(note.body);
  const ref = React.useRef<HTMLTextAreaElement>(null);
  useAutosize(ref, body);

  // An edit made elsewhere (another tab, a refresh) wins over a stale local copy.
  const [seen, setSeen] = React.useState(note.body);
  if (seen !== note.body) {
    setSeen(note.body);
    setBody(note.body);
  }

  function commit() {
    const next = body.trim();
    if (!next || next === note.body) return void setBody(note.body);
    onChange(next);
  }

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.8 }}
      className={cn("group relative rounded-xl border bg-card p-3 shadow-[var(--shadow-card)] transition-colors", note.pinned ? "border-warning/40 bg-[color-mix(in_oklab,var(--warning)_6%,var(--card))]" : "border-border hover:border-border-strong")}
    >
      <textarea
        ref={ref}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Escape") (e.currentTarget as HTMLTextAreaElement).blur();
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") (e.currentTarget as HTMLTextAreaElement).blur();
        }}
        aria-label="Note"
        className="block w-full resize-none bg-transparent text-[13px] leading-relaxed outline-none"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{note.pinned ? "Pinned · " : ""}{formatRelativeTime(note.updatedAt)}</span>
        <span className="flex items-center gap-0.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
          <button type="button" onClick={onPin} aria-label={note.pinned ? "Unpin" : "Pin to top"} title={note.pinned ? "Unpin" : "Pin to top"} className={cn("rounded-md p-1.5 transition-[background-color,color,scale] hover:bg-muted active:scale-90", note.pinned ? "text-warning" : "text-muted-foreground hover:text-foreground")}>
            {note.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={onDelete} aria-label="Delete note" title="Delete" className="rounded-md p-1.5 text-muted-foreground transition-[background-color,color,scale] hover:bg-danger-bg hover:text-danger active:scale-90">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
    </motion.li>
  );
}

/**
 * Quick notes: a scratchpad in the corner of every page. Owners and admins
 * only (the layout passes null for everyone else, and the actions check
 * again). The panel lives in the shell, which survives navigation, so it
 * stays open — and keeps its scroll and draft — while you move between
 * pages and businesses. Edits save on blur; new notes on ⌘↵.
 */
export function QuickNotes({ initial }: { initial: QuickNote[] }) {
  const [open, setOpen] = React.useState(false);
  const [notes, setNotes] = React.useState<QuickNote[]>(() => sortNotes(initial));
  const [pending, startTransition] = React.useTransition();

  // A fresh server render (navigation, refresh) carries the latest list; adopt it.
  const [seen, setSeen] = React.useState(initial);
  if (seen !== initial) {
    setSeen(initial);
    setNotes(sortNotes(initial));
  }

  React.useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOpen(window.localStorage.getItem(OPEN_KEY) === "1");
    } catch {
      /* storage blocked */
    }
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener(TOGGLE_EVENT, onToggle);
    return () => window.removeEventListener(TOGGLE_EVENT, onToggle);
  }, []);

  function setOpenRemembered(next: boolean) {
    setOpen(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? "1" : "0");
    } catch {
      /* storage blocked */
    }
  }

  function add(body: string) {
    startTransition(async () => {
      const result = await addQuickNote(body);
      if (!result.ok || !result.note) return void toast.error(result.ok ? "The note wasn't saved." : result.error);
      const note = result.note;
      setNotes((list) => sortNotes([note, ...list]));
    });
  }

  function change(id: string, body: string) {
    const now = new Date().toISOString();
    setNotes((list) => sortNotes(list.map((n) => (n.id === id ? { ...n, body, updatedAt: now } : n))));
    startTransition(async () => {
      const result = await editQuickNote(id, body);
      if (!result.ok) toast.error(result.error);
    });
  }

  function pin(note: QuickNote) {
    setNotes((list) => sortNotes(list.map((n) => (n.id === note.id ? { ...n, pinned: !n.pinned } : n))));
    startTransition(async () => {
      const result = await pinQuickNote(note.id, !note.pinned);
      if (!result.ok) toast.error(result.error);
    });
  }

  function remove(id: string) {
    const previous = notes;
    setNotes((list) => list.filter((n) => n.id !== id));
    startTransition(async () => {
      const result = await removeQuickNote(id);
      if (!result.ok) {
        setNotes(previous);
        toast.error(result.error);
      }
    });
  }

  return (
    <>
      {/* The dock button: always in the corner, badge = note count. */}
      <motion.button
        type="button"
        onClick={() => setOpenRemembered(!open)}
        aria-label={open ? "Close quick notes" : "Open quick notes"}
        aria-expanded={open}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.94 }}
        className={cn(
          "fixed bottom-5 right-5 z-40 flex h-12 items-center gap-2 rounded-full border px-4 text-[13px] print:hidden font-medium shadow-[var(--shadow-elevated)] backdrop-blur-xl transition-colors max-md:bottom-4 max-md:right-4",
          open ? "border-accent/50 bg-accent text-accent-foreground" : "glass-surface border-border text-foreground hover:border-accent/40"
        )}
      >
        <StickyNote className="h-4 w-4" strokeWidth={1.75} />
        <span className="max-sm:hidden">Notes</span>
        {notes.length > 0 && (
          <span className={cn("rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums leading-none", open ? "bg-white/20" : "bg-accent/12 text-accent")}>{notes.length}</span>
        )}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.aside
            key="notes-panel"
            role="complementary"
            aria-label="Quick notes"
            initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: 16, scale: 0.97, filter: "blur(4px)", transition: { duration: 0.18, ease: EASE } }}
            transition={{ type: "spring", stiffness: 380, damping: 32, mass: 0.9 }}
            className="glass-panel fixed bottom-20 right-5 z-40 flex max-h-[min(70vh,640px)] w-[min(380px,calc(100vw-2rem))] origin-bottom-right flex-col rounded-2xl shadow-[var(--shadow-elevated)] max-md:bottom-[4.5rem] max-md:right-4"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[linear-gradient(135deg,color-mix(in_oklab,var(--accent)_16%,transparent),color-mix(in_oklab,var(--accent-2)_10%,transparent))] text-accent">
                  <StickyNote className="h-3.5 w-3.5" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[13px] font-semibold tracking-tight">Quick notes</p>
                  <p className="text-[11px] text-muted-foreground">Yours, on every page and every workspace</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpenRemembered(false)} aria-label="Close" className="rounded-full p-1.5 text-muted-foreground transition-[background-color,color,scale] hover:bg-muted hover:text-foreground active:scale-90">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="px-3 pt-3">
              <Composer onAdd={add} pending={pending} />
            </div>

            <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
              <AnimatePresence initial={false}>
                {notes.map((n) => (
                  <NoteCard key={n.id} note={n} onChange={(body) => change(n.id, body)} onPin={() => pin(n)} onDelete={() => remove(n.id)} />
                ))}
              </AnimatePresence>
              {notes.length === 0 && (
                <motion.li initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  Nothing yet. Reminders, numbers to check, a name to call back — anything you&rsquo;d otherwise put on a sticky note.
                </motion.li>
              )}
            </ul>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
