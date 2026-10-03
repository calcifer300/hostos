import "server-only";
import { getRiskQueues, type QueueTrip } from "@/lib/risk/queries";

/**
 * The daily operations digest, ported from the CC build's 8 AM Apps Script
 * email so it no longer depends on a Google Apps Script relay.
 *
 * The important inherited rule: every figure that rests on an input Turo never
 * gave us is labelled a FLOOR in the email body, not just on the card. The host
 * reads the email, not the card — a number presented as exact that turns out to
 * be a floor is how trust in the whole report gets lost.
 */

export interface DigestSection {
  title: string;
  lines: string[];
}

export interface Digest {
  subject: string;
  sections: DigestSection[];
  /** Nothing worth sending — used to skip the send entirely. */
  empty: boolean;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

function tripLine(t: QueueTrip, timezone: string): string {
  const when = t.startsAt
    ? new Date(t.startsAt).toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone,
      })
    : "unscheduled";
  return `${t.guestName} · ${t.vehicle} · ${when}`;
}

export async function composeDigest(hostId: string, timezone = "America/Denver"): Promise<Digest> {
  const q = await getRiskQueues(hostId, timezone);
  const sections: DigestSection[] = [];

  if (q.licenses.length > 0) {
    sections.push({
      title: `Unverified licenses (${q.licenses.length})`,
      lines: q.licenses.map(
        (t) => `${tripLine(t, timezone)} — ${t.licenseStatusText || "awaiting license"}`
      ),
    });
  }

  if (q.profitRisk.length > 0) {
    sections.push({
      title: `Profit risk (${q.profitRisk.length})`,
      lines: q.profitRisk.map((t) => {
        const reasons = t.risk.riskReasons.join("; ");
        // Runway first. Every step of the Premier play needs the guest
        // reachable, and a failed rebook close to pickup means an empty car —
        // so how long is left decides whether it is even attemptable.
        const left =
          t.hoursUntilPickup === null
            ? ""
            : t.hoursUntilPickup < 24
              ? ` [${Math.max(0, Math.round(t.hoursUntilPickup))}h left]`
              : ` [${Math.round(t.hoursUntilPickup / 24)}d left]`;
        return `${tripLine(t, timezone)}${left} — ${reasons}`;
      }),
    });

    // The sequence the host actually runs, spelled out once at the end of the
    // section rather than repeated per trip. The email used to say "cancel
    // before pickup", which is step 3 of 5 — on its own that is just lost
    // revenue; the value is in the swap and rebook.
    if (q.profitRisk.some((t) => t.risk.premierProtection)) {
      sections.push({
        title: "For the Premier ones",
        lines: [
          "Message the guest and check they're at their phone or computer",
          "Cancel the trip",
          "Switch your protection plan to the $250 tier",
          "Have them rebook — both plans now match",
        ],
      });
    }
  }

  if (q.undecided.length > 0) {
    sections.push({
      // Surfaced separately rather than folded into Profit Risk: these are
      // below the line only if an unread input doesn't lift them back over, and
      // asserting that would be overstating what we know.
      title: `Below the line, undecided (${q.undecided.length})`,
      lines: q.undecided.map((t) => {
        const perMile = t.earnings?.perMile;
        const unknown = t.earnings?.unknownInputs.join(" and ") || "an input";
        return `${tripLine(t, timezone)} — computes ${
          perMile !== null && perMile !== undefined ? money(perMile) : "?"
        }/mile, but ${unknown} not read from Turo`;
      }),
    });
  }

  if (q.returningToday.length > 0) {
    const total = q.returningToday.reduce((s, t) => s + (t.earnings?.earnings ?? 0), 0);
    const anyFloor = q.returningToday.some((t) => t.earnings && !t.earnings.inputsKnown);
    sections.push({
      title: `Coming back today — ${money(total)}${anyFloor ? " (a floor)" : ""}`,
      lines: q.returningToday.map((t) => {
        const value = t.earnings ? money(t.earnings.earnings) : "not priced";
        const floor = t.earnings && !t.earnings.inputsKnown ? " (floor)" : "";
        return `${t.guestName} · ${t.vehicle} — ${value}${floor}`;
      }),
    });
  }

  const empty = sections.length === 0;

  return {
    subject: empty
      ? "HostOS: nothing needs attention today"
      : `HostOS: ${q.licenses.length} license${q.licenses.length === 1 ? "" : "s"}, ${q.profitRisk.length} profit risk${q.profitRisk.length === 1 ? "" : "s"}`,
    sections,
    empty,
  };
}

/** Plain text, because a digest that renders badly is a digest nobody reads. */
export function renderDigestText(digest: Digest): string {
  if (digest.empty) {
    return "Nothing needs attention today — no unverified licenses inside the 24h window, and no upcoming trip below the line.";
  }

  return digest.sections
    .map((s) => `${s.title}\n${"-".repeat(s.title.length)}\n${s.lines.map((l) => `  • ${l}`).join("\n")}`)
    .join("\n\n");
}
