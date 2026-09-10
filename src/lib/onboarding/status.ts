import "server-only";
import { runQueryOr } from "@/lib/supabase/server";
import { getHost } from "@/lib/host/queries";
import { hasSavedKnowledgeBase } from "@/lib/knowledge/queries";
import { hasNoFleetAccess } from "@/lib/host/context";

/**
 * How far along a new fleet is in getting HostOS actually running.
 *
 * The app had no onboarding at all: a new account signed in, every card
 * rendered its empty state, and nothing anywhere said that the Companion
 * extension is the thing that fills them. An empty dashboard is
 * indistinguishable from a broken one, and the fix is to say which it is.
 *
 * Every step is derived from real state, never from a "dismissed onboarding"
 * flag. A checklist that can be ticked without the underlying thing being
 * true is worse than none — it tells a host they are set up while their
 * extension sits unpaired.
 */

export type SetupStepId = "fleet" | "pair" | "sync" | "knowledge";

export interface SetupStep {
  id: SetupStepId;
  title: string;
  description: string;
  done: boolean;
  /** Where the user goes to do this. */
  href: string;
  cta: string;
  /** Optional steps render below the required ones and don't block completion. */
  optional: boolean;
}

export interface SetupStatus {
  steps: SetupStep[];
  /** True once every REQUIRED step is done — the checklist stops rendering. */
  complete: boolean;
  /** True when the fleet couldn't be resolved at all; a backend problem, not a setup one. */
  unavailable: boolean;
}

export async function getSetupStatus(hostId: string): Promise<SetupStatus> {
  if (await hasNoFleetAccess()) {
    return { steps: [], complete: false, unavailable: true };
  }

  const [host, syncedTrips, syncedVehicles, knowledgeSaved] = await Promise.all([
    getHost(hostId),
    countRows("trips", hostId),
    countRows("vehicles", hostId),
    hasSavedKnowledgeBase(hostId),
  ]);

  const paired = Boolean(host?.companionApiKey);
  // Either table having rows means a sync landed. Vehicles arrive from the
  // fleet-calendar loop and trips from the trips loop, and which one lands
  // first depends on where the host happened to be browsing Turo.
  const synced = syncedTrips > 0 || syncedVehicles > 0;

  const steps: SetupStep[] = [
    {
      id: "fleet",
      title: "Name your fleet",
      // Provisioning always names it, so this step exists to introduce the
      // idea rather than to gate anything — hence done: true from the start.
      description: host?.name
        ? `Your fleet is called “${host.name}”. Rename it any time.`
        : "Your fleet is being set up.",
      done: Boolean(host?.name),
      href: "/settings",
      cta: "Rename",
      optional: false,
    },
    {
      id: "pair",
      title: "Install and pair the Companion extension",
      description:
        "HostOS reads your fleet from Turo through a Chrome extension. Download it, then paste your pairing key.",
      done: paired,
      href: "/connectors",
      cta: paired ? "Manage" : "Get the extension",
      optional: false,
    },
    {
      id: "sync",
      title: "Run your first sync",
      description: paired
        ? "Open Turo in Chrome and leave the tab open. The extension syncs on its own within a minute."
        : "Pair the extension first — syncing starts by itself once it's connected.",
      done: synced,
      href: "/connectors",
      cta: "How it works",
      optional: false,
    },
    {
      id: "knowledge",
      title: "Add your house rules",
      description:
        "Your check-in process, policies and tone. Butler and the AI briefing ground every draft reply in this.",
      done: knowledgeSaved,
      href: "/knowledge",
      cta: "Write them",
      optional: true,
    },
  ];

  return {
    steps,
    complete: steps.every((s) => s.optional || s.done),
    unavailable: false,
  };
}

/**
 * Row count for one fleet, without pulling the rows.
 *
 * head: true sends no body — this only ever needs the number, and a fleet
 * with two hundred trips shouldn't transfer them to answer "any?".
 */
async function countRows(table: "trips" | "vehicles", hostId: string): Promise<number> {
  const { data } = await runQueryOr<number>(`${table}.count_for_setup`, 0, async (client) => {
    const res = await client
      .from(table)
      .select("*", { count: "exact", head: true })
      .eq("host_id", hostId);
    return { data: res.count ?? 0, error: res.error, status: res.status };
  });

  return data;
}
