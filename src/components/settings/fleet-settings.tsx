"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { renameFleet } from "@/lib/actions/host";

export interface FleetMemberView {
  email: string;
  role: string;
}

/**
 * Names the fleet, and shows who is on it.
 *
 * Every fleet is auto-named on its owner's first sign-in, from their Google
 * profile — "Jonathan's Fleet". That is a good default and a bad permanent
 * answer, so this is where it gets corrected. Owners only; the name appears
 * in every member's sidebar, so it is fleet configuration rather than a
 * personal preference.
 */
export function FleetSettings({
  initialName,
  members,
  canRename,
  isOwner,
}: {
  initialName: string;
  members: FleetMemberView[];
  canRename: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName);
  const [isPending, startTransition] = React.useTransition();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const trimmed = name.trim();
  const isDirty = trimmed !== initialName.trim();

  function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    if (!isDirty || isPending || trimmed.length === 0) return;

    setError(null);
    startTransition(async () => {
      const res = await renameFleet(trimmed);
      if (!res.ok) {
        setError(res.error ?? "Could not rename the fleet.");
        return;
      }
      setSaved(true);
      // The name is rendered by the server in the sidebar and the fleet
      // switcher, so re-pull rather than patching local state.
      router.refresh();
      setTimeout(() => setSaved(false), 2000);
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
        Fleet
      </p>

      <label htmlFor="fleet-name" className="mt-2 block text-[13.5px] font-medium">
        Fleet name
      </label>
      <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">
        Shown in the sidebar and on the daily digest. Everyone on this fleet sees it.
      </p>

      {/* A real form rather than an onKeyDown="Enter" handler on the input.
          The handler version silently did nothing when the key event didn't
          reach React — pressing Enter looked like a successful save because
          the field kept showing the typed name while the database still held
          the old one. Native submit also gets the mobile keyboard's "Go" key
          and password-manager autofill right for free. */}
      <form onSubmit={handleSave} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          id="fleet-name"
          name="fleetName"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
            setError(null);
          }}
          disabled={!canRename || isPending}
          maxLength={60}
          className="min-w-0 flex-1 rounded-lg border border-border bg-background/50 px-3 py-2 text-[13.5px] outline-none transition-colors focus:border-accent/60 disabled:opacity-60"
        />
        {canRename && (
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={isPending || !isDirty || trimmed.length === 0}
          >
            {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isPending ? "Saving…" : "Save"}
          </Button>
        )}
      </form>

      {error && <p className="mt-2 text-[12.5px] text-danger">{error}</p>}
      {saved && !error && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-success">
          <Check className="h-3.5 w-3.5" />
          Fleet renamed.
        </p>
      )}
      {!canRename && (
        <p className="mt-2 text-[12.5px] text-muted-foreground">
          {isOwner
            ? "HostOS can't reach its database right now, so this can't be changed."
            : "Only a fleet owner can rename it."}
        </p>
      )}

      {members.length > 0 && (
        <div className="mt-5 border-t border-border pt-4">
          <div className="flex items-center gap-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Users className="h-3.5 w-3.5" strokeWidth={1.75} />
            {members.length === 1 ? "1 person" : `${members.length} people`}
          </div>
          <ul className="mt-2 space-y-1.5">
            {members.map((member) => (
              <li key={member.email} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate text-[13px]">{member.email}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted-foreground">
                  {member.role}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
