"use server";

import { revalidatePath } from "next/cache";
import { isSupabaseConfigured, runMutation } from "@/lib/supabase/server";
import { getHost } from "@/lib/host/queries";
import {
  canManageIntegrations,
  canManageSettings,
  getCurrentHostId,
  hasNoFleetAccess,
} from "@/lib/host/context";

export interface RegenerateKeyResult {
  ok: boolean;
  apiKey?: string;
  error?: string;
}

/**
 * Issues a new Companion pairing key for the CURRENT fleet, invalidating any
 * previous one. The key is returned once for display/copy — callers must not
 * assume it can be re-read later (the DB only ever holds the current key,
 * matching the "keep the DB the source of truth, show a secret exactly once"
 * pattern).
 *
 * THE FLEET SCOPING HERE IS SECURITY, NOT TIDINESS. This called `getHost()`
 * with no argument, which resolves DEFAULT_HOST_ID — so once the app was
 * public, any signed-in stranger could press "Regenerate" and rotate the
 * seeded fleet's key: the real operator's extension would start getting 401s
 * and stop syncing, and the stranger would hold a key that ingests into
 * someone else's fleet. It has to be the fleet this request resolved to.
 */
export async function regenerateCompanionApiKey(): Promise<RegenerateKeyResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      error: "Supabase isn't configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.",
    };
  }

  if (await hasNoFleetAccess()) {
    return {
      ok: false,
      error: "Your fleet isn't set up yet. Reload the page — if this keeps happening, HostOS can't reach its database.",
    };
  }

  // A pairing key is a credential that writes to the workspace: owners and
  // admins only (workspace.integrations).
  if (!(await canManageIntegrations())) {
    return { ok: false, error: "Only an owner or admin can issue a pairing key." };
  }

  const host = await getHost(await getCurrentHostId());
  if (!host) {
    return {
      ok: false,
      error: "No host record found. Run supabase/migrations/0003_trips.sql against your Supabase project.",
    };
  }

  const apiKey = `hostos_live_${crypto.randomUUID().replace(/-/g, "")}`;

  // The key is only ever shown once, so a failed write must not report
  // success — the host would copy a key the database never stored.
  const result = await runMutation("hosts.rotate_api_key", (client) =>
    client.from("hosts").update({ companion_api_key: apiKey }).eq("id", host.id)
  );

  if (!result.ok) return { ok: false, error: result.error };

  revalidatePath("/app/settings");
  revalidatePath("/app/connectors");
  // Pairing is a step on the Overview setup checklist, which reads the same
  // key — without this it keeps saying "not paired" until the next navigation.
  revalidatePath("/app");
  return { ok: true, apiKey };
}

export interface RenameFleetResult {
  ok: boolean;
  name?: string;
  error?: string;
}

/**
 * Renames the current fleet.
 *
 * Fleets are auto-named from the owner's Google profile on first sign-in
 * ("Jonathan's Fleet"), which is a reasonable default and a poor final answer
 * — real fleets have real names. Owners only: a rename shows up in every
 * member's sidebar, so it isn't a per-person preference.
 *
 * The slug is deliberately NOT recomputed. It is uniquely indexed and stable
 * identifiers that follow a display name are how you end up with two fleets
 * fighting over one slug months later.
 */
export async function renameFleet(rawName: string): Promise<RenameFleetResult> {
  const name = rawName.trim().replace(/\s+/g, " ");

  if (!name) return { ok: false, error: "Give your fleet a name." };
  if (name.length > 60) return { ok: false, error: "Fleet names are limited to 60 characters." };

  if (await hasNoFleetAccess()) {
    return { ok: false, error: "Your fleet isn't set up yet. Reload the page and try again." };
  }

  // Renaming is workspace configuration: owners, admins and managers.
  if (!(await canManageSettings())) {
    return { ok: false, error: "Only an owner, admin or manager can rename the workspace." };
  }

  // Resolved separately rather than read off `fleet`, which is null in local
  // single-tenant mode — there the fleet being renamed is the default one.
  const hostId = await getCurrentHostId();

  const result = await runMutation("hosts.rename", (client) =>
    client.from("hosts").update({ name }).eq("id", hostId)
  );

  if (!result.ok) return { ok: false, error: result.error };

  // The name is in the sidebar on every page, so the whole tree is stale.
  revalidatePath("/app", "layout");
  return { ok: true, name };
}
