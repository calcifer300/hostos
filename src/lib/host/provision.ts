import "server-only";
import { runQuery } from "@/lib/supabase/server";

/**
 * Creates a fleet the first time someone signs in.
 *
 * Migration 0009 built the membership table but nothing ever wrote to it, so
 * the only way onto a fleet was a hand-inserted row. A new Google account
 * resolved to NO_FLEET_HOST_ID and got an empty app with no way forward.
 * This is what closes that gap.
 *
 * NOTHING HERE MAY THROW. It is reached from getFleetsForUser(), which every
 * page render calls; the whole app is built so a database problem degrades
 * one surface rather than failing a render. A failure to provision returns
 * null and the caller falls back to "no fleet", which is the same state the
 * user was already in.
 */

export interface ProvisionedFleet {
  hostId: string;
  name: string;
  slug: string | null;
  timezone: string;
  role: string;
}

const DEFAULT_TIMEZONE = "America/Denver";

const MIGRATION_HINT =
  "Apply supabase/migrations/0012_self_serve_fleets.sql — provisioning needs the hosts.created_by_email column.";

/**
 * True when the failure is "that column doesn't exist" rather than anything
 * retryable.
 *
 * Matched against the failure's message because runQuery hands back a
 * summarized SupabaseFailure, not the raw PostgREST error. Worth detecting
 * precisely: without it an un-migrated deployment retries the insert on every
 * single request from every signed-in user, forever, and logs nothing that
 * names the missing migration.
 */
function isMissingColumn(reason: string): boolean {
  return /could not find the .* column|column .* does not exist/i.test(reason);
}

/**
 * A fleet name from whatever Google gave us.
 *
 * Uses the first name only: "Jonathan Briones" becomes "Jonathan's Fleet",
 * not "Jonathan Briones's Fleet". Falls back to the email's local part, then
 * to a bare "Fleet", so this always returns something renderable — a fleet
 * with a blank name is a state the sidebar and switcher would both have to
 * defend against.
 */
export function fleetNameFor(displayName: string | null, email: string): string {
  const fromProfile = (displayName ?? "").trim().split(/\s+/)[0] ?? "";
  const fromEmail = email.split("@")[0]?.replace(/[._-]+/g, " ").trim().split(/\s+/)[0] ?? "";

  const raw = fromProfile || fromEmail;
  if (!raw) return "Fleet";

  const person = raw.charAt(0).toUpperCase() + raw.slice(1);
  // "Chris' Fleet" rather than "Chris's Fleet".
  const possessive = /s$/i.test(person) ? `${person}'` : `${person}'s`;
  return `${possessive} Fleet`;
}

/**
 * A url-safe slug with a random suffix.
 *
 * The suffix is not decoration: `hosts.slug` is uniquely indexed (0009) and
 * two people named John would otherwise collide on their very first sign-in.
 * Four hex characters is plenty when the base is already a name.
 */
function slugFor(name: string): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "fleet";

  const suffix = Math.floor(Math.random() * 0x10000)
    .toString(16)
    .padStart(4, "0");

  return `${base}-${suffix}`;
}

interface HostRow {
  id: string;
  name: string | null;
  slug: string | null;
  timezone: string | null;
}

const HOST_COLUMNS = "id, name, slug, timezone";

function toFleet(row: HostRow, role: string): ProvisionedFleet {
  return {
    hostId: row.id,
    name: row.name ?? "Fleet",
    slug: row.slug,
    timezone: row.timezone ?? DEFAULT_TIMEZONE,
    role,
  };
}

/**
 * Provisions, or recovers, the fleet belonging to `email`.
 *
 * THE RACE THIS DEFENDS AGAINST IS REAL AND ROUTINE. Opening the app fires
 * the document request and several RSC prefetches at once, each a separate
 * server invocation with its own React cache. Every one of them sees no
 * membership and tries to create a fleet. Without the unique index from
 * migration 0012 the user ends up owning several fleets, and their synced
 * data scatters across them depending on which pairing key they happened to
 * copy.
 *
 * So the insert is allowed to lose: a unique violation on created_by_email
 * means another request already created this person's fleet, and the loser
 * re-reads the winner's row instead of erroring.
 */
