import "server-only";
import { getCommandSnapshot, getHeartbeat } from "@/lib/command/queries";
import type { CommandSnapshot } from "@/lib/command/snapshot";
import { getCurrentHostId, NO_FLEET_HOST_ID } from "@/lib/host/context";

/** What the owner's live page draws: the snapshot, when it arrived, and the scanner's own heartbeat. */
export interface PulseData {
  snapshot: CommandSnapshot | null;
  receivedAt: number | null;
  seenAt: number | null;
  lastScanAt: number | null;
  serverNow: number;
  signedIn: boolean;
}

export async function getPulseData(): Promise<PulseData> {
  const hostId = await getCurrentHostId();
  const serverNow = Date.now();
  if (hostId === NO_FLEET_HOST_ID) return { snapshot: null, receivedAt: null, seenAt: null, lastScanAt: null, serverNow, signedIn: false };
  const [stored, beat] = await Promise.all([getCommandSnapshot(hostId), getHeartbeat(hostId)]);
  return {
    snapshot: stored ? stored.snapshot : null,
    receivedAt: stored ? Date.parse(stored.receivedAt) : null,
    seenAt: beat.seenAt,
    lastScanAt: beat.lastScanAt,
    serverNow,
    signedIn: true,
  };
}

/** A short fingerprint of what the page shows, so the poll can answer "nothing new" with a 304. */
export function pulseEtag(data: PulseData): string {
  return '"' + [data.snapshot ? data.snapshot.builtAt : 0, data.receivedAt ?? 0, data.seenAt ?? 0, data.lastScanAt ?? 0].join("-") + '"';
}
