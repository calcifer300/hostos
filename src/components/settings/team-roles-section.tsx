"use client";

import * as React from "react";
import { Users, X } from "lucide-react";
import { setUserRoles, removeUserRoles } from "@/lib/actions/roles";
import { ROLE_OPTIONS } from "@/lib/roles/constants";
import { cn } from "@/lib/utils";

interface Assignment {
  email: string;
  roles: string[];
}

/**
 * Manual role assignment — the future team-management surface PROJECT_STATE
 * calls for. No auto-assignment anywhere: an email only ever gets a role
 * because someone typed it in here and saved.
 */
export function TeamRolesSection({ initialAssignments }: { initialAssignments: Assignment[] }) {
  const [assignments, setAssignments] = React.useState(initialAssignments);
  const [email, setEmail] = React.useState("");
  const [selectedRoles, setSelectedRoles] = React.useState<string[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  function toggleRole(role: string) {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleAdd() {
    setError(null);
    if (!email.trim()) {
      setError("Enter an email address.");
      return;
    }
    setSaving(true);
    const result = await setUserRoles(email.trim(), selectedRoles);
    setSaving(false);
    if (!result.ok) {
      setError(result.error || "Couldn't save that assignment.");
      return;
    }
    const normalizedEmail = email.trim().toLowerCase();
    setAssignments((prev) => {
      const withoutExisting = prev.filter((a) => a.email !== normalizedEmail);
      return [...withoutExisting, { email: normalizedEmail, roles: selectedRoles }].sort((a, b) =>
        a.email.localeCompare(b.email)
      );
    });
    setEmail("");
    setSelectedRoles([]);
  }

  async function handleRemove(targetEmail: string) {
    setAssignments((prev) => prev.filter((a) => a.email !== targetEmail));
    await removeUserRoles(targetEmail);
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
          <Users className="h-[15px] w-[15px] text-muted-foreground" strokeWidth={1.75} />
        </div>
        <div>
          <p className="text-[13.5px] font-medium">Team & roles</p>
          <p className="text-[12px] text-muted-foreground">
            Assign who&rsquo;s who — nobody gets a role unless it&rsquo;s granted here.
          </p>
        </div>
      </div>

      {assignments.length > 0 && (
        <div className="mt-4 space-y-2">
          {assignments.map((a) => (
            <div key={a.email} className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium">{a.email}</p>
                <p className="truncate text-[11.5px] text-accent">{a.roles.join(" & ") || "No role"}</p>
              </div>
              <button
                onClick={() => handleRemove(a.email)}
                aria-label={`Remove ${a.email}`}
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-danger"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 space-y-3 border-t border-border pt-4">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="teammate@email.com"
          className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] outline-none focus:border-accent/50"
        />
        <div className="flex flex-wrap gap-1.5">
          {ROLE_OPTIONS.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => toggleRole(role)}
              className={cn(
                "rounded-full border px-3 py-1 text-[12px] font-medium transition-colors",
                selectedRoles.includes(role)
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {role}
            </button>
          ))}
        </div>
        {error && <p className="text-[12px] text-danger">{error}</p>}
        <button
          onClick={handleAdd}
          disabled={saving}
          className="rounded-lg bg-accent px-3.5 py-1.5 text-[12.5px] font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save assignment"}
        </button>
      </div>
    </div>
  );
}