export async function provisionFleetForUser(
  email: string,
  displayName: string | null
): Promise<ProvisionedFleet | null> {
  const existing = await findFleetOwnedBy(email);
  if (existing) return attachMembership(existing, email);

  const name = fleetNameFor(displayName, email);

  // Two attempts, because the two unique indexes fail for different reasons
  // and only one of them is worth retrying. A slug collision is bad luck and
  // a fresh suffix fixes it; a created_by_email collision means we lost the
  // race and should go read the winner, which the loop does on the next pass.
  for (let attempt = 0; attempt < 2; attempt++) {
    const outcome = await runQuery<HostRow | null>("hosts.provision", (client) =>
      client
        .from("hosts")
        .insert({
          name,
          slug: slugFor(name),
          created_by_email: email,
          timezone: DEFAULT_TIMEZONE,
        })
        .select(HOST_COLUMNS)
        .maybeSingle<HostRow>()
    );

    if (outcome.ok && outcome.data) return attachMembership(outcome.data, email);

    if (!outcome.ok && outcome.failure.kind === "missing_table") {
      console.error(
        "[provision] hosts table is missing. Run supabase/migrations/0003_trips.sql."
      );
      return null;
    }

    // Not retryable, and the single most likely reason this ever fails on a
    // real deployment: the code shipped before the migration did.
    if (!outcome.ok && isMissingColumn(outcome.failure.reason)) {
      console.error(`[provision] ${MIGRATION_HINT}`);
      return null;
    }

    // Not a uniqueness problem, so retrying the same insert won't help.
    if (!outcome.ok && outcome.failure.kind !== "query_error") {
      console.error(`[provision] Could not create a fleet for a new user: ${outcome.failure.reason}`);
      return null;
    }

    // A query_error here is almost always one of the two unique violations.
    // Re-read first: if someone else won the race the row now exists, and
    // that is the common case by a wide margin.
    const winner = await findFleetOwnedBy(email);
    if (winner) return attachMembership(winner, email);
  }

  console.error(`[provision] Gave up creating a fleet after 2 attempts. ${MIGRATION_HINT}`);
  return null;
}

/** The fleet this address already created, if any. */
async function findFleetOwnedBy(email: string): Promise<HostRow | null> {
  const outcome = await runQuery<HostRow | null>("hosts.by_creator", (client) =>
    client.from("hosts").select(HOST_COLUMNS).eq("created_by_email", email).maybeSingle<HostRow>()
  );

  return outcome.ok ? outcome.data : null;
}

/**
 * Makes the creator an owner of their fleet.
 *
 * Separate from the insert, and idempotent, because the two can come apart:
 * the host row commits and the membership write fails, leaving a fleet its
 * own creator cannot see. Re-running provisioning repairs that — the host
 * lookup finds the orphan and this re-attempts the membership.
 */
async function attachMembership(row: HostRow, email: string): Promise<ProvisionedFleet | null> {
  const outcome = await runQuery("host_members.attach_owner", (client) =>
    client
      .from("host_members")
      .upsert({ host_id: row.id, user_email: email, role: "owner" }, { onConflict: "host_id,user_email" })
      .select("host_id")
  );

  // The upsert names its conflict target, so a row that already exists is a
  // success, not an error. Anything reaching here is a genuine failure.
  if (!outcome.ok) {
    // The fleet exists but this person is not on it yet. Reporting no fleet
    // is correct: every query is membership-scoped, so claiming access we
    // did not actually record would render an empty app that looks broken
    // rather than one that says it is still setting up.
    console.error(`[provision] Fleet ${row.id} created but membership failed: ${outcome.failure.reason}`);
    return null;
  }

  return toFleet(row, "owner");
}
