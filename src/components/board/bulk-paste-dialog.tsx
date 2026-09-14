"use client";


import { can } from "@/lib/roles/permissions";
import * as React from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseBulkPaste, type TripDraft } from "@/lib/board/bulk-paste";
import { US_ZONES, wallDate, wallTime, zoneAbbr } from "@/lib/timezones";
import { importTripDrafts } from "@/lib/actions/board";
import type { BoardFleet } from "@/lib/board/queries";

/**
 * Paste Turo's trip list, review what was read, then import.
 *
 * The review step is the whole point and is Karl's design. Turo's list carries
 * exactly ONE timestamp per trip and none at all for "In progress", so any
 * importer is working with half the data by construction — and the honest
 * thing is to show what was read, flag what could not be, and let a person
 * correct it before it becomes a row someone else relies on.
 *
 * Parsing runs entirely in the browser. Nothing is sent anywhere until the
 * Import button is pressed, so a mis-paste costs nothing.
 */
export function BulkPasteDialog({
  fleets,
  onClose,
  onImported,
}: {
  fleets: BoardFleet[];
  onClose: () => void;
  onImported: () => void;
}) {
  const writable = fleets.filter((f) => can(f.role, "workspace.write"));

  const [raw, setRaw] = React.useState("");
  const [drafts, setDrafts] = React.useState<TripDraft[] | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [hostId, setHostId] = React.useState(writable[0]?.hostId ?? "");
  const [dateOverride, setDateOverride] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<string | null>(null);

  const dialogRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function runParse() {
    setError(null);
    setDone(null);

    const parsed = parseBulkPaste(raw, dateOverride || undefined);
    if (parsed.length === 0) {
      setDrafts([]);
      setError(
        "Nothing recognisable in that. Copy the trip list from Turo including the " +
          "“Starting at …” / “Ending at …” lines — those are what mark each trip."
      );
      return;
    }

    setDrafts(parsed);
    // Everything with a reservation number starts selected; anything without
    // one cannot be keyed, so it starts off and says why.
    setSelected(new Set(parsed.map((d, i) => (d.reservationId ? i : -1)).filter((i) => i >= 0)));
  }

  async function runImport() {
    if (!drafts || !hostId) return;

    const chosen = drafts.filter((_, i) => selected.has(i));
    if (chosen.length === 0) {
      setError("Nothing selected.");
      return;
    }

    setBusy(true);
    setError(null);

    const res = await importTripDrafts(hostId, chosen);

    setBusy(false);

    if (!res.ok) {
      setError(res.error ?? "Import failed.");
      return;
    }

    const parts: string[] = [];
    if (res.imported) parts.push(`${res.imported} added`);
    if (res.updated) parts.push(`${res.updated} updated`);
    if (res.skipped) parts.push(`${res.skipped} skipped`);
    setDone(parts.join(" · ") || "Done");

    // Held briefly so the counts are readable rather than flashing past.
    setTimeout(onImported, 1200);
  }

  function toggle(index: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/70 p-4 backdrop-blur-sm sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-title"
      onMouseDown={(e) => {
        if (!dialogRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-[var(--shadow-card)]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border p-5">
          <div>
            <h2 id="paste-title" className="text-[16px] font-semibold tracking-tight">
              Paste from Turo
            </h2>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
              Select your trip list on Turo, copy it, and paste it here. Nothing is saved until you import.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          {writable.length === 0 ? (
            <p className="text-[13px] text-muted-foreground">
              You have read-only access to every fleet you&rsquo;re on, so there&rsquo;s nowhere to import to.
            </p>
          ) : (
            <>
              <textarea
                value={raw}
                onChange={(e) => {
                  setRaw(e.target.value);
                  setDrafts(null);
                  setError(null);
                }}
                rows={drafts ? 4 : 10}
                placeholder={"Starting at 9:00 AM\n(Ethan's vehicle)\n\nNissan Kicks 2026\n\n112 W Boden St, Milwaukee, WI 53207\n\nMarcus #60229871\n…"}
                className="w-full rounded-lg border border-border bg-background/50 p-3 font-mono text-[12.5px] leading-relaxed outline-none transition-colors focus:border-accent/60"
              />

              <div className="flex flex-wrap items-end gap-3">
                {writable.length > 1 && (
                  <label className="text-[12px] text-muted-foreground">
                    <span className="mb-1 block">Import into</span>
                    <select
                      value={hostId}
                      onChange={(e) => setHostId(e.target.value)}
                      className="rounded-lg border border-border bg-background/50 px-2.5 py-2 text-[12.5px] text-foreground outline-none focus:border-accent/60"
                    >
                      {writable.map((f) => (
                        <option key={f.hostId} value={f.hostId}>{f.name}</option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="text-[12px] text-muted-foreground">
                  <span className="mb-1 block">
                    Date for these trips{" "}
                    <span className="opacity-70">— Turo&rsquo;s list omits it</span>
                  </span>
                  <input
                    type="date"
                    value={dateOverride}
                    onChange={(e) => setDateOverride(e.target.value)}
                    className="rounded-lg border border-border bg-background/50 px-2.5 py-2 text-[12.5px] text-foreground outline-none focus:border-accent/60"
                  />
                </label>

                <button
                  type="button"
                  onClick={runParse}
                  disabled={!raw.trim()}
                  className="ml-auto rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-muted disabled:opacity-40"
                >
                  {drafts ? "Re-read" : "Read it"}
                </button>
              </div>

              {error && (
                <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] leading-relaxed text-danger">
                  {error}
                </p>
              )}

              {done && (
                <p className="rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[12.5px] text-success">
                  {done}
                </p>
              )}

              {drafts && drafts.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-[12.5px] text-muted-foreground">
                      Read {drafts.length} trip{drafts.length === 1 ? "" : "s"} · {selected.size} selected
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setSelected((prev) =>
                          prev.size === drafts.length
                            ? new Set()
                            : new Set(drafts.map((_, i) => i))
                        )
                      }
                      className="text-[12px] font-medium text-accent hover:underline"
                    >
                      {selected.size === drafts.length ? "Select none" : "Select all"}
                    </button>
                  </div>

                  <ul className="max-h-[340px] divide-y divide-border overflow-y-auto rounded-lg border border-border">
                    {drafts.map((draft, i) => (
                      <DraftRow
                        key={i}
                        draft={draft}
                        checked={selected.has(i)}
                        onToggle={() => toggle(i)}
                      />
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </div>

        {writable.length > 0 && drafts && drafts.length > 0 && (
          <div className="flex items-center justify-end gap-2 border-t border-border p-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={busy || selected.size === 0}
              className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Import {selected.size} trip{selected.size === 1 ? "" : "s"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function DraftRow({
  draft,
  checked,
  onToggle,
}: {
  draft: TripDraft;
  checked: boolean;
  onToggle: () => void;
}) {
  const anchor = draft.startsAt ?? draft.endsAt;
  const keyable = draft.reservationId.length > 0;

  return (
    <li className={cn("flex items-start gap-3 p-3", !keyable && "opacity-70")}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        disabled={!keyable}
        aria-label={`Import ${draft.guest || "this trip"}`}
        className="mt-1 h-3.5 w-3.5 shrink-0 accent-[var(--accent)]"
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[13px] font-medium">{draft.guest || "Unnamed guest"}</span>
          <span className="text-[12.5px] text-muted-foreground">{draft.vehicle}</span>
          {draft.plate && (
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground">
              {draft.plate}
            </span>
          )}
          {draft.tags.map((tag) => (
            <span key={tag} className="rounded bg-muted px-1.5 py-0.5 text-[10.5px] text-muted-foreground">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[11.5px] text-muted-foreground">
          <span>{draft.hostLabel || "Unknown host"}</span>
          <span>
            {anchor
              ? `${draft.startsAt ? "Starts" : "Ends"} ${wallDate(anchor, draft.timezone)} ${wallTime(anchor, draft.timezone)} ${zoneAbbr(draft.timezone)}`
              : "No time in Turo's list"}
          </span>
          {keyable ? (
            <span className="font-mono">#{draft.reservationId}</span>
          ) : (
            <span className="text-warning">No reservation # — can&rsquo;t import this one</span>
          )}
        </div>

        {draft.warnings.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {draft.warnings.map((w) => (
              <li key={w} className="flex items-start gap-1 text-[11.5px] leading-snug text-warning">
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>

      <select
        value={draft.timezone}
        onChange={() => {
          /* Set on the row after import — see the board's zone control. */
        }}
        disabled
        aria-label="Detected timezone"
        title="Detected from the address. Correct it on the board after importing."
        className="shrink-0 rounded border border-border bg-background/50 px-1.5 py-1 text-[11px] text-muted-foreground"
      >
        {US_ZONES.map((z) => (
          <option key={z.id} value={z.id}>{z.abbr}</option>
        ))}
      </select>
    </li>
  );
}
